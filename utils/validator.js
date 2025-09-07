// Validation d'une adresse MAC
function validateMacAddress(mac) {
  if (!mac || typeof mac !== 'string') {
    return false;
  }
  
  // Format attendu: xx:xx:xx:xx:xx:xx (avec des lettres en majuscules ou minuscules)
  const macRegex = /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

// Normaliser une adresse MAC (mettre en majuscules)
function normalizeMacAddress(mac) {
  if (!validateMacAddress(mac)) {
    throw new Error('Format d\'adresse MAC invalide');
  }
  return mac.toUpperCase();
}

// Validation de la durée en minutes
function validateDuration(minutes) {
  const num = parseInt(minutes, 10);
  
  if (isNaN(num)) {
    return false;
  }
  
  // Validation de base: entre 1 et 1440 minutes (24 heures max)
  return num >= 1 && num <= 1440;
}

// Validation de la durée avec configuration de la base de données
async function validateDurationWithConfig(minutes) {
  const num = parseInt(minutes, 10);
  
  if (isNaN(num)) {
    return false;
  }
  
  try {
    const database = require('../config/database');
    const db = database.getDb();
    const stmt = db.prepare('SELECT value FROM config WHERE key IN (?, ?)');
    const rows = stmt.all('default_timeout_minutes', 'max_timeout_minutes');
    
    let min = 1;
    let max = 60;
    
    rows.forEach(row => {
      if (row.key === 'default_timeout_minutes') {
        min = parseInt(row.value, 10) || 1;
      } else if (row.key === 'max_timeout_minutes') {
        max = parseInt(row.value, 10) || 60;
      }
    });
    
    return num >= min && num <= max;
  } catch (error) {
    // Fallback vers validation de base si erreur DB
    return num >= 1 && num <= 60;
  }
}

// Validation d'une adresse IP
function validateIpAddress(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// Validation d'un nom d'appareil
function validateDeviceName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Nom entre 1 et 50 caractères, lettres, chiffres, espaces, tirets et underscores
  const nameRegex = /^[a-zA-Z0-9\s\-_]{1,50}$/;
  return nameRegex.test(name.trim());
}

// Nettoyer et valider une chaîne générique
function sanitizeString(str, maxLength = 255) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str.trim().substring(0, maxLength);
}

// Validation d'une clé SSH (publique ou privée)
function validateSshKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  const trimmed = key.trim();
  
  // Clé publique SSH (ssh-rsa, ssh-ed25519, etc.)
  const publicKeyRegex = /^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}(\s+.*)?$/;
  
  // Clé privée OpenSSH
  const opensshPrivateKeyRegex = /^-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*-----END OPENSSH PRIVATE KEY-----$/;
  
  // Clé privée PEM traditionnelle
  const pemPrivateKeyRegex = /^-----BEGIN (RSA )?PRIVATE KEY-----[\s\S]*-----END (RSA )?PRIVATE KEY-----$/;
  
  // Clé privée PKCS#8
  const pkcs8PrivateKeyRegex = /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/;
  
  // Clé privée EC
  const ecPrivateKeyRegex = /^-----BEGIN EC PRIVATE KEY-----[\s\S]*-----END EC PRIVATE KEY-----$/;
  
  return publicKeyRegex.test(trimmed) || 
         opensshPrivateKeyRegex.test(trimmed) || 
         pemPrivateKeyRegex.test(trimmed) ||
         pkcs8PrivateKeyRegex.test(trimmed) ||
         ecPrivateKeyRegex.test(trimmed);
}

module.exports = {
  validateMacAddress,
  normalizeMacAddress,
  validateDuration,
  validateDurationWithConfig,
  validateIpAddress,
  validateDeviceName,
  sanitizeString,
  validateSshKey
};
