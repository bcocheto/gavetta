import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Store} from './store.js';
import {Indicator} from './ui.js';

const CB = St.ClipboardType.CLIPBOARD;
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
