import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LINK_RE = /^https?:\/\/\S+$/i;
const MAX_RECENT_EMOJI = 24;

// Histórico persistido em ~/.local/share/gavetta/history.json
// Imagens ficam em ~/.local/share/gavetta/images/<sha256>.png
export class Store {
    constructor(maxItems) {
        this._max = maxItems;
        this._dir = GLib.build_filenamev([GLib.get_user_data_dir(), 'gavetta']);
        this._imgDir = GLib.build_filenamev([this._dir, 'images']);
        this._file = Gio.File.new_for_path(GLib.build_filenamev([this._dir, 'history.json']));
        GLib.mkdir_with_parents(this._imgDir, 0o700);
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
        const type = LINK_RE.test(text.trim()) ? 'link' : 'text';
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, text, -1);
        return this._add({type, text, hash});
    }

    addImage(bytes) {
        const hash = GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes);
        const path = GLib.build_filenamev([this._imgDir, `${hash}.png`]);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            GLib.file_set_contents(path, bytes.get_data());
        return this._add({type: 'image', hash});
    }

    // Arquivos copiados no gerenciador de arquivos (imagens, vídeos, PDFs…)
    addFiles(uris) {
        const joined = uris.join('\n');
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, joined, -1);
        const names = uris.map(u => decodeURIComponent(u.split('/').pop())).join(', ');
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
        this.items.sort((a, b) => (b.pinned - a.pinned) || (b.ts - a.ts));
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
        try {
            const [ok, data] = this._file.load_contents(null);
            if (!ok)
                return;
            const parsed = JSON.parse(new TextDecoder().decode(data));
            if (Array.isArray(parsed)) {
                this.items = parsed;
            } else {
                this.items = parsed.items ?? [];
                this.recents = parsed.recents ?? [];
            }
        } catch (_e) {
            this.items = [];
            this.recents = [];
        }
    }

    _save() {
        try {
            const payload = JSON.stringify({items: this.items, recents: this.recents});
            this._file.replace_contents(
                new TextEncoder().encode(payload),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            console.error(`[Gavetta] falha ao salvar: ${e.message}`);
        }
    }
}
