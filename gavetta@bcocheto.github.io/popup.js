import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {EMOJI, KAOMOJI, SYMBOLS} from './data.js';

const MAX_VISIBLE = 80;
const GRID_COLS = 8;

const TABS = [
    {id: 'clip', label: '📋', title: 'Área de transferência', hint: 'Buscar no histórico…'},
    {id: 'emoji', label: '😀', title: 'Emoji', hint: 'Buscar emoji…'},
    {id: 'kaomoji', label: 'ツ', title: 'Kaomoji', hint: 'Buscar kaomoji…'},
    {id: 'symbols', label: 'Ω', title: 'Símbolos', hint: 'Buscar símbolo…'},
];

const FILTERS = [
    ['all', 'Tudo'],
    ['text', 'Texto'],
    ['link', 'Links'],
    ['image', 'Imagens'],
    ['file', 'Arquivos'],
    ['pinned', 'Fixados'],
];

const TYPE_ICON = {
    text: 'text-x-generic-symbolic',
    link: 'insert-link-symbolic',
    image: 'image-x-generic-symbolic',
    file: 'folder-documents-symbolic',
};

function timeAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 45)
        return 'agora';
    const m = Math.round(s / 60);
    if (m < 60)
        return `há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24)
        return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ontem' : `há ${d} dias`;
}

function fileInfo(uri) {
    try {
        const path = Gio.File.new_for_uri(uri).get_path();
        if (!path)
            return {};
        const [ct] = Gio.content_type_guess(path, null);
        const md5 = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, uri, -1);
        let thumb = null;
        for (const size of ['large', 'normal']) {
            const p = GLib.build_filenamev([GLib.get_user_cache_dir(), 'thumbnails', size, `${md5}.png`]);
            if (GLib.file_test(p, GLib.FileTest.EXISTS)) {
                thumb = p;
                break;
            }
        }
        if (!thumb && ct.startsWith('image/'))
            thumb = path;
        return {path, ct, thumb};
    } catch (_e) {
        return {};
    }
}

function describe(item) {
    if (item.type === 'image')
        return 'Imagem';
    if (item.type === 'link') {
        try {
            return new URL(item.text.trim()).host;
        } catch (_e) {
            return 'Link';
        }
    }
    if (item.type === 'file') {
        const n = item.uris.length;
        if (n > 1)
            return `${n} arquivos`;
        const {ct} = fileInfo(item.uris[0]);
        return ct ? Gio.content_type_get_description(ct) : 'Arquivo';
    }
    const n = item.text.length;
    return `${n} caractere${n === 1 ? '' : 's'}`;
}

const isPrintable = code => code >= 0x20 && code !== 0x7f;

export class GavettaPopup {
    constructor(store, settings, onPick) {
        this._store = store;
        this._settings = settings;
        this._onPick = onPick;
        this._tab = 'clip';
        this._filter = 'all';
        this._rows = [];
        this._grab = null;
        this._open = false;

        this._build();
    }

    get isOpen() {
        return this._open;
    }

    // ───────────── construção ─────────────

    _build() {
        this._backdrop = new St.Widget({reactive: true, visible: false});
        this._backdrop.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
            offset: 0,
        }));
        Main.layoutManager.uiGroup.add_child(this._backdrop);

        this._box = new St.BoxLayout({vertical: true, style_class: 'gavetta-popup', reactive: true});
        this._backdrop.add_child(this._box);

        // Abas
        const tabs = new St.BoxLayout({style_class: 'gavetta-tabs'});
        this._tabButtons = new Map();
        for (const tab of TABS) {
            const btn = new St.Button({
                label: tab.label,
                style_class: 'gavetta-tab',
                can_focus: true,
                x_expand: true,
            });
            btn.connect('clicked', () => this._setTab(tab.id));
            this._tabButtons.set(tab.id, btn);
            tabs.add_child(btn);
        }
        this._box.add_child(tabs);

        // Busca
        this._entry = new St.Entry({
            hint_text: TABS[0].hint,
            style_class: 'gavetta-search',
            can_focus: true,
            x_expand: true,
        });
        this._entry.set_primary_icon(new St.Icon({icon_name: 'edit-find-symbolic', icon_size: 16}));
        this._entry.clutter_text.connect('text-changed', () => this._render());
        this._entry.clutter_text.connect('activate', () => this._rows[0]?.[0]?.emit('clicked', 0));
        this._box.add_child(this._entry);

        // Filtros (somente na aba da área de transferência)
        this._chipRow = new St.BoxLayout({style_class: 'gavetta-chips'});
        this._chips = new Map();
        for (const [key, label] of FILTERS) {
            const chip = new St.Button({label, style_class: 'gavetta-chip', can_focus: true});
            chip.connect('clicked', () => {
                this._filter = key;
                this._render();
            });
            this._chips.set(key, chip);
            this._chipRow.add_child(chip);
        }
        const spacer = new St.Widget({x_expand: true});
        this._chipRow.add_child(spacer);
        const clear = new St.Button({label: 'Limpar', style_class: 'gavetta-chip danger', can_focus: true});
        clear.connect('clicked', () => {
            this._store.clear();
            this._render();
        });
        this._chipRow.add_child(clear);
        this._box.add_child(this._chipRow);

        // Conteúdo
        this._content = new St.BoxLayout({vertical: true, style_class: 'gavetta-content'});
        this._scroll = new St.ScrollView({
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            x_expand: true,
            y_expand: true,
        });
        this._scroll.add_child(this._content);
        this._box.add_child(this._scroll);

        // Rodapé
        this._status = new St.Label({style_class: 'gavetta-hint', x_expand: true});
        this._box.add_child(this._status);

        this._backdrop.connect('button-press-event', (_a, event) => {
            if (event.get_source() === this._backdrop) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._backdrop.connect('captured-event', (_a, event) => this._onEvent(event));
    }

    destroy() {
        this.close();
        this._backdrop.destroy();
        this._backdrop = null;
    }

    // ───────────── abrir / fechar ─────────────

    toggle() {
        if (this._open)
            this.close();
        else
            this.open();
    }

    open() {
        if (this._open)
            return;
        Main.layoutManager.uiGroup.set_child_above_sibling(this._backdrop, null);
        this._backdrop.show();

        const grab = Main.pushModal(this._backdrop, {actionMode: Shell.ActionMode.POPUP});
        if (!grab) {
            this._backdrop.hide();
            return;
        }
        this._grab = grab;
        this._open = true;

        this._entry.set_text('');
        this._filter = 'all';
        this._setTab('clip');
        this._place();

        this._box.opacity = 0;
        this._box.ease({
            opacity: 255,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._entry.clutter_text.grab_key_focus();
    }

    close() {
        if (!this._open)
            return;
        this._open = false;
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._backdrop.hide();
    }

    refresh() {
        if (this._open && this._tab === 'clip')
            this._render();
    }

    _place() {
        const [, w] = this._box.get_preferred_width(-1);
        const [, h] = this._box.get_preferred_height(w);
        const [px, py] = global.get_pointer();

        const monitors = Main.layoutManager.monitors;
        const mon = monitors.find(m =>
            px >= m.x && px < m.x + m.width && py >= m.y && py < m.y + m.height) ??
            Main.layoutManager.primaryMonitor;
        const wa = Main.layoutManager.getWorkAreaForMonitor(mon.index);

        const mode = this._settings.get_string('popup-position');
        let x = px + 6;
        let y = py + 6;
        const win = global.display.focus_window;
        if (mode === 'center') {
            x = wa.x + (wa.width - w) / 2;
            y = wa.y + (wa.height - h) / 2;
        } else if (mode === 'window' && win) {
            const r = win.get_frame_rect();
            x = r.x + (r.width - w) / 2;
            y = r.y + (r.height - h) / 2;
        } else if (y + h > wa.y + wa.height) {
            y = py - h - 6;
        }
        x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - w - 8));
        y = Math.max(wa.y + 8, Math.min(y, wa.y + wa.height - h - 8));
        this._box.set_position(Math.round(x), Math.round(y));
    }

    // ───────────── abas e renderização ─────────────

    _setTab(id) {
        this._tab = id;
        const tab = TABS.find(t => t.id === id);
        this._entry.hint_text = tab.hint;
        this._tabButtons.forEach((btn, k) => {
            if (k === id)
                btn.add_style_class_name('active');
            else
                btn.remove_style_class_name('active');
        });
        this._chipRow.visible = id === 'clip';
        this._render();
    }

    _cycleTab(step) {
        const i = TABS.findIndex(t => t.id === this._tab);
        this._setTab(TABS[(i + step + TABS.length) % TABS.length].id);
    }

    _render() {
        this._content.destroy_all_children();
        this._rows = [];
        const q = this._entry.get_text().toLowerCase().trim();

        this._chips.forEach((chip, k) => {
            if (k === this._filter)
                chip.add_style_class_name('active');
            else
                chip.remove_style_class_name('active');
        });

        switch (this._tab) {
        case 'clip':
            this._renderClipboard(q);
            break;
        case 'emoji':
            this._renderGrid(EMOJI, q, true);
            break;
        case 'kaomoji':
            this._renderKaomoji(q);
            break;
        default:
            this._renderGrid(SYMBOLS, q, false);
        }
        this._updateStatus();
    }

    _updateStatus() {
        if (this._tab === 'clip') {
            const n = this._store.items.length;
            this._status.text =
                `${n} ${n === 1 ? 'item' : 'itens'} · ↑↓ navega · Enter cola · Del apaga · Ctrl+P fixa`;
        } else {
            this._status.text = '←↑↓→ navega · Enter insere · Ctrl+Tab troca de aba · Esc fecha';
        }
    }

    _empty(text, icon = 'edit-paste-symbolic') {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'gavetta-empty',
            x_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(new St.Icon({icon_name: icon, x_align: Clutter.ActorAlign.CENTER}));
        box.add_child(new St.Label({text, x_align: Clutter.ActorAlign.CENTER}));
        this._content.add_child(box);
    }

    // ───────────── aba: área de transferência ─────────────

    _matches(item, q) {
        if (this._filter === 'pinned' && !item.pinned)
            return false;
        if (['text', 'link', 'image', 'file'].includes(this._filter) && item.type !== this._filter)
            return false;
        if (!q)
            return true;
        return (item.text ?? '').toLowerCase().includes(q) ||
            (item.type === 'image' && 'imagem'.includes(q));
    }

    _renderClipboard(q) {
        const all = this._store.items;
        const items = all.filter(i => this._matches(i, q)).slice(0, MAX_VISIBLE);
        if (items.length === 0) {
            this._empty(all.length ? 'Nada encontrado' : 'Copie algo e ele aparece aqui');
            return;
        }
        for (const item of items) {
            const card = this._buildCard(item);
            this._content.add_child(card);
            this._rows.push([card]);
        }
    }

    _iconButton(iconName, extraClass, onClick) {
        const btn = new St.Button({
            child: new St.Icon({icon_name: iconName, icon_size: 16}),
            style_class: `gavetta-action ${extraClass}`,
            can_focus: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        btn.connect('clicked', () => onClick());
        return btn;
    }

    _thumb(path) {
        return new St.Bin({
            style_class: 'gavetta-thumb',
            style: `background-image: url("file://${path}");`,
            y_align: Clutter.ActorAlign.CENTER,
        });
    }

    _buildCard(item) {
        const card = new St.Button({
            style_class: `gavetta-card${item.pinned ? ' pinned' : ''}`,
            can_focus: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        card._item = item;
        const row = new St.BoxLayout({x_expand: true});
        card.set_child(row);

        // Lado esquerdo: miniatura ou emblema
        let thumb = null;
        let gicon = null;
        if (item.type === 'image') {
            thumb = this._store.imagePath(item);
        } else if (item.type === 'file') {
            const info = fileInfo(item.uris[0]);
            thumb = item.uris.length === 1 ? info.thumb : null;
            if (!thumb && info.ct)
                gicon = Gio.content_type_get_symbolic_icon(info.ct);
        }
        if (thumb) {
            row.add_child(this._thumb(thumb));
        } else {
            row.add_child(new St.Bin({
                style_class: `gavetta-badge ${item.type}`,
                y_align: Clutter.ActorAlign.CENTER,
                child: new St.Icon(gicon ? {gicon} : {icon_name: TYPE_ICON[item.type]}),
            }));
        }

        // Centro
        const mid = new St.BoxLayout({vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        if (item.type !== 'image') {
            const preview = new St.Label({
                text: item.text.trim().replace(/\s+/g, ' ').slice(0, 300),
                style_class: 'gavetta-preview',
            });
            preview.clutter_text.line_wrap = true;
            preview.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            preview.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            mid.add_child(preview);
        }
        mid.add_child(new St.Label({
            text: `${describe(item)} · ${timeAgo(item.ts)}`,
            style_class: 'gavetta-meta',
        }));
        row.add_child(mid);

        // Ações no hover
        const actions = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER});
        const pin = this._iconButton(
            item.pinned ? 'starred-symbolic' : 'non-starred-symbolic',
            item.pinned ? 'pin-on' : '',
            () => {
                this._store.togglePin(item);
                this._render();
            });
        const del = this._iconButton('edit-delete-symbolic', 'danger', () => {
            this._store.remove(item);
            this._render();
        });
        actions.add_child(pin);
        actions.add_child(del);
        row.add_child(actions);

        const show = () => {
            pin.opacity = 255;
            del.opacity = 255;
        };
        const hide = () => {
            pin.opacity = item.pinned ? 255 : 0;
            del.opacity = 0;
        };
        hide();
        card.connect('notify::hover', () => (card.hover ? show() : hide()));
        card.connect('key-focus-in', show);
        card.connect('key-focus-out', hide);

        card.connect('clicked', () => this._choose({kind: 'item', item}));
        return card;
    }

    // ───────────── abas: emoji, símbolos e kaomoji ─────────────

    _cell(glyph, emoji) {
        const btn = new St.Button({
            label: glyph,
            style_class: `gavetta-cell${emoji ? ' emoji' : ''}`,
            can_focus: true,
            x_expand: true,
        });
        btn.connect('clicked', () => this._choose({kind: 'text', text: glyph, emoji}));
        return btn;
    }

    _addGridRows(glyphs, emoji) {
        for (let i = 0; i < glyphs.length; i += GRID_COLS) {
            const rowBox = new St.BoxLayout({x_expand: true, style_class: 'gavetta-grid-row'});
            const row = [];
            for (const g of glyphs.slice(i, i + GRID_COLS)) {
                const cell = this._cell(g, emoji);
                rowBox.add_child(cell);
                row.push(cell);
            }
            // preenche a última linha para manter o alinhamento
            for (let k = row.length; k < GRID_COLS; k++)
                rowBox.add_child(new St.Widget({x_expand: true}));
            this._content.add_child(rowBox);
            this._rows.push(row);
        }
    }

    _renderGrid(groups, q, withRecents) {
        if (q) {
            const found = groups.flatMap(g => g.items)
                .filter(i => i.glyph.includes(q) || i.kw.includes(q))
                .map(i => i.glyph);
            if (found.length === 0) {
                this._empty('Nada encontrado', 'face-uncertain-symbolic');
                return;
            }
            this._addGridRows([...new Set(found)], withRecents);
            return;
        }
        if (withRecents && this._store.recents.length) {
            this._section('Recentes');
            this._addGridRows(this._store.recents, true);
        }
        for (const group of groups) {
            this._section(group.name);
            this._addGridRows(group.items.map(i => i.glyph), withRecents);
        }
    }

    _renderKaomoji(q) {
        let any = false;
        for (const group of KAOMOJI) {
            const items = group.items.filter(i => !q || i.glyph.toLowerCase().includes(q) || i.kw.includes(q));
            if (items.length === 0)
                continue;
            any = true;
            this._section(group.name);
            for (const {glyph} of items) {
                const btn = new St.Button({
                    label: glyph,
                    style_class: 'gavetta-card kaomoji',
                    can_focus: true,
                    x_expand: true,
                });
                btn.connect('clicked', () => this._choose({kind: 'text', text: glyph}));
                this._content.add_child(btn);
                this._rows.push([btn]);
            }
        }
        if (!any)
            this._empty('Nada encontrado', 'face-uncertain-symbolic');
    }

    _section(title) {
        this._content.add_child(new St.Label({text: title, style_class: 'gavetta-section'}));
    }

    // ───────────── eventos ─────────────

    _choose(payload) {
        this.close();
        this._onPick(payload);
    }

    _onEvent(event) {
        if (event.type() !== Clutter.EventType.KEY_PRESS)
            return Clutter.EVENT_PROPAGATE;

        const sym = event.get_key_symbol();
        const state = event.get_state();
        const ctrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const mod = (state & (Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.SUPER_MASK)) !== 0;
        const focus = global.stage.get_key_focus();
        const inEntry = focus === this._entry.clutter_text;

        if (sym === Clutter.KEY_Escape) {
            this.close();
            return Clutter.EVENT_STOP;
        }
        if (ctrl && (sym === Clutter.KEY_Tab || sym === Clutter.KEY_ISO_Left_Tab)) {
            this._cycleTab(sym === Clutter.KEY_ISO_Left_Tab || (state & Clutter.ModifierType.SHIFT_MASK) ? -1 : 1);
            return Clutter.EVENT_STOP;
        }
        if (ctrl && sym >= Clutter.KEY_1 && sym <= Clutter.KEY_4) {
            this._setTab(TABS[sym - Clutter.KEY_1].id);
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Up || sym === Clutter.KEY_Down ||
            sym === Clutter.KEY_Left || sym === Clutter.KEY_Right) {
            // Esquerda/direita no campo de busca continuam movendo o cursor
            if (inEntry && (sym === Clutter.KEY_Left || sym === Clutter.KEY_Right) &&
                this._entry.get_text().length > 0)
                return Clutter.EVENT_PROPAGATE;
            this._move(sym);
            return Clutter.EVENT_STOP;
        }
        if (ctrl && (sym === Clutter.KEY_p || sym === Clutter.KEY_P) && focus?._item) {
            this._store.togglePin(focus._item);
            this._render();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Delete && focus?._item) {
            this._store.remove(focus._item);
            this._render();
            return Clutter.EVENT_STOP;
        }

        // Digitar com um item focado volta para a busca
        if (!inEntry && !ctrl && !mod) {
            if (sym === Clutter.KEY_BackSpace) {
                const t = this._entry.get_text();
                this._entry.set_text(t.slice(0, -1));
                this._entry.clutter_text.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            const code = event.get_key_unicode();
            if (code && isPrintable(code.codePointAt(0))) {
                this._entry.set_text(this._entry.get_text() + code);
                this._entry.clutter_text.grab_key_focus();
                this._entry.clutter_text.set_cursor_position(-1);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _move(sym) {
        const rows = this._rows;
        if (rows.length === 0)
            return;
        const focus = global.stage.get_key_focus();
        let r = -1;
        let c = -1;
        rows.forEach((row, ri) => {
            const ci = row.indexOf(focus);
            if (ci >= 0) {
                r = ri;
                c = ci;
            }
        });

        let target = null;
        if (r < 0) {
            if (sym === Clutter.KEY_Down || sym === Clutter.KEY_Right)
                target = rows[0][0];
        } else if (sym === Clutter.KEY_Left) {
            if (c > 0)
                target = rows[r][c - 1];
            else if (r > 0)
                target = rows[r - 1][rows[r - 1].length - 1];
        } else if (sym === Clutter.KEY_Right) {
            if (c < rows[r].length - 1)
                target = rows[r][c + 1];
            else if (r < rows.length - 1)
                target = rows[r + 1][0];
        } else if (sym === Clutter.KEY_Up) {
            if (r > 0) {
                target = rows[r - 1][Math.min(c, rows[r - 1].length - 1)];
            } else {
                this._entry.clutter_text.grab_key_focus();
                return;
            }
        } else if (r < rows.length - 1) {
            target = rows[r + 1][Math.min(c, rows[r + 1].length - 1)];
        }

        if (target) {
            target.grab_key_focus();
            this._reveal(target);
        }
    }

    _reveal(actor) {
        try {
            const adj = this._scroll.vscroll.adjustment;
            const [, ay] = actor.get_transformed_position();
            const [, sy] = this._scroll.get_transformed_position();
            const rel = ay - sy;
            const h = actor.height;
            const view = this._scroll.height;
            if (rel < 0)
                adj.value += rel - 6;
            else if (rel + h > view)
                adj.value += rel + h - view + 6;
        } catch (_e) { /* sem rolagem automática nesta versão */ }
    }
}
