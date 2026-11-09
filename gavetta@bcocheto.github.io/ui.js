import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const MAX_VISIBLE = 60;

const FILTERS = [
    ['all', 'Tudo'],
    ['text', 'Texto'],
    ['link', 'Links'],
    ['image', 'Imagens'],
    ['pinned', 'Fixados'],
];

const TYPE_ICON = {
    text: 'text-x-generic-symbolic',
    link: 'insert-link-symbolic',
    image: 'image-x-generic-symbolic',
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
    const n = item.text.length;
    return `${n} caractere${n === 1 ? '' : 's'}`;
}

export const Indicator = GObject.registerClass(
class GavettaIndicator extends PanelMenu.Button {
    _init(store, onPick) {
        super._init(0.5, 'Gavetta');
        this._store = store;
        this._onPick = onPick;
        this._filter = 'all';

        this.add_child(new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon',
        }));
        this.menu.actor.add_style_class_name('gavetta-menu');

        this._buildHeader();
        this._buildList();
        this._buildFooter();

        this.menu.connect('open-state-changed', (_m, open) => {
            if (!open)
                return;
            this._entry.set_text('');
            this._setFilter('all');
            this._entry.clutter_text.grab_key_focus();
        });
        this.refresh();
    }

    _buildHeader() {
        const box = new St.BoxLayout({vertical: true, style_class: 'gavetta-header'});

        this._entry = new St.Entry({
            hint_text: 'Buscar no histórico…',
            style_class: 'gavetta-search',
            can_focus: true,
            x_expand: true,
        });
        this._entry.set_primary_icon(new St.Icon({
            icon_name: 'edit-find-symbolic',
            icon_size: 16,
        }));
        this._entry.clutter_text.connect('text-changed', () => this.refresh());
        box.add_child(this._entry);

        const chips = new St.BoxLayout({style_class: 'gavetta-chips'});
        this._chips = new Map();
        for (const [key, label] of FILTERS) {
            const chip = new St.Button({label, style_class: 'gavetta-chip', can_focus: true});
            chip.connect('clicked', () => this._setFilter(key));
            this._chips.set(key, chip);
            chips.add_child(chip);
        }
        box.add_child(chips);

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.add_child(box);
        item.style = 'padding: 0;';
        this.menu.addMenuItem(item);
    }

    _buildList() {
        this._listBox = new St.BoxLayout({vertical: true, style_class: 'gavetta-list'});
        this._scroll = new St.ScrollView({
            style: 'max-height: 28em;',
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
        });
        this._scroll.add_child(this._listBox);

        const section = new PopupMenu.PopupMenuSection();
        section.actor.add_child(this._scroll);
        this.menu.addMenuItem(section);
    }

    _buildFooter() {
        const box = new St.BoxLayout({style_class: 'gavetta-footer'});
        this._count = new St.Label({
            style_class: 'gavetta-count',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        box.add_child(this._count);

        const clear = new St.Button({
            label: 'Limpar (mantém fixados)',
            style_class: 'gavetta-clear',
            can_focus: true,
        });
        clear.connect('clicked', () => {
            this._store.clear();
            this.refresh();
        });
        box.add_child(clear);

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.add_child(box);
        item.style = 'padding: 0;';
        this.menu.addMenuItem(item);
    }

    _setFilter(key) {
        this._filter = key;
        this._chips.forEach((chip, k) => {
            if (k === key)
                chip.add_style_class_name('active');
            else
                chip.remove_style_class_name('active');
        });
        this.refresh();
    }

    _matches(item, q) {
        if (this._filter === 'pinned' && !item.pinned)
            return false;
        if (['text', 'link', 'image'].includes(this._filter) && item.type !== this._filter)
            return false;
        if (!q)
            return true;
        return (item.text ?? '').toLowerCase().includes(q) ||
            (item.type === 'image' && 'imagem'.includes(q));
    }

    refresh() {
        this._listBox.destroy_all_children();
        const q = this._entry.get_text().toLowerCase().trim();
        const all = this._store.items;
        const items = all.filter(i => this._matches(i, q)).slice(0, MAX_VISIBLE);

        if (items.length === 0) {
            const empty = new St.BoxLayout({
                vertical: true,
                style_class: 'gavetta-empty',
                x_align: Clutter.ActorAlign.CENTER,
            });
            empty.add_child(new St.Icon({
                icon_name: 'edit-paste-symbolic',
                x_align: Clutter.ActorAlign.CENTER,
            }));
            empty.add_child(new St.Label({
                text: all.length ? 'Nada encontrado' : 'Copie algo e ele aparece aqui',
                x_align: Clutter.ActorAlign.CENTER,
            }));
            this._listBox.add_child(empty);
        } else {
            items.forEach(item => this._listBox.add_child(this._buildCard(item)));
        }
        const n = all.length;
        this._count.text = `${n} ${n === 1 ? 'item' : 'itens'}`;
    }

    _action(iconName, extraClass, onClick) {
        const btn = new St.Button({
            child: new St.Icon({icon_name: iconName, icon_size: 16}),
            style_class: `gavetta-action ${extraClass}`,
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        btn.connect('clicked', () => {
            onClick();
            return Clutter.EVENT_STOP;
        });
        return btn;
    }

    _buildCard(item) {
        const card = new St.Button({
            style_class: `gavetta-card${item.pinned ? ' pinned' : ''}`,
            can_focus: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        const row = new St.BoxLayout({x_expand: true});
        card.set_child(row);
        row.style = 'spacing: 10px;';

        // Lado esquerdo: miniatura ou emblema do tipo
        if (item.type === 'image') {
            const path = this._store.imagePath(item);
            row.add_child(new St.Bin({
                style_class: 'gavetta-thumb',
                style: `background-image: url("file://${path}");`,
                y_align: Clutter.ActorAlign.CENTER,
            }));
        } else {
            const badge = new St.Bin({
                style_class: `gavetta-badge ${item.type}`,
                y_align: Clutter.ActorAlign.CENTER,
                child: new St.Icon({icon_name: TYPE_ICON[item.type]}),
            });
            row.add_child(badge);
        }

        // Centro: prévia + meta
        const mid = new St.BoxLayout({vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        if (item.type !== 'image') {
            const preview = new St.Label({
                text: item.text.trim().replace(/\s+/g, ' ').slice(0, 300),
                style_class: 'gavetta-preview',
            });
            preview.clutter_text.line_wrap = true;
            preview.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            preview.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            preview.clutter_text.lines = 2;
            mid.add_child(preview);
        }
        mid.add_child(new St.Label({
            text: `${describe(item)} · ${timeAgo(item.ts)}`,
            style_class: 'gavetta-meta',
        }));
        row.add_child(mid);

        // Ações (aparecem no hover; fixado mantém a estrela visível)
        const actions = new St.BoxLayout({y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 2px;'});
        const pin = this._action(
            item.pinned ? 'starred-symbolic' : 'non-starred-symbolic',
            item.pinned ? 'pin-on' : '',
            () => {
                this._store.togglePin(item);
                this.refresh();
            });
        const del = this._action('edit-delete-symbolic', 'danger', () => {
            this._store.remove(item);
            this.refresh();
        });
        actions.add_child(pin);
        actions.add_child(del);
        row.add_child(actions);

        const showActions = () => {
            pin.opacity = 255;
            del.opacity = 255;
        };
        const hideActions = () => {
            pin.opacity = item.pinned ? 255 : 0;
            del.opacity = 0;
        };
        hideActions();
        card.connect('notify::hover', () => (card.hover ? showActions() : hideActions()));
        card.connect('key-focus-in', showActions);
        card.connect('key-focus-out', hideActions);

        card.connect('clicked', () => {
            this.menu.close();
            this._onPick(item);
        });
        return card;
    }
});
