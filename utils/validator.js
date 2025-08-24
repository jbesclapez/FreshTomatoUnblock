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
  
  const min = parseInt(process.env.DEFAULT_TIMEOUT_MINUTES || '1', 10);
  const max = parseInt(process.env.MAX_TIMEOUT_MINUTES || '60', 10);
  
  return num >= min && num <= max;
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

// Validation d'une clé SSH (format basique)
function validateSshKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Vérifier qu'elle commence par un type de clé connu
  const sshKeyRegex = /^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}(\s+.*)?$/;
  return sshKeyRegex.test(key.trim());
}

module.exports = {
  validateMacAddress,
  normalizeMacAddress,
  validateDuration,
  validateIpAddress,
  validateDeviceName,
  sanitizeString,
  validateSshKey
};
