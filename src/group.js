// ============================================
// src/group.js — Comandos de grupo (Baileys, sin APIs externas)
//
// Acciones de admin, avisos y antilink. Todo con la API de
// Baileys y JSON local (data/warns.json, data/antilink.json).
//
// Ojo: !tagall menciona a todos, así que es solo para admins
// y tiene su propio cooldown, no se toca el antispam general.
// ============================================

const { load, save } = require('./store');
const config = require('../config');

const ARCHIVO_AVISOS = 'warns.json';
const ARCHIVO_ANTILINK = 'antilink.json';

// Cooldown de !tagall por grupo (solo en memoria).
const ultimoTagall = new Map();

function numeroDe(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

// Saca el objetivo de un comando: mensaje citado, mención o número escrito.
// Ejemplo: !kick respondiendo un mensaje, !kick @usuario, !kick 5215512345678
function objetivo(msg, args = []) {
  const ctx = msg?.message?.extendedTextMessage?.contextInfo;
  if (ctx?.participant) return ctx.participant;
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];
  const num = (args[0] || '').replace(/\D/g, '');
  if (num.length >= 7) return `${num}@s.whatsapp.net`;
  return null;
}

function tieneLink(texto) {
  return /https?:\/\/[^\s]+|www\.[^\s]+/i.test(texto || '');
}

// ---- Antilink (por grupo) ----

function esAntilinkActivo(jidGrupo) {
  return !!load(ARCHIVO_ANTILINK, { groups: {} }).groups[jidGrupo];
}

function cambiarAntilink(jidGrupo, activo) {
  const e = load(ARCHIVO_ANTILINK, { groups: {} });
  e.groups[jidGrupo] = !!activo;
  save(ARCHIVO_ANTILINK, e);
  return !!activo;
}

// ---- Avisos (warns) ----

function estadoAvisos() {
  return load(ARCHIVO_AVISOS, { groups: {} });
}

function guardarAvisos(e) {
  save(ARCHIVO_AVISOS, e);
}

// Suma un aviso. Al llegar al límite, intenta expulsar (si el bot es admin).
async function advertir(ctx, objetivoJid, motivo) {
  const e = estadoAvisos();
  const gid = ctx.jid;
  e.groups[gid] = e.groups[gid] || {};
  const num = numeroDe(objetivoJid);
  const reg = e.groups[gid][num] || { count: 0, razones: [] };
  reg.count += 1;
  reg.razones.push(motivo);
  e.groups[gid][num] = reg;
  guardarAvisos(e);

  if (reg.count >= config.WARN_LIMIT) {
    if (ctx.isBotAdmin) {
      try {
        await ctx.sock.groupParticipantsUpdate(gid, [objetivoJid], 'remove');
      } catch {
        return `Llegó a ${config.WARN_LIMIT} avisos, pero no pude expulsarlo (¿me quitaron admin?).`;
      }
      delete e.groups[gid][num];
      guardarAvisos(e);
      return { text: `⛔ @${num} llegó a ${config.WARN_LIMIT} avisos y fue expulsado.`, mentions: [objetivoJid] };
    }
    return { text: `⚠️ @${num} llegó a ${config.WARN_LIMIT} avisos, pero no soy admin y no lo puedo expulsar.`, mentions: [objetivoJid] };
  }
  return { text: `⚠️ Aviso ${reg.count}/${config.WARN_LIMIT} para @${num}: ${motivo}`, mentions: [objetivoJid] };
}

function verAvisos(jidGrupo) {
  const lista = estadoAvisos().groups[jidGrupo] || {};
  const entradas = Object.entries(lista);
  if (!entradas.length) return 'Nadie tiene avisos en este grupo. Todo tranqui.';
  const lineas = entradas
    .sort((a, b) => b[1].count - a[1].count)
    .map(([num, r]) => `• @${num}: ${r.count} aviso(s) — último: ${r.razones[r.razones.length - 1] || 'sin motivo'}`);
  return ['⚠️ *Avisos del grupo*', '', ...lineas].join('\n');
}

function quitarAviso(jidGrupo, objetivoJid) {
  const e = estadoAvisos();
  const num = numeroDe(objetivoJid);
  const reg = e.groups[jidGrupo] && e.groups[jidGrupo][num];
  if (!reg) return 'Ese usuario no tiene avisos, we.';
  reg.count -= 1;
  reg.razones.pop();
  if (reg.count <= 0) delete e.groups[jidGrupo][num];
  guardarAvisos(e);
  return { text: `Le quité un aviso a @${num}. Le quedan ${Math.max(0, reg.count)}.`, mentions: [objetivoJid] };
}

