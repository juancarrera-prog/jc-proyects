const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// In-memory Apps Script services. This key is a fixture, never a real CASA_PIN.
const TEST_PIN = 'only-a-test-key';
function createRuntime(pin = TEST_PIN) {
  let uid = 0, locked = false, reads = 0;
  const sheets = new Map();
  const writes = [];
  const display = v => String(v ?? '').replace(/^'/, '');
  function sheet(name, initial = []) {
    const s = {
      values: initial.map(r => r.slice()),
      getDataRange() { return {getDisplayValues: () => s.values.length ? s.values.map(r => r.map(display)) : [['']]}; },
      getLastRow() { return s.values.length; },
      appendRow(values) { writes.push({name, values: values.slice()}); s.values.push(values.slice()); },
      getRange(row, col, count, width) {
        return {setValues(values) {
          if (values.length !== count || values.some(r => r.length !== width)) throw Error('Range size mismatch');
          writes.push({name, values: values.flat()});
          values.forEach((r, i) => { const dest = s.values[row - 1 + i] ||= []; r.forEach((v, j) => dest[col - 1 + j] = v); });
        }};
      },
      deleteRow(row) { s.values.splice(row - 1, 1); },
      deleteRows(row, count) { s.values.splice(row - 1, count); }
    };
    sheets.set(name, s);
    return s;
  }
  const book = {getSheetByName: name => sheets.get(name) || null, insertSheet: name => {if (sheets.has(name)) throw Error('Duplicate sheet'); return sheet(name);}};
  const context = vm.createContext({
    PropertiesService: {getScriptProperties: () => ({getProperty: () => pin, setProperty: (_, value) => {pin = value;}})},
    SpreadsheetApp: {openById() {reads++; return book;}, flush() {if (!locked) throw Error('Flush must happen before lock release');}},
    Utilities: {getUuid: () => 'test-product-' + ++uid},
    LockService: {getScriptLock: () => ({waitLock() {if (locked) throw Error('Overlapping write'); locked = true;}, releaseLock() {locked = false;}})}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), context);
  for (const [type, name] of Object.entries(vm.runInContext('CASA_TABS', context))) sheet(name, [Array.from(vm.runInContext('CASA_HEADERS', context)[type])]);
  return {context, sheets, sheet, writes, get reads() {return reads;}, get locked() {return locked;}, call(name, ...args) {
    if (!['getCasa', 'changeCasa', 'changeCasaCatalog'].includes(name)) throw Error('Unknown RPC');
    return JSON.parse(JSON.stringify(context[name](...args)));
  }};
}
module.exports = {createRuntime, TEST_PIN};
