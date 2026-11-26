// Pruebas del login con código de emparejamiento (sin QR).
// Solo Node built-in, sin frameworks. No conecta a WhatsApp real:
// pedirCodigo se prueba con un sock falso.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizarTelefono,
  telefonoPairing,
  pairingHabilitado,
  formatearCodigo,
  pedirCodigo,
} = require('../src/pairing');

test('normalizarTelefono quita +, espacios y guiones', () => {
  assert.equal(normalizarTelefono('+52 656 592-0359'), '526565920359');
  assert.equal(normalizarTelefono('(656) 592 0359'), '6565920359');
  assert.equal(normalizarTelefono(null), '');
});

test('telefonoPairing usa PAIRING_PHONE y cae a OWNER_NUMBER', () => {
  assert.equal(telefonoPairing({ PAIRING_PHONE: '5215512345678', OWNER_NUMBER: '526565920359' }), '5215512345678');
  assert.equal(telefonoPairing({ PAIRING_PHONE: '', OWNER_NUMBER: '+526565920359' }), '526565920359');
  assert.equal(telefonoPairing({ PAIRING_PHONE: '', OWNER_NUMBER: '5210000000000' }), '5210000000000');
});

test('telefonoPairing rechaza números inválidos', () => {
  assert.equal(telefonoPairing({ OWNER_NUMBER: '' }), null);
  assert.equal(telefonoPairing({ OWNER_NUMBER: '123' }), null);
  assert.equal(telefonoPairing({ OWNER_NUMBER: 'abc' }), null);
  assert.equal(telefonoPairing({}), null);
});

test('pairingHabilitado solo prende con USE_PAIRING_CODE', () => {
  assert.equal(pairingHabilitado({ USE_PAIRING_CODE: true }), true);
  assert.equal(pairingHabilitado({ USE_PAIRING_CODE: false }), false);
  assert.equal(pairingHabilitado({}), false);
  assert.equal(pairingHabilitado(null), false);
});

test('formatearCodigo agrupa de 4 en 4', () => {
  assert.equal(formatearCodigo('abcd1234'), 'ABCD-1234');
  assert.equal(formatearCodigo('ab12'), 'AB12');
  assert.equal(formatearCodigo(''), '');
});

test('pedirCodigo llama a Baileys con el número normalizado y formatea', async () => {
  let pedido = null;
  const sockFalso = {
    requestPairingCode: async (numero) => { pedido = numero; return 'abcd1234'; },
  };
  assert.equal(await pedirCodigo(sockFalso, '+52 656 592 0359'), 'ABCD-1234');
  assert.equal(pedido, '526565920359');
});

test('pedirCodigo falla claro si el sock no trae el método o el número es inválido', async () => {
  await assert.rejects(() => pedirCodigo({}, '526565920359'), /requestPairingCode/);
  await assert.rejects(() => pedirCodigo({ requestPairingCode: async () => 'x' }, 'abc'), /inválido/);
});
