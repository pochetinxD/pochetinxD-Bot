// ============================================
// src/pairing.js — Login con código de emparejamiento (sin QR)
//
// No todo el mundo puede escanear un QR cuando el bot sale a la luz,
// así que con USE_PAIRING_CODE=true Baileys da un código de 8
// caracteres que se mete en:
//   WhatsApp > Dispositivos vinculados > Vincular un dispositivo
//   > Vincular con número de teléfono
//
// La sesión queda guardada en auth_info/ igual que con el QR, así
// que el código solo se pide la primera vez. Sin APIs externas,
// solo Baileys (sock.requestPairingCode).
// ============================================

// Quita +, espacios, guiones y paréntesis. Ej: "+52 656 592 0359" -> "526565920359"
function normalizarTelefono(numero) {
  if (numero == null) return '';
  return String(numero).replace(/[+\s\-().]/g, '');
}

// Número al que va el código: PAIRING_PHONE, o OWNER_NUMBER si está vacío.
// Devuelve null si no hay un número válido (7 a 15 dígitos).
function telefonoPairing(config) {
  const crudo = (config && config.PAIRING_PHONE) || (config && config.OWNER_NUMBER) || '';
  const numero = normalizarTelefono(crudo);
  if (!/^\d{7,15}$/.test(numero)) return null;
  return numero;
}

function pairingHabilitado(config) {
  return !!(config && config.USE_PAIRING_CODE);
}

// "abcd1234" -> "ABCD-1234", para leerlo fácil en la terminal.
function formatearCodigo(codigo) {
  const limpio = String(codigo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (limpio.length <= 4) return limpio;
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

// Pide el código a Baileys. Lanza error si el sock no trae el método
// o el número no es válido; el que llama decide si cae al QR.
async function pedirCodigo(sock, telefono) {
  if (!sock || typeof sock.requestPairingCode !== 'function') {
    throw new Error('Esta versión de Baileys no tiene requestPairingCode');
  }
  const numero = normalizarTelefono(telefono);
  if (!/^\d{7,15}$/.test(numero)) {
    throw new Error('Número inválido para el código de emparejamiento');
  }
  const codigo = await sock.requestPairingCode(numero);
  return formatearCodigo(codigo);
}

module.exports = {
  normalizarTelefono,
  telefonoPairing,
  pairingHabilitado,
  formatearCodigo,
  pedirCodigo,
};
