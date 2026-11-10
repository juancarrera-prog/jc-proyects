const test = require('node:test');
const assert = require('node:assert/strict');
const {createRuntime, TEST_PIN: PIN} = require('./apps-script-mock.cjs');

test('reads catalog without changing existing sheets, list, or secret', () => {
  const r = createRuntime();
  const data = r.call('getCasa', PIN);
  assert.equal(data.catalogo.length, 65);
  assert.equal(data.categorias.length, 8);
  assert.equal(new Set(data.catalogo.map(p => p.id)).size, data.catalogo.length);
  assert.ok(data.catalogo.some(p => p.producto === 'Shampoo'));
  assert.ok(data.catalogo.some(p => p.producto === 'Papel higiénico'));
  assert.equal(data.compras.length, 0);
  assert.equal(r.sheets.size, 3);
  assert.equal(r.writes.length, 0);
});

test('all public data operations require the unchanged exact key', () => {
  const r = createRuntime('0012Ab!xyz');
  for (const name of ['getCasa', 'changeCasa', 'changeCasaCatalog']) assert.throws(() => r.call(name, 'bad', 'add', {}), /Clave incorrecta/);
  assert.equal(r.reads, 0);
  assert.equal(r.call('getCasa', '0012Ab!xyz').catalogo.length, 65);
  assert.throws(() => r.call('getCasa', '12Ab!xyz'), /Clave incorrecta/);
});

test('favorites persist between independent callers and survive list clearing', () => {
  const r = createRuntime();
  const p = r.call('getCasa', PIN).catalogo.find(p => p.producto === 'Pan');
  r.call('changeCasaCatalog', PIN, 'favorite', {id: p.id, favorito: true});
  assert.equal(r.sheets.size, 4);
  assert.equal(r.call('getCasa', PIN).catalogo.find(x => x.id === p.id).favorito, 'true');
  r.call('changeCasa', PIN, 'compras', 'add', {catalogo_id: p.id});
  r.call('changeCasa', PIN, 'compras', 'clearAll', {});
  assert.equal(r.call('getCasa', PIN).catalogo.find(x => x.id === p.id).favorito, 'true');
  r.call('changeCasaCatalog', PIN, 'favorite', {id: p.id, favorito: false});
  assert.equal(r.call('getCasa', PIN).catalogo.find(x => x.id === p.id).favorito, 'false');
  assert.equal(r.sheets.get('CASA_Productos').values.length, 2);
});

test('custom products retain section and favorites on subsequent loads', () => {
  const r = createRuntime();
  r.call('changeCasaCatalog', PIN, 'add', {producto: '  Bolsas   para freezer  ', categoria: 'Limpieza'});
  const p = r.call('getCasa', PIN).catalogo.find(x => x.producto === 'Bolsas para freezer');
  assert.equal(p.propio, true);
  assert.equal(p.categoria, 'Limpieza');
  assert.equal(r.call('getCasa', PIN).compras.length, 0);
  r.call('changeCasaCatalog', PIN, 'favorite', {id: p.id, favorito: true});
  const data = r.call('changeCasa', PIN, 'compras', 'add', {catalogo_id: p.id, producto: 'spoof', categoria: 'spoof'});
  assert.equal(data.compras[0].producto, 'Bolsas para freezer');
  assert.equal(data.compras[0].categoria, 'Limpieza');
  assert.equal(data.catalogo.find(x => x.id === p.id).favorito, 'true');
});

test('custom product validation rejects duplicates, unknown categories and invalid favorites', () => {
  const r = createRuntime();
  for (const producto of [' pan ', 'PAPEL HIGIENICO', 'ATÚN']) assert.throws(() => r.call('changeCasaCatalog', PIN, 'add', {producto, categoria: 'Otros'}), /ya está/);
  for (const producto of ['', ' ', 'a'.repeat(181)]) assert.throws(() => r.call('changeCasaCatalog', PIN, 'add', {producto, categoria: 'Otros'}), /nombre/);
  assert.throws(() => r.call('changeCasaCatalog', PIN, 'add', {producto: 'Nuevo', categoria: '__proto__'}), /Sección inválida/);
  assert.throws(() => r.call('changeCasaCatalog', PIN, 'favorite', {id: 'base_pan', favorito: 'false'}), /Favorito inválido/);
  assert.throws(() => r.call('changeCasaCatalog', PIN, 'favorite', {id: 'missing', favorito: true}), /no encontrado/);
  assert.throws(() => r.call('changeCasaCatalog', PIN, 'delete', {}), /Acción inválida/);
  assert.equal(r.locked, false);
  assert.equal(r.sheets.size, 3);
});

