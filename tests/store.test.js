// tests/store.test.js — Store local (sin frameworks, solo node:test)
// Aísla todo en data/__test_store.json, que se borra al terminar.
// No toca los datos reales del bot.
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const store = require('../src/store');

const ARCHIVO = '__test_store.json';
const RUTA = path.join(store.DATA_DIR, ARCHIVO);

function limpiar() {
  store.clearCache();
  try { fs.unlinkSync(RUTA); } catch { /* no existía */ }
  for (const f of fs.readdirSync(store.DATA_DIR)) {
    if (f.startsWith(`${ARCHIVO}.corrupt-`)) {
      try { fs.unlinkSync(path.join(store.DATA_DIR, f)); } catch { /* no crítico */ }
    }
  }
}

after(limpiar);

describe('store', () => {
  it('escrituras rápidas seguidas dejan un JSON válido con el último valor', () => {
    limpiar();
    for (let i = 0; i < 50; i++) {
      store.save(ARCHIVO, { users: { a: i } });
    }
    const leido = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    assert.equal(leido.users.a, 49);
    // Sin archivos temporales huérfanos.
    const tmp = fs.readdirSync(store.DATA_DIR).filter(f => f.startsWith(`${ARCHIVO}.`) && f.endsWith('.tmp'));
    assert.equal(tmp.length, 0);
  });

  it('load usa caché: dos loads seguidos devuelven el mismo objeto sin releer el disco', () => {
    limpiar();
    store.save(ARCHIVO, { users: {} });
    const a = store.load(ARCHIVO, { users: {} });
    const b = store.load(ARCHIVO, { users: {} });
    assert.equal(a, b);
  });

  it('un JSON corrupto se aparta y load devuelve el valor por defecto', () => {
    limpiar();
    fs.writeFileSync(RUTA, '{ esto no es json', 'utf8');
    const datos = store.load(ARCHIVO, { users: {} });
    assert.deepEqual(datos, { users: {} });
    const respaldos = fs.readdirSync(store.DATA_DIR).filter(f => f.startsWith(`${ARCHIVO}.corrupt-`));
    assert.equal(respaldos.length, 1);
    limpiar();
  });

  it('saveSoon + flushAll persisten los datos sin escribir en cada llamada', () => {
    limpiar();
    store.saveSoon(ARCHIVO, { users: { x: 1 } }, 5000);
    // Todavía no hay archivo: la escritura está diferida.
    assert.equal(fs.existsSync(RUTA), false);
    store.flushAll();
    assert.equal(fs.existsSync(RUTA), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(RUTA, 'utf8')), { users: { x: 1 } });
    limpiar();
  });
});
