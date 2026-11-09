import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Store} from './store.js';

const CB = St.ClipboardType.CLIPBOARD;
const MAX_VISIBLE = 50;

const Indicator = GObject.registerClass(
class GavettaIndicator extends PanelMenu.Button {
    _init(store, onPick) {
        super._init(0.5, 'Gavetta');
        this._store = store;
        this._onPick = onPick;

        this.add_child(new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon',
        }));

        // Campo de busca
        this._entry = new St.Entry({
            hint_text: 'Buscar…',
            can_focus: true,
            x_expand: true,
            style: 'min-width: 22em;',
        });
        this._entry.clutter_text.connect('text-changed', () => this.refresh());
        const searchItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        searchItem.add_child(this._entry);
        this.menu.addMenuItem(searchItem);

        // Lista rolável
        this._list = new PopupMenu.PopupMenuSection();
        this._scroll = new St.ScrollView({
            style: 'max-height: 26em;',
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
        });
        this._scroll.add_child(this._list.actor);
        const scrollSection = new PopupMenu.PopupMenuSection();
        scrollSection.actor.add_child(this._scroll);
        this.menu.addMenuItem(scrollSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const clear = new PopupMenu.PopupMenuItem('Limpar histórico (mantém fixados)');
        clear.connect('activate', () => {
            this._store.clear();
            this.refresh();
        });
        this.menu.addMenuItem(clear);

        this.menu.connect('open-state-changed', (_m, open) => {
            if (!open)
                return;
            this._entry.set_text('');
            this.refresh();
            this._entry.clutter_text.grab_key_focus();
        });

        this.refresh();
    }

    refresh() {
        this._list.removeAll();
        const q = this._entry.get_text().toLowerCase();
        const items = this._store.items
            .filter(i => !q || (i.text ?? '').toLowerCase().includes(q) || (q === 'imagem' && i.type === 'image'))
            .slice(0, MAX_VISIBLE);

        if (items.length === 0) {
            const empty = new PopupMenu.PopupMenuItem('Nada por aqui ainda', {reactive: false});
            this._list.addMenuItem(empty);
            return;
        }
        items.forEach(item => this._list.addMenuItem(this._buildRow(item)));
    }

    _buildRow(item) {
        const row = new PopupMenu.PopupBaseMenuItem();

        if (item.type === 'image') {
            const file = Gio.File.new_for_path(this._store.imagePath(item));
            row.add_child(new St.Icon({
                gicon: new Gio.FileIcon({file}),
                icon_size: 56,
            }));
            row.add_child(new St.Label({
                text: 'Imagem',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            }));
        } else {
            const first = item.text.trim().split('\n')[0].slice(0, 200);
            const label = new St.Label({
                text: (item.type === 'link' ? '🔗 ' : '') + first,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style: 'max-width: 20em;',
            });
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            row.add_child(label);
        }

        const pin = new St.Button({
            child: new St.Icon({
                icon_name: item.pinned ? 'starred-symbolic' : 'non-starred-symbolic',
                icon_size: 16,
            }),
            style_class: 'button',
            can_focus: true,
        });
        pin.connect('clicked', () => {
            this._store.togglePin(item);
            this.refresh();
        });
        row.add_child(pin);

        const del = new St.Button({
            child: new St.Icon({icon_name: 'edit-delete-symbolic', icon_size: 16}),
            style_class: 'button',
            can_focus: true,
        });
        del.connect('clicked', () => {
            this._store.remove(item);
            this.refresh();
        });
        row.add_child(del);

        row.connect('activate', () => {
            this.menu.close();
            this._onPick(item);
        });
        return row;
    }
});

export default class GavettaExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._clipboard = St.Clipboard.get_default();
        this._timeouts = new Set();

        this._store = new Store(this._settings.get_int('history-size'));
        this._settingsId = this._settings.connect('changed::history-size', () =>
            this._store.setMax(this._settings.get_int('history-size')));

        this._indicator = new Indicator(this._store, item => this._pick(item));
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Teclado virtual para o Ctrl+V
        const seat = global.stage.context.get_backend().get_default_seat();
        this._vkbd = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._indicator.menu.toggle());

        // Monitor do clipboard
        this._selection = global.display.get_selection();
        this._ownerId = this._selection.connect('owner-changed', (_s, type) => {
            if (type === Meta.SelectionType.SELECTION_CLIPBOARD)
                this._onClipboardChanged();
        });
    }

    disable() {
        Main.wm.removeKeybinding('toggle-shortcut');
        this._selection?.disconnect(this._ownerId);
        this._settings?.disconnect(this._settingsId);
        this._timeouts?.forEach(id => GLib.source_remove(id));
        this._indicator?.destroy();
        this._vkbd = null;
        this._indicator = null;
        this._store = null;
        this._settings = null;
        this._selection = null;
        this._clipboard = null;
        this._timeouts = null;
    }

    _later(ms, fn) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._timeouts.delete(id);
            fn();
            return GLib.SOURCE_REMOVE;
        });
        this._timeouts.add(id);
    }

    _onClipboardChanged() {
        const types = this._clipboard.get_mimetypes(CB);
        if (types.includes('image/png')) {
            this._clipboard.get_content(CB, 'image/png', (_c, bytes) => {
                if (bytes && bytes.get_size() > 0 && this._store) {
                    this._store.addImage(bytes);
                    this._indicator?.refresh();
                }
            });
            return;
        }
        this._clipboard.get_text(CB, (_c, text) => {
            if (text && text.trim() && this._store) {
                this._store.addText(text);
                this._indicator?.refresh();
            }
        });
    }

    _pick(item) {
        if (item.type === 'image') {
            const bytes = GLib.file_get_contents(this._store.imagePath(item))[1];
            this._clipboard.set_content(CB, 'image/png', new GLib.Bytes(bytes));
        } else {
            this._clipboard.set_text(CB, item.text);
        }
        if (this._settings.get_boolean('paste-on-select'))
            this._later(150, () => this._sendPaste());
    }

    // Ctrl+V. Terminais costumam usar Ctrl+Shift+V (ainda não tratado).
    _sendPaste() {
        if (!this._vkbd)
            return;
        const t = () => GLib.get_monotonic_time();
        const {PRESSED, RELEASED} = Clutter.KeyState;
        this._vkbd.notify_keyval(t(), Clutter.KEY_Control_L, PRESSED);
        this._vkbd.notify_keyval(t(), Clutter.KEY_v, PRESSED);
        this._vkbd.notify_keyval(t(), Clutter.KEY_v, RELEASED);
        this._vkbd.notify_keyval(t(), Clutter.KEY_Control_L, RELEASED);
    }
}
