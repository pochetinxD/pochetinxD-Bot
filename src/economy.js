// ============================================
// src/economy.js — Economía local (sin APIs, sin dinero real)
//
// Monedas de juego guardadas en data/economy.json.
// Nadie gana ni pierde dinero de verdad: todo es dentro del bot.
// ============================================

const { load, save } = require('./store');
const config = require('../config');

const ARCHIVO = 'economy.json';

// Trabajos inventados para !work. Solo texto, sin API.
const TRABAJOS = [
  'vendiste elotes en la esquina',
  'repartiste paquetes en bici',
  'ayudaste a tu tío en el taller',
  'vendiste limonada en el parque',
  'cuidaste al perro del vecino',
  'lavaste coches en la cuadra',
  'entregaste comida a domicilio',
  'ordenaste el almacén de la tienda',
];

// Tienda local. Los objetos son coleccionables, no dan poderes reales.
const TIENDA = [
  { id: 'cafe', nombre: '☕ Café', precio: 50, desc: 'Para no dormirte farmeando.' },
  { id: 'pocion', nombre: '🧪 Poción', precio: 100, desc: 'Sabe horrible, pero es coleccionable.' },
  { id: 'escudo', nombre: '🛡️ Escudo', precio: 200, desc: 'Brilla bonito. No protege de nada (todavía).' },
  { id: 'gato', nombre: '🐱 Gato', precio: 300, desc: 'Una mascota que solo duerme.' },
  { id: 'espada', nombre: '⚔️ Espada', precio: 500, desc: 'Para presumir en el harem.' },
  { id: 'corona', nombre: '👑 Corona', precio: 1000, desc: 'El objeto más caro de la tienda.' },
];

function estado() {
  return load(ARCHIVO, { users: {} });
}

function guardar(e) {
  save(ARCHIVO, e);
}

function usuario(e, numero) {
  if (!e.users[numero]) {
    e.users[numero] = { coins: config.START_COINS, lastDaily: 0, lastWork: 0, inventario: {} };
  }
  if (!e.users[numero].inventario) e.users[numero].inventario = {};
  return e.users[numero];
}

