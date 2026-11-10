// Testes sem framework: gjs -m tests/run.js  (ou make test)
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Store, looksSecret} from '../gavetta@bcocheto.github.io/store.js';
import {norm, timeAgo} from '../gavetta@bcocheto.github.io/util.js';

let failed = 0;
let passed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        print(`ok   ${name}`);
    } catch (e) {
        failed++;
        print(`FAIL ${name}: ${e.message}`);
    }
}

function eq(actual, expected, msg = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`${msg} esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
}

const tmp = () => GLib.dir_make_tmp('gavetta-test-XXXXXX');
const mode = path => Gio.File.new_for_path(path)
    .query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode') & 0o777;
const readHistory = dir => JSON.parse(new TextDecoder().decode(
    GLib.file_get_contents(`${dir}/history.json`)[1]));

// ── util ──
test('norm remove acentos e caixa', () => {
    eq(norm('Coração'), 'coracao');
    eq(norm('ÁÉÍ'), 'aei');
});

test('timeAgo', () => {
    const now = 1_000_000_000;
    eq(timeAgo(now - 10_000, now), 'agora');
    eq(timeAgo(now - 5 * 60_000, now), 'há 5 min');
    eq(timeAgo(now - 3 * 3_600_000, now), 'há 3 h');
    eq(timeAgo(now - 24 * 3_600_000, now), 'ontem');
    eq(timeAgo(now - 72 * 3_600_000, now), 'há 3 dias');
});

// ── filtro de segredos ──
test('looksSecret pega segredos óbvios', () => {
    for (const s of ['ghp_abcdefghijklmnopqrstuvwxyz0123', 'sk-abcdef1234567890XYZ',
        'AKIAIOSFODNN7EXAMPLE', 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM',
        '-----BEGIN RSA PRIVATE KEY-----\nabc'])
        eq(looksSecret(s), true, s);
});

test('looksSecret deixa texto normal passar', () => {
    for (const s of ['olá mundo', 'https://github.com/x/y', 'sk-learn é uma lib', 'ghp_ curto'])
        eq(looksSecret(s), false, s);
});

// ── Store ──
test('addText grava e deduplica', () => {
    const dir = tmp();
    const s = new Store(10, dir);
    s.addText('a');
    s.addText('b');
    s.addText('a');
    eq(s.items.map(i => i.text).sort(), ['a', 'b']); // ordem depende do relógio (ms)
});

test('link é detectado', () => {
    const s = new Store(10, tmp());
    eq(s.addText('https://exemplo.com/x').type, 'link');
    eq(s.addText('texto').type, 'text');
});

test('limite de histórico ignora fixados', () => {
    const s = new Store(2, tmp());
    const pinned = s.addText('fixo');
    s.togglePin(pinned);
    ['1', '2', '3', '4'].forEach(t => s.addText(t));
    eq(s.items.filter(i => !i.pinned).length, 2);
    eq(s.items.some(i => i.text === 'fixo'), true);
});

test('fixados vêm primeiro; item legado sem pinned não gera NaN', () => {
    const s = new Store(10, tmp());
    s.addText('a');
    s.addText('b');
    delete s.items[0].pinned;
    s.togglePin(s.items.find(i => i.text === 'a'));
    s._sort();
    eq(s.items[0].text, 'a');
});

test('textos acima de 1 MB e imagens acima de 10 MB são ignorados', () => {
    const s = new Store(10, tmp());
    eq(s.addText('x'.repeat(1_000_001)), null);
    eq(s.addImage(new GLib.Bytes(new Uint8Array(10 * 1024 * 1024 + 1))), null);
    eq(s.items.length, 0);
});

test('addFiles tolera % malformado', () => {
    const s = new Store(10, tmp());
    const item = s.addFiles(['file:///tmp/a%zz.png']);
    eq(item.text, 'a%zz.png');
});

test('persistência com flush e permissões privadas', () => {
    const dir = tmp();
    const s = new Store(10, dir);
    s.addText('persistido');
    eq(GLib.file_test(`${dir}/history.json`, GLib.FileTest.EXISTS), false, 'antes do flush');
    s.flush();
    eq(readHistory(dir).items[0].text, 'persistido');
    eq(mode(`${dir}/history.json`), 0o600);
    eq(mode(dir), 0o700);
    eq(new Store(10, dir).items[0].text, 'persistido', 'recarrega');
});

test('imagem é gravada em 0600 e removida ao apagar', () => {
    const dir = tmp();
    const s = new Store(10, dir);
    const item = s.addImage(new GLib.Bytes(new Uint8Array([1, 2, 3])));
    eq(mode(s.imagePath(item)), 0o600);
    s.remove(item);
    eq(GLib.file_test(s.imagePath(item), GLib.FileTest.EXISTS), false);
});

test('JSON corrompido vira .corrupt e a lista começa vazia', () => {
    const dir = tmp();
    GLib.mkdir_with_parents(dir, 0o700);
    GLib.file_set_contents(`${dir}/history.json`, '{quebrado');
    const s = new Store(10, dir);
    eq(s.items.length, 0);
    eq(GLib.file_test(`${dir}/history.json.corrupt`, GLib.FileTest.EXISTS), true);
});

test('entradas malformadas são descartadas na leitura', () => {
    const dir = tmp();
    GLib.mkdir_with_parents(dir, 0o700);
    GLib.file_set_contents(`${dir}/history.json`, JSON.stringify({
        items: [{type: 'text', text: 'ok', hash: 'h1', ts: 1}, {type: 'text'}, null,
            {type: 'file', hash: 'h2', ts: 2}],
        recents: ['😀', 5],
    }));
    const s = new Store(10, dir);
    eq(s.items.map(i => i.hash), ['h1']);
    eq(s.recents, ['😀']);
});

test('clear mantém fixados', () => {
    const s = new Store(10, tmp());
    s.togglePin(s.addText('fica'));
    s.addText('some');
    s.clear();
    eq(s.items.map(i => i.text), ['fica']);
});

print(`\n${passed} passaram, ${failed} falharam`);
imports.system.exit(failed > 0 ? 1 : 0);
