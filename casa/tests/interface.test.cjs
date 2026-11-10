const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function interfaceRuntime({stored, dark = false, blocked = false, backend} = {}) {
  const calls = [], storage = new Map(stored ? [['casa.theme', stored]] : []);
  const themeButtons = [false, true].map(compact => ({textContent: '', attrs: {}, hasAttribute: n => compact && n === 'data-compact', setAttribute(n, v) {this.attrs[n] = v;}}));
  const nodes = {status: {textContent: ''}, pin: {value: 'fixture-only-key'}, login: {classList: {add() {}}}, main: {classList: {remove() {}}}, loginstatus: {textContent: ''}};
  const document = {documentElement: {dataset: {}}, getElementById: n => nodes[n], querySelectorAll: selector => selector === '[data-theme-toggle]' ? themeButtons : []};
  const context = vm.createContext({document, window: {matchMedia: () => ({matches: dark})}, localStorage: {
    getItem: k => {if (blocked) throw Error('Storage blocked'); return storage.get(k) ?? null;},
    setItem: (k, v) => {if (blocked) throw Error('Storage blocked'); storage.set(k, v);}
  }, setInterval() {}, google: {script: {run: {withSuccessHandler(ok) {return {withFailureHandler(fail) {return new Proxy({}, {get: (_, name) => (...args) => {
    calls.push({name, args});
    try {ok(backend ? backend(name, args) : {compras: [], pendientes: [], casa: [], catalogo: [], categorias: []});} catch(e) {fail(e);}
  }});}};}}}}});
  scripts.forEach(s => vm.runInContext(s, context));
  // Rendering and layout are covered separately by browser checks with mock RPCs.
  vm.runInContext('render = () => {}', context);
  return {context, document, storage, calls, themeButtons, nodes, setData: data => vm.runInContext('data=' + JSON.stringify(data), context)};
}

test('theme is usable before login, follows initial system preference, and stores only theme', () => {
  const r = interfaceRuntime({dark: true});
  assert.equal(r.document.documentElement.dataset.theme, 'dark');
  assert.equal(r.themeButtons[0].attrs['aria-pressed'], 'true');
  r.context.toggleTheme();
  assert.equal(r.document.documentElement.dataset.theme, 'light');
  assert.equal(r.themeButtons[0].attrs['aria-label'], 'Activar modo oscuro');
  assert.equal(r.themeButtons[1].textContent, '☾');
  assert.deepEqual([...r.storage], [['casa.theme', 'light']]);
  assert.equal(r.calls.length, 0);
  assert.equal(interfaceRuntime({stored: 'light', dark: true}).document.documentElement.dataset.theme, 'light');
});

test('denied browser storage and invalid stored values never block login or theme switching', async () => {
  const r = interfaceRuntime({blocked: true});
  r.context.toggleTheme();
  assert.equal(r.document.documentElement.dataset.theme, 'dark');
  await r.context.login();
  assert.equal(r.calls[0].name, 'getCasa');
  assert.equal(r.nodes.loginstatus.textContent, '');
  assert.equal(r.storage.size, 0);
  assert.equal(interfaceRuntime({stored: 'invalid'}).document.documentElement.dataset.theme, 'light');
});

test('all three quick buttons use the existing authenticated shopping API', async () => {
  const r = interfaceRuntime();
  await r.context.login();
  for (const name of ['Pan', 'Leche', 'Huevos']) await r.context.quickAdd(name);
  const writes = r.calls.filter(c => c.name === 'changeCasa');
  assert.equal(writes.length, 3);
  assert.deepEqual(writes.map(c => c.args.slice(0, 3)), Array.from({length: 3}, () => ['fixture-only-key', 'compras', 'add']));
  assert.deepEqual(writes.map(c => JSON.parse(JSON.stringify(c.args[3]))), [
    {producto: 'Pan', categoria: 'Alimentos'},
    {producto: 'Leche', categoria: 'Lácteos y huevos'},
    {producto: 'Huevos', categoria: 'Lácteos y huevos'}
  ]);
  assert.equal(r.storage.size, 0);
});

test('quick add ignores pending duplicates and unknown shortcuts; completed products can be added again', async () => {
  const r = interfaceRuntime();
  r.setData({compras: [{producto: ' PAN ', completado: 'false'}]});
  assert.equal(await r.context.quickAdd('Pan'), false);
  assert.equal(await r.context.quickAdd('Unknown'), false);
  assert.equal(r.calls.length, 0);
  r.setData({compras: [{producto: 'Pan', completado: 'true'}]});
  assert.equal(await r.context.quickAdd('Pan'), true);
  assert.equal(r.calls[0].name, 'changeCasa');
});

test('quick add tolerates the original backend response without catalog fields', async () => {
  const r = interfaceRuntime({backend: () => ({compras: [], pendientes: [], casa: []})});
  await r.context.login();
  assert.equal(await r.context.quickAdd('Leche'), true);
  assert.equal(r.nodes.status.textContent, '✓ Leche en tu lista');
});

test('favorite controls retain the existing shared catalog protocol', async () => {
  const r = interfaceRuntime();
  await r.context.login();
  const data = {compras: [], catalogo: [{id: 'base_pan', producto: 'Pan', favorito: 'false'}]};
  r.setData(data);
  await r.context.favoriteProduct(0);
  let call = r.calls.at(-1);
  assert.equal(call.name, 'changeCasaCatalog');
  assert.deepEqual(JSON.parse(JSON.stringify(call.args)), ['fixture-only-key', 'favorite', {id: 'base_pan', favorito: true}]);
  r.setData(data);
  await r.context.quickFavorite(0);
  call = r.calls.at(-1);
  assert.equal(call.name, 'changeCasa');
  assert.deepEqual(JSON.parse(JSON.stringify(call.args)), ['fixture-only-key', 'compras', 'add', {catalogo_id: 'base_pan'}]);
});

test('backend errors remain visible and allow retry without storing the key', async () => {
  const r = interfaceRuntime({backend: () => {throw Error('No se pudo guardar');}});
  assert.equal(await r.context.quickAdd('Huevos'), false);
  assert.equal(r.nodes.status.textContent, 'Error: No se pudo guardar');
  assert.equal(await r.context.quickAdd('Huevos'), false);
  assert.equal(r.calls.length, 2);
  assert.equal(r.storage.size, 0);
});
