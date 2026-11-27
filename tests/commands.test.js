// tests/commands.test.js — Los nombres de los comandos no cambian.
// Solo comandos puros (sin disco ni WhatsApp): !ping, !menu, !info,
// !antispam de no-dueño y comando desconocido.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { procesarComando } = require('../src/commands');
const config = require('../config');

describe('comandos (nombres y respuestas básicas)', () => {
  it('!ping responde pong', async () => {
    assert.equal(await procesarComando('!ping', {}), 'pong 🏓');
  });

  it('!menu lista los comandos de grupo, economía y gacha, con foto y canal', async () => {
    const menu = await procesarComando('!menu', {});
    assert.equal(menu.image, config.MENU_IMAGE, 'el menú debe traer la foto del logo');
    const texto = menu.text;
    for (const cmd of ['!kick', '!balance', '!rollwaifu', '!profile', '!tagall', '!antispam', '!canal']) {
      assert.ok(texto.includes(cmd), `el menú debería incluir ${cmd}`);
    }
    assert.ok(texto.includes(config.CHANNEL_URL), 'el menú debe traer el link del canal');
  });

  it('!canal devuelve el link del canal', async () => {
    const r = await procesarComando('!canal', {});
    assert.ok(r.includes(config.CHANNEL_URL), 'debería traer el link del canal');
    assert.ok(r.includes(config.CHANNEL_NAME), 'debería traer el nombre del canal');
  });

  it('!info no muestra el número completo del dueño', async () => {
    const info = await procesarComando('!info', {});
    assert.ok(!info.includes(config.OWNER_NUMBER), 'el número del dueño no debe salir completo');
    assert.ok(info.includes('****'), 'debería salir enmascarado');
  });

  it('!antispam es solo para el dueño', async () => {
    const r = await procesarComando('!antispam', { esDueno: false });
    assert.match(r, /solo para el dueño/);
  });

  it('un comando desconocido sugiere el menú y no rompe nada', async () => {
    const r = await procesarComando('!noexiste123', {});
    assert.match(r, /menu/);
  });

  it('un texto sin prefijo no es un comando', async () => {
    assert.equal(await procesarComando('hola, qué onda', {}), null);
  });
});
