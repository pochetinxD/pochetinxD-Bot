// Pruebas de la comparación de identidades (LID vs número normal).
// Solo Node built-in, sin frameworks. No conecta a WhatsApp real:
// se prueba con participantes falsos con la misma forma que los de
// Baileys 6.7.24 (Contact: id, lid?, jid?).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  digitosDe,
  identidadesDe,
  mismaIdentidad,
  buscarParticipante,
  numeroTelefonoDe,
} = require('../src/groupmeta');

const TELEFONO = '526565920359';
const LID = '123456789012345';
const JID_TELEFONO = `${TELEFONO}@s.whatsapp.net`;
const JID_LID = `${LID}@lid`;

// Un participante como lo manda Baileys en un grupo con @lid:
// id en formato lid, pero con el jid (teléfono) al lado.
const participanteLid = { id: JID_LID, lid: JID_LID, jid: JID_TELEFONO, admin: 'admin' };
const participantePn = { id: JID_TELEFONO, jid: JID_TELEFONO, admin: null };
const participanteSoloLid = { id: JID_LID, lid: JID_LID };
const participantes = [participanteLid, participantePn];

test('digitosDe quita el dominio y el sufijo :dispositivo', () => {
  assert.equal(digitosDe(JID_TELEFONO), TELEFONO);
  assert.equal(digitosDe('5215512345678:12@s.whatsapp.net'), '5215512345678');
  assert.equal(digitosDe(JID_LID), LID);
  assert.equal(digitosDe(null), '');
  assert.equal(digitosDe(''), '');
});

test('digitosDe en un participante prefiere el teléfono sobre el lid', () => {
  assert.equal(digitosDe(participanteLid), TELEFONO);
  assert.equal(digitosDe(participanteSoloLid), LID);
});

test('identidadesDe junta teléfono y lid del participante', () => {
  assert.deepEqual(identidadesDe(participanteLid), [TELEFONO, LID]);
  assert.deepEqual(identidadesDe(JID_TELEFONO), [TELEFONO]);
  assert.deepEqual(identidadesDe(null), []);
});

test('mismaIdentidad: mismo número en distintos formatos', () => {
  assert.equal(mismaIdentidad(JID_TELEFONO, TELEFONO), true);
  assert.equal(mismaIdentidad(TELEFONO, JID_TELEFONO), true);
  assert.equal(mismaIdentidad('5215512345678:3@s.whatsapp.net', '5215512345678'), true);
});

test('mismaIdentidad: un @lid solo NO es el número de teléfono', () => {
  // Los dígitos del lid son distintos a los del teléfono: sin el
  // puente (el participante con jid + lid) no se pueden igualar.
  assert.equal(mismaIdentidad(JID_LID, JID_TELEFONO), false);
  assert.equal(mismaIdentidad(JID_LID, TELEFONO), false);
});

test('mismaIdentidad: el participante con jid + lid sí iguala al teléfono', () => {
  assert.equal(mismaIdentidad(participanteLid, JID_TELEFONO), true);
  assert.equal(mismaIdentidad(participanteLid, TELEFONO), true);
  assert.equal(mismaIdentidad(participanteLid, JID_LID), true);
  assert.equal(mismaIdentidad(participanteSoloLid, JID_TELEFONO), false);
  assert.equal(mismaIdentidad(participanteSoloLid, JID_LID), true);
});

test('mismaIdentidad: números distintos no coinciden, ni vacíos', () => {
  assert.equal(mismaIdentidad(JID_TELEFONO, '5215512345678@s.whatsapp.net'), false);
  assert.equal(mismaIdentidad(participanteLid, '5215512345678@s.whatsapp.net'), false);
  assert.equal(mismaIdentidad(null, JID_TELEFONO), false);
  assert.equal(mismaIdentidad('', ''), false);
  assert.equal(mismaIdentidad(undefined, undefined), false);
});

test('mismaIdentidad: usa participantPn / senderPn del mensaje', () => {
  const claveLid = { participant: JID_LID, participantPn: JID_TELEFONO };
  assert.equal(mismaIdentidad(claveLid, TELEFONO), true);
  const clavePn = { remoteJid: JID_LID, senderPn: JID_TELEFONO };
  assert.equal(mismaIdentidad(clavePn, JID_TELEFONO), true);
});

test('buscarParticipante encuentra al admin aunque el grupo use @lid', () => {
  const porTelefono = buscarParticipante(participantes, JID_TELEFONO);
  assert.equal(porTelefono.admin, 'admin');
  const porLid = buscarParticipante(participantes, JID_LID);
  assert.equal(porLid.admin, 'admin');
  assert.equal(buscarParticipante(participantes, '5215512345678@s.whatsapp.net'), null);
  assert.equal(buscarParticipante([], JID_TELEFONO), null);
  assert.equal(buscarParticipante(null, JID_TELEFONO), null);
});

test('numeroTelefonoDe resuelve el teléfono desde el participante', () => {
  assert.equal(numeroTelefonoDe(participanteLid), TELEFONO);
  assert.equal(numeroTelefonoDe(JID_LID, participantes), TELEFONO);
  assert.equal(numeroTelefonoDe(JID_TELEFONO), TELEFONO);
  // Solo @lid y sin participantes: no hay forma de saber el número.
  assert.equal(numeroTelefonoDe(JID_LID), '');
  assert.equal(numeroTelefonoDe(JID_LID, []), '');
});
