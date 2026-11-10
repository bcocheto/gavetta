import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const POSITIONS = [
    ['pointer', 'Perto do ponteiro'],
    ['window', 'Centro da janela ativa'],
    ['center', 'Centro da tela'],
];

export default class GavettaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Gavetta',
            icon_name: 'edit-paste-symbolic',
        });

        // ── Histórico
        const history = new Adw.PreferencesGroup({title: 'Histórico'});
        const size = new Adw.SpinRow({
            title: 'Itens no histórico',
            subtitle: 'Itens fixados não contam para o limite',
            adjustment: new Gtk.Adjustment({lower: 10, upper: 1000, step_increment: 10, page_increment: 50}),
        });
        settings.bind('history-size', size, 'value', Gio.SettingsBindFlags.DEFAULT);
        history.add(size);
        page.add(history);

        // ── Privacidade
        const privacy = new Adw.PreferencesGroup({
            title: 'Privacidade',
            description: 'O histórico fica em texto puro em ~/.local/share/gavetta, legível só por você.',
        });
        const paused = new Adw.SwitchRow({
            title: 'Pausar a captura',
            subtitle: 'Nada novo copiado entra no histórico enquanto estiver ligado',
        });
        settings.bind('capture-paused', paused, 'active', Gio.SettingsBindFlags.DEFAULT);
        privacy.add(paused);
        const secrets = new Adw.SwitchRow({
            title: 'Ignorar senhas e tokens óbvios',
            subtitle: 'Chaves de API, JWT e chaves privadas não são gravados. O filtro é parcial: não detecta toda senha',
        });
        settings.bind('filter-secrets', secrets, 'active', Gio.SettingsBindFlags.DEFAULT);
        privacy.add(secrets);
        page.add(privacy);

        // ── Comportamento
        const behavior = new Adw.PreferencesGroup({title: 'Comportamento'});

        const paste = new Adw.SwitchRow({
            title: 'Colar ao escolher',
            subtitle: 'Envia Ctrl+V (Ctrl+Shift+V em terminais) para o app em foco',
        });
        settings.bind('paste-on-select', paste, 'active', Gio.SettingsBindFlags.DEFAULT);
        behavior.add(paste);

        const indicator = new Adw.SwitchRow({title: 'Mostrar ícone no painel'});
        settings.bind('show-indicator', indicator, 'active', Gio.SettingsBindFlags.DEFAULT);
        behavior.add(indicator);

        const position = new Adw.ComboRow({
            title: 'Onde o popup abre',
            model: Gtk.StringList.new(POSITIONS.map(p => p[1])),
        });
        position.selected = Math.max(0, POSITIONS.findIndex(p => p[0] === settings.get_string('popup-position')));
        position.connect('notify::selected', () =>
            settings.set_string('popup-position', POSITIONS[position.selected][0]));
        behavior.add(position);
        page.add(behavior);

        // ── Atalho
        const keys = new Adw.PreferencesGroup({
            title: 'Atalho',
            description: 'Formato GTK com ao menos um modificador, por exemplo <Super>v ou <Super><Shift>v.',
        });
        const shortcut = new Adw.EntryRow({
            title: 'Abrir a Gavetta',
            show_apply_button: true,
            text: settings.get_strv('toggle-shortcut')[0] ?? '',
        });
        shortcut.connect('apply', () => {
            const text = shortcut.text.trim();
            // exige tecla + modificador: uma tecla sozinha capturaria a digitação global
            const [ok, key, mods] = Gtk.accelerator_parse(text);
            if (ok && key !== 0 && mods !== 0) {
                settings.set_strv('toggle-shortcut', [text]);
                shortcut.remove_css_class('error');
            } else {
                shortcut.add_css_class('error');
            }
        });
        keys.add(shortcut);

        const takeover = new Adw.SwitchRow({
            title: 'Assumir o Super+V',
            subtitle: 'Libera o Super+V da bandeja de notificações do GNOME enquanto a extensão estiver ativa (Super+M continua abrindo a bandeja)',
        });
        settings.bind('takeover-super-v', takeover, 'active', Gio.SettingsBindFlags.DEFAULT);
        keys.add(takeover);
        page.add(keys);

        window.add(page);
    }
}
