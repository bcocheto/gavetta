import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LINK_RE = /^https?:\/\/\S+$/i;
const MAX_RECENT_EMOJI = 24;
const SAVE_DELAY_MS = 400;
const MAX_TEXT_CHARS = 1_000_000;           // textos maiores que ~1 MB são ignorados
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // imagens maiores que 10 MB são ignoradas

// Histórico persistido em ~/.local/share/gavetta/history.json
// Imagens ficam em ~/.local/share/gavetta/images/<sha256>.png
export class Store {
    constructor(maxItems) {
        this._max = maxItems;
        this._dir = GLib.build_filenamev([GLib.get_user_data_dir(), 'gavetta']);
        this._imgDir = GLib.build_filenamev([this._dir, 'images']);
        this._file = Gio.File.new_for_path(GLib.build_filenamev([this._dir, 'history.json']));
        GLib.mkdir_with_parents(this._imgDir, 0o700);
        // o diretório pode já existir com permissões abertas
        GLib.chmod(this._dir, 0o700);
        GLib.chmod(this._imgDir, 0o700);
        this.items = [];
        this.recents = [];
        this._load();
    }

    setMax(n) {
        this._max = n;
        this._trim();
        this._save();
    }

    imagePath(item) {
        return GLib.build_filenamev([this._imgDir, `${item.hash}.png`]);
    }

    addText(text) {
        if (text.length > MAX_TEXT_CHARS)
            return null;
        const type = LINK_RE.test(text.trim()) ? 'link' : 'text';
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, text, -1);
        return this._add({type, text, hash});
    }

    addImage(bytes) {
        if (bytes.get_size() > MAX_IMAGE_BYTES)
            return null;
        const hash = GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes);
        const path = GLib.build_filenamev([this._imgDir, `${hash}.png`]);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            GLib.file_set_contents_full(path, bytes.get_data(),
                GLib.FileSetContentsFlags.NONE, 0o600);
        return this._add({type: 'image', hash});
    }

    // Arquivos copiados no gerenciador de arquivos (imagens, vídeos, PDFs…)
    addFiles(uris) {
        const joined = uris.join('\n');
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, joined, -1);
        const names = uris.map(u => {
            const raw = u.split('/').pop();
            try {
                return decodeURIComponent(raw);
            } catch (_e) {
                return raw; // % malformado
            }
        }).join(', ');
        return this._add({type: 'file', uris, text: names, hash});
    }

    addRecentEmoji(glyph) {
        this.recents = [glyph, ...this.recents.filter(e => e !== glyph)].slice(0, MAX_RECENT_EMOJI);
        this._save();
    }

    touch(item) {
        item.ts = Date.now();
        this._sort();
        this._save();
    }

    togglePin(item) {
        item.pinned = !item.pinned;
        this._save();
    }

    remove(item) {
        this.items = this.items.filter(i => i !== item);
        this._gcImage(item);
        this._save();
    }

    clear() {
        const keep = this.items.filter(i => i.pinned);
        this.items.filter(i => !i.pinned).forEach(i => this._gcImage(i, keep));
        this.items = keep;
        this._save();
    }

    _add(entry) {
        const dup = this.items.find(i => i.hash === entry.hash);
        if (dup) {
            dup.ts = Date.now();
            this._sort();
            this._save();
            return dup;
        }
        const item = {...entry, ts: Date.now(), pinned: false};
        this.items.push(item);
        this._sort();
        this._trim();
        this._save();
        return item;
    }

    _sort() {
        this.items.sort((a, b) => (!!b.pinned - !!a.pinned) || (b.ts - a.ts));
    }

    _trim() {
        const unpinned = this.items.filter(i => !i.pinned);
        const drop = unpinned.slice(this._max);
        drop.forEach(i => this._gcImage(i));
        this.items = this.items.filter(i => !drop.includes(i));
    }

    _gcImage(item, others = this.items) {
        if (item.type !== 'image' || others.some(i => i !== item && i.hash === item.hash))
            return;
        try {
            Gio.File.new_for_path(this.imagePath(item)).delete(null);
        } catch (_e) { /* já removida */ }
    }

    _load() {
        let data;
        try {
            let ok;
            [ok, data] = this._file.load_contents(null);
            if (!ok)
                return;
        } catch (_e) {
            return; // primeiro uso: ainda não há arquivo
        }
        try {
            const parsed = JSON.parse(new TextDecoder().decode(data));
            const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
            const recents = Array.isArray(parsed) ? [] : (parsed.recents ?? []);
            if (!Array.isArray(items) || !Array.isArray(recents))
                throw new Error('formato inesperado');
            // descarta entradas malformadas em vez de quebrar mais tarde
            this.items = items.filter(i => i && typeof i.hash === 'string' &&
                (i.type === 'image' || i.type === 'file' ? true : typeof i.text === 'string') &&
                (i.type !== 'file' || Array.isArray(i.uris)));
            this.recents = recents.filter(r => typeof r === 'string');
        } catch (e) {
            // preserva o arquivo ilegível antes que o próximo _save o sobrescreva
            console.error(`[Gavetta] histórico ilegível (${e.message}); copiado para history.json.corrupt`);
            try {
                this._file.copy(Gio.File.new_for_path(`${this._file.get_path()}.corrupt`),
                    Gio.FileCopyFlags.OVERWRITE, null, null);
            } catch (_e) { /* melhor esforço */ }
            this.items = [];
            this.recents = [];
        }
    }

    // Agrupa gravações seguidas (cada cópia/fixar/apagar chama _save)
    _save() {
        if (this._saveId)
            return;
        this._saveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SAVE_DELAY_MS, () => {
            this._saveId = 0;
            this._writeNow();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Grava o que estiver pendente (chamar no disable())
    flush() {
        if (!this._saveId)
            return;
        GLib.source_remove(this._saveId);
        this._saveId = 0;
        this._writeNow();
    }

    _writeNow() {
        try {
            const payload = JSON.stringify({items: this.items, recents: this.recents});
            this._file.replace_contents(
                new TextEncoder().encode(payload),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE, null);
        } catch (e) {
            console.error(`[Gavetta] falha ao salvar: ${e.message}`);
        }
    }
}
