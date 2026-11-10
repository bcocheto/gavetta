import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Store} from './store.js';
import {GavettaPopup} from './popup.js';

const CB = St.ClipboardType.CLIPBOARD;
const TRAY_KEY = 'toggle-message-tray';
const GNOME_FILES = 'x-special/gnome-copied-files';
const TERMINAL_RE = /terminal|konsole|alacritty|kitty|tilix|wezterm|ghostty|xterm|foot|terminator|ptyxis|guake|tmux|warp/i;

export default class GavettaExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._clipboard = St.Clipboard.get_default();
        this._timeouts = new Set();

        this._store = new Store(this._settings.get_int('history-size'));
        this._popup = new GavettaPopup(this._store, this._settings, p => this._onPick(p));

        this._settingsIds = [
            this._settings.connect('changed::history-size', () =>
                this._store.setMax(this._settings.get_int('history-size'))),
            this._settings.connect('changed::show-indicator', () => this._syncIndicator()),
            this._settings.connect('changed::takeover-super-v', () => this._syncTakeover()),
        ];

        this._syncIndicator();

        // Teclado virtual (colar)
        const seat = global.stage.context.get_backend().get_default_seat();
        this._vkbd = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._popup.toggle());

        // Monitor do clipboard
        this._selection = global.display.get_selection();
        this._ownerId = this._selection.connect('owner-changed', (_s, type) => {
            if (type === Meta.SelectionType.SELECTION_CLIPBOARD)
                this._onClipboardChanged();
        });

        // por último: se algo acima falhar, a bandeja do GNOME não fica sem Super+V
        this._syncTakeover();
    }

    disable() {
        Main.wm.removeKeybinding('toggle-shortcut');
        this._selection?.disconnect(this._ownerId);
        this._settingsIds?.forEach(id => this._settings.disconnect(id));
        this._timeouts?.forEach(id => GLib.source_remove(id));
        this._restoreTray();
        this._indicator?.destroy();
        this._popup?.destroy();

        this._vkbd = null;
        this._indicator = null;
        this._popup = null;
        this._store = null;
        this._settings = null;
        this._selection = null;
        this._clipboard = null;
        this._timeouts = null;
        this._settingsIds = null;
    }

    // ───────────── painel ─────────────

    _syncIndicator() {
        const want = this._settings.get_boolean('show-indicator');
        if (want && !this._indicator) {
            this._indicator = new PanelMenu.Button(0.5, 'Gavetta', true);
            this._indicator.add_child(new St.Icon({
                icon_name: 'edit-paste-symbolic',
                style_class: 'system-status-icon',
            }));
            this._indicator.connect('button-press-event', () => {
                this._popup.toggle();
                return Clutter.EVENT_STOP;
            });
            Main.panel.addToStatusArea(this.uuid, this._indicator);
        } else if (!want && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    // ───────────── Super+V ─────────────
    // O GNOME usa Super+V para a bandeja de notificações. Enquanto a Gavetta
    // estiver ativa, removemos só essa combinação (Super+M continua valendo) e
    // restauramos o valor original ao desativar. O backup fica no gsettings da
    // extensão para sobreviver a um crash do shell.

    _syncTakeover() {
        if (this._settings.get_boolean('takeover-super-v'))
            this._takeTray();
        else
            this._restoreTray();
    }

    _takeTray() {
        const kb = new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'});
        const current = kb.get_strv(TRAY_KEY);
        if (this._settings.get_strv('saved-tray-shortcuts').length === 0 && current.includes('<Super>v'))
            this._settings.set_strv('saved-tray-shortcuts', current);
        if (current.includes('<Super>v'))
            kb.set_strv(TRAY_KEY, current.filter(k => k !== '<Super>v'));
    }

    _restoreTray() {
        const saved = this._settings?.get_strv('saved-tray-shortcuts') ?? [];
        if (saved.length === 0)
            return;
        // reinsere só <Super>v, sem desfazer mudanças feitas pelo usuário no meio tempo
        const kb = new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'});
        const current = kb.get_strv(TRAY_KEY);
        if (saved.includes('<Super>v') && !current.includes('<Super>v'))
            kb.set_strv(TRAY_KEY, [...current, '<Super>v']);
        this._settings.set_strv('saved-tray-shortcuts', []);
    }

    // ───────────── utilitários ─────────────

    _later(ms, fn) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._timeouts?.delete(id);
            fn();
            return GLib.SOURCE_REMOVE;
        });
        this._timeouts.add(id);
    }

    // ───────────── monitor do clipboard ─────────────

    _onClipboardChanged() {
        const types = this._clipboard.get_mimetypes(CB);

        // Gerenciadores de senha marcam o conteúdo como sensível
        if (types.includes('x-kde-passwordManagerHint'))
            return;

        const filesType = types.includes(GNOME_FILES) ? GNOME_FILES :
            (types.includes('text/uri-list') ? 'text/uri-list' : null);
        if (filesType) {
            this._clipboard.get_content(CB, filesType, (_c, bytes) => {
                const uris = this._parseUris(bytes);
                if (uris.length > 0)
                    this._record(() => this._store.addFiles(uris));
                else
                    this._readImageOrText(types);
            });
            return;
        }
        this._readImageOrText(types);
    }

    _readImageOrText(types) {
        if (types.includes('image/png')) {
            this._clipboard.get_content(CB, 'image/png', (_c, bytes) => {
                if (bytes && bytes.get_size() > 0)
                    this._record(() => this._store.addImage(bytes));
            });
            return;
        }
        this._clipboard.get_text(CB, (_c, text) => {
            if (text && text.trim())
                this._record(() => this._store.addText(text));
        });
    }

    _parseUris(bytes) {
        if (!bytes || bytes.get_size() === 0)
            return [];
        const text = new TextDecoder().decode(bytes.get_data());
        return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('file://'));
    }

    _record(fn) {
        if (!this._store)
            return;
        fn();
        this._popup?.refresh();
    }

    // ───────────── escolha de um item ─────────────

    _onPick(payload) {
        if (payload.kind === 'text') {
            this._clipboard.set_text(CB, payload.text);
            if (payload.emoji)
                this._store.addRecentEmoji(payload.text);
        } else {
            const item = payload.item;
            if (item.type === 'image') {
                let data;
                try {
                    [, data] = GLib.file_get_contents(this._store.imagePath(item));
                } catch (e) {
                    // arquivo da imagem sumiu: remove o item órfão
                    console.error(`[Gavetta] imagem indisponível: ${e.message}`);
                    this._store.remove(item);
                    this._popup?.refresh();
                    return;
                }
                this._clipboard.set_content(CB, 'image/png', new GLib.Bytes(data));
            } else if (item.type === 'file') {
                const body = `copy\n${item.uris.join('\n')}`;
                this._clipboard.set_content(CB, GNOME_FILES,
                    new GLib.Bytes(new TextEncoder().encode(body)));
            } else {
                this._clipboard.set_text(CB, item.text);
            }
            // sobe o item para o topo do histórico
            this._store.touch(item);
        }
        if (this._settings.get_boolean('paste-on-select'))
            this._later(160, () => this._sendPaste());
    }

    _sendPaste() {
        if (!this._vkbd)
            return;
        const cls = global.display.focus_window?.get_wm_class() ?? '';
        const shift = TERMINAL_RE.test(cls);
        const {PRESSED, RELEASED} = Clutter.KeyState;
        const t = () => GLib.get_monotonic_time();
        const v = this._vkbd;

        v.notify_keyval(t(), Clutter.KEY_Control_L, PRESSED);
        if (shift)
            v.notify_keyval(t(), Clutter.KEY_Shift_L, PRESSED);
        v.notify_keyval(t(), Clutter.KEY_v, PRESSED);
        v.notify_keyval(t(), Clutter.KEY_v, RELEASED);
        if (shift)
            v.notify_keyval(t(), Clutter.KEY_Shift_L, RELEASED);
        v.notify_keyval(t(), Clutter.KEY_Control_L, RELEASED);
    }
}