function aleatorio(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function formatoTiempo(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

function saldo(numero) {
  return usuario(estado(), numero).coins;
}

function textoSaldo(numero) {
  return `💰 Tienes ${saldo(numero)} monedas.`;
}

function daily(numero) {
  const e = estado();
  const u = usuario(e, numero);
  const ahora = Date.now();
  const espera = u.lastDaily + config.DAILY_COOLDOWN_MS - ahora;
  if (espera > 0) return `⏳ Ya cobraste tu diario, we. Vuelve en ${formatoTiempo(espera)}.`;
  const premio = aleatorio(config.DAILY_MIN, config.DAILY_MAX);
  u.coins += premio;
  u.lastDaily = ahora;
  guardar(e);
  return `🎁 Daily cobrado: +${premio} monedas. Ahora tienes ${u.coins}.`;
}

function work(numero) {
  const e = estado();
  const u = usuario(e, numero);
  const ahora = Date.now();
  const espera = u.lastWork + config.WORK_COOLDOWN_MS - ahora;
  if (espera > 0) return `⏳ Descansa tantito, we. Puedes trabajar de nuevo en ${formatoTiempo(espera)}.`;
  const pago = aleatorio(config.WORK_MIN, config.WORK_MAX);
  const trabajo = TRABAJOS[Math.floor(Math.random() * TRABAJOS.length)];
  u.coins += pago;
  u.lastWork = ahora;
  guardar(e);
  return `🔨 Trabajaste: ${trabajo} y ganaste ${pago} monedas. Ahora tienes ${u.coins}.`;
}

function validarApuesta(numero, apuestaRaw) {
  const apuesta = parseInt(apuestaRaw, 10);
  if (!apuestaRaw || isNaN(apuesta) || apuesta <= 0) {
    return { error: 'Pon una apuesta válida, we. Ejemplo: `!coinflip cara 50`.' };
  }
  if (apuesta < config.BET_MIN) return { error: `La apuesta mínima es ${config.BET_MIN} monedas.` };
  if (apuesta > config.BET_MAX) return { error: `La apuesta máxima es ${config.BET_MAX} monedas.` };
  const e = estado();
  const u = usuario(e, numero);
  if (u.coins < apuesta) return { error: `No tienes tantas monedas, we. Tienes ${u.coins}.` };
  return { apuesta, e, u };
}

function coinflip(numero, ladoRaw, apuestaRaw) {
  const lado = (ladoRaw || '').toLowerCase();
  if (lado !== 'cara' && lado !== 'cruz') return 'Usa `!coinflip cara 50` o `!coinflip cruz 50`.';
  const v = validarApuesta(numero, apuestaRaw);
  if (v.error) return v.error;
  const salio = Math.random() < 0.5 ? 'cara' : 'cruz';
  let texto;
  if (salio === lado) {
    v.u.coins += v.apuesta;
    texto = `🪙 Cayó ${salio}. ¡Ganaste ${v.apuesta} monedas! Ahora tienes ${v.u.coins}.`;
  } else {
    v.u.coins -= v.apuesta;
    texto = `🪙 Cayó ${salio}. Perdiste ${v.apuesta} monedas, te quedan ${v.u.coins}.`;
  }
  guardar(v.e);
  return texto;
}

const RODILLO = ['🍒', '🍋', '⭐', '🔔', '🍇', '💎'];

function slot(numero, apuestaRaw) {
  const v = validarApuesta(numero, apuestaRaw);
  if (v.error) return v.error;
  const r = [0, 1, 2].map(() => RODILLO[Math.floor(Math.random() * RODILLO.length)]);
  const linea = r.join(' | ');
  let texto;
  if (r[0] === r[1] && r[1] === r[2]) {
    const premio = v.apuesta * 5;
    v.u.coins += premio;
    texto = `🎰 ${linea}\n¡TRIPLE! Ganaste ${premio} monedas. Ahora tienes ${v.u.coins}.`;
  } else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) {
    const premio = v.apuesta * 2;
    v.u.coins += premio;
    texto = `🎰 ${linea}\n¡Par! Ganaste ${premio} monedas. Ahora tienes ${v.u.coins}.`;
  } else {
    v.u.coins -= v.apuesta;
    texto = `🎰 ${linea}\nNada, we. Perdiste ${v.apuesta} monedas, te quedan ${v.u.coins}.`;
  }
  guardar(v.e);
  return texto;
}

function givecoins(de, para, cantidadRaw) {
  const cantidad = parseInt(cantidadRaw, 10);
  if (!para) return '¿A quién le doy? Menciona a alguien o responde su mensaje. Ejemplo: `!givecoins @usuario 100`.';
  if (!cantidadRaw || isNaN(cantidad) || cantidad <= 0) return 'Pon una cantidad válida. Ejemplo: `!givecoins @usuario 100`.';
  if (cantidad > config.GIVE_MAX) return `No puedes dar más de ${config.GIVE_MAX} monedas de un jalón.`;
  if (de === para) return 'No te puedes dar monedas a ti mismo, we.';
  const e = estado();
  const a = usuario(e, de);
  if (a.coins < cantidad) return `No tienes tantas, we. Tienes ${a.coins} monedas.`;
  const b = usuario(e, para);
  a.coins -= cantidad;
  b.coins += cantidad;
  guardar(e);
  return `💸 Le diste ${cantidad} monedas a @${para}. Te quedan ${a.coins}.`;
}

function tiendaTexto() {
  const lineas = TIENDA.map(i => `• ${i.nombre} — ${i.precio} monedas (\`${config.PREFIX}buy ${i.id}\`)\n  ${i.desc}`);
  return ['🛒 *Tienda*', '', ...lineas, '', `Compra con \`${config.PREFIX}buy <id>\`. Revisa lo tuyo con \`${config.PREFIX}inventory\`.`].join('\n');
}

function comprar(numero, itemIdRaw) {
  const id = (itemIdRaw || '').toLowerCase();
  const item = TIENDA.find(i => i.id === id);
  if (!item) return `Ese artículo no existe, we. Ve la tienda con ${config.PREFIX}shop.`;
  const e = estado();
  const u = usuario(e, numero);
  if (u.coins < item.precio) return `No te alcanza, we. ${item.nombre} cuesta ${item.precio} y tienes ${u.coins}.`;
  u.coins -= item.precio;
  u.inventario[item.id] = (u.inventario[item.id] || 0) + 1;
  guardar(e);
  return `✅ Compraste ${item.nombre} por ${item.precio} monedas. Te quedan ${u.coins}.`;
}

function inventarioTexto(numero) {
  const e = estado();
  const u = usuario(e, numero);
  const items = Object.entries(u.inventario);
  if (!items.length) return `🎒 Tu inventario está vacío. Ve la tienda con ${config.PREFIX}shop.`;
  const lineas = items.map(([id, cant]) => {
    const item = TIENDA.find(i => i.id === id);
    return `• ${item ? item.nombre : id} x${cant}`;
  });
  return ['🎒 *Tu inventario*', '', ...lineas, '', `Monedas: ${u.coins}`].join('\n');
}

function topTexto() {
  const e = estado();
  const lista = Object.entries(e.users)
    .map(([num, u]) => ({ num, coins: u.coins || 0 }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 5);
  if (!lista.length) return 'Nadie tiene monedas todavía. Usa `!daily` para empezar.';
  const lineas = lista.map((u, i) => `${i + 1}. @${u.num} — ${u.coins} monedas`);
  return ['🏆 *Top monedas*', '', ...lineas].join('\n');
}

module.exports = {
  saldo, textoSaldo, daily, work, coinflip, slot, givecoins,
  tiendaTexto, comprar, inventarioTexto, topTexto, TIENDA,
};