// ---- Acciones de admin ----

async function expulsar(ctx, objetivoJid) {
  const num = numeroDe(objetivoJid);
  if (num === numeroDe(ctx.sender)) return 'No te puedes expulsar a ti mismo, we.';
  if (num === config.OWNER_NUMBER) return 'Al dueño no se le expulsa, we.';
  try {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [objetivoJid], 'remove');
    return { text: `👢 Expulsé a @${num} del grupo.`, mentions: [objetivoJid] };
  } catch {
    return 'No pude expulsarlo. Revisa que yo sea admin y que esa persona siga en el grupo.';
  }
}

async function promover(ctx, objetivoJid) {
  const num = numeroDe(objetivoJid);
  try {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [objetivoJid], 'promote');
    return { text: `⬆️ @${num} ahora es admin del grupo.`, mentions: [objetivoJid] };
  } catch {
    return 'No pude promoverlo. Revisa que yo sea admin.';
  }
}

async function degradar(ctx, objetivoJid) {
  const num = numeroDe(objetivoJid);
  if (num === config.OWNER_NUMBER) return 'Al dueño no se le quita nada, we.';
  try {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [objetivoJid], 'demote');
    return { text: `⬇️ @${num} ya no es admin.`, mentions: [objetivoJid] };
  } catch {
    return 'No pude degradarlo. Revisa que yo sea admin.';
  }
}

async function mencionarATodos(ctx) {
  const ahora = Date.now();
  const ultimo = ultimoTagall.get(ctx.jid) || 0;
  const espera = ultimo + config.TAGALL_COOLDOWN_MS - ahora;
  if (espera > 0) return `⏳ Espera ${Math.ceil(espera / 1000)}s para otro tagall, we.`;
  let meta = ctx.metaGrupo;
  if (!meta) meta = await ctx.sock.groupMetadata(ctx.jid);
  const botNum = (ctx.sock.user?.id || '').split('@')[0].split(':')[0];
  const miembros = meta.participants.filter(p => numeroDe(p.id) !== botNum);
  ultimoTagall.set(ctx.jid, ahora);
  const texto = ['📣 *Atención a todos*', '', ...miembros.map(p => `@${numeroDe(p.id)}`)].join('\n');
  return { text: texto, mentions: miembros.map(p => p.id) };
}

async function infoGrupo(ctx) {
  let meta = ctx.metaGrupo;
  if (!meta) meta = await ctx.sock.groupMetadata(ctx.jid);
  const admins = meta.participants.filter(p => p.admin).length;
  const fecha = meta.creation
    ? new Date(meta.creation * 1000).toLocaleDateString('es-MX')
    : 'desconocida';
  const desc = (meta.desc || 'sin descripción').slice(0, 200);
  return [
    `👥 *${meta.subject || 'Grupo'}*`,
    '',
    `Miembros: ${meta.participants.length} (${admins} admins)`,
    `Creado: ${fecha}`,
    `ID: ${meta.id}`,
    '',
    `Descripción: ${desc}`,
  ].join('\n');
}

async function abrirGrupo(ctx) {
  try {
    await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement');
    return '🔓 Grupo abierto: ya todos pueden escribir.';
  } catch {
    return 'No pude abrir el grupo. ¿Soy admin?';
  }
}

async function cerrarGrupo(ctx) {
  try {
    await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement');
    return '🔒 Grupo cerrado: solo los admins pueden escribir.';
  } catch {
    return 'No pude cerrar el grupo. ¿Soy admin?';
  }
}

async function enlaceGrupo(ctx) {
  try {
    const code = await ctx.sock.groupInviteCode(ctx.jid);
    return `🔗 Link del grupo:\nhttps://chat.whatsapp.com/${code}`;
  } catch {
    return 'No pude sacar el link. ¿Soy admin?';
  }
}

module.exports = {
  numeroDe, objetivo, tieneLink,
  esAntilinkActivo, cambiarAntilink,
  advertir, verAvisos, quitarAviso,
  expulsar, promover, degradar,
  mencionarATodos, infoGrupo, abrirGrupo, cerrarGrupo, enlaceGrupo,
};