test('duplicate adds from two callers are idempotent, completed products are reactivated', () => {
  const r = createRuntime();
  r.call('changeCasa', PIN, 'compras', 'add', {producto: 'Papel higiénico', cantidad: '2'});
  r.call('changeCasa', PIN, 'compras', 'add', {producto: ' PAPEL HIGIENICO '});
  let state = r.call('getCasa', PIN);
  assert.equal(state.compras.length, 1);
  const id = state.compras[0].id;
  r.call('changeCasa', PIN, 'compras', 'update', {id, completado: 'true'});
  state = r.call('changeCasa', PIN, 'compras', 'add', {catalogo_id: 'base_papel_higienico'});
  assert.equal(state.compras.length, 1);
  assert.equal(state.compras[0].id, id);
  assert.equal(state.compras[0].completado, 'false');
  assert.equal(state.compras[0].cantidad, '2');
  assert.equal(r.locked, false);
});

test('literal product names never become spreadsheet formulas', () => {
  const r = createRuntime();
  for (const producto of ['=1+1', '+Especial', '-Especial', '@Especial', "'Especial"]) {
    const data = r.call('changeCasaCatalog', PIN, 'add', {producto, categoria: 'Otros'});
    const p = data.catalogo.find(x => x.producto === producto);
    assert.ok(p);
    r.call('changeCasa', PIN, 'compras', 'add', {catalogo_id: p.id});
    r.call('changeCasaCatalog', PIN, 'favorite', {id: p.id, favorito: true});
  }
  assert.ok(r.writes.every(w => w.values.every(v => typeof v !== 'string' || !/^[=+\-@]/.test(v))));
});

test('existing list operations work with blank sheet rows; catalog headers are never overwritten', () => {
  const r = createRuntime();
  const s = r.sheets.get('CASA_Compras');
  s.values.push([]);
  let state = r.call('changeCasa', PIN, 'compras', 'add', {producto: 'Pan'});
  const id = state.compras[0].id;
  r.call('changeCasa', PIN, 'compras', 'update', {id, completado: 'true'});
  state = r.call('changeCasa', PIN, 'compras', 'add', {producto: 'Pan'});
  assert.equal(state.compras[0].completado, 'false');
  r.call('changeCasa', PIN, 'compras', 'delete', {id});
  assert.equal(r.call('getCasa', PIN).compras.length, 0);
  r.sheet('CASA_Productos', [['mis datos']]);
  assert.throws(() => r.call('changeCasaCatalog', PIN, 'add', {producto: 'Nuevo', categoria: 'Otros'}), /encabezados/);
  assert.equal(r.sheets.get('CASA_Productos').values[0][0], 'mis datos');
  assert.equal(r.locked, false);
});

test('pending tasks and home priorities retain their current behavior', () => {
  const r = createRuntime();
  let data = r.call('changeCasa', PIN, 'pendientes', 'add', {tarea: 'Turno', fecha: '2026-12-01'});
  assert.equal(data.pendientes[0].fecha, '2026-12-01');
  data = r.call('changeCasa', PIN, 'pendientes', 'update', {id: data.pendientes[0].id, completado: 'true'});
  assert.equal(data.pendientes[0].completado, 'true');
  data = r.call('changeCasa', PIN, 'casa', 'add', {tarea: 'Arreglar canilla', prioridad: 'rojo'});
  assert.equal(data.casa[0].prioridad, 'rojo');
  assert.throws(() => r.call('changeCasa', PIN, '__proto__', 'add', {}), /Sección inválida/);
});
