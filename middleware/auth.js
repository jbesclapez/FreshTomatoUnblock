// Authentification sécurisée avec bcrypt
const bcrypt = require('bcrypt');

// Middleware d'authentification admin
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  // Si c'est une requête API, retourner JSON
  if (req.path.startsWith('/admin/api') || req.headers['content-type']?.includes('application/json')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  // Sinon rediriger vers la page de login
  res.redirect('/admin/login.html');
}

// Vérifier le mot de passe admin avec bcrypt
async function verifyAdminPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  
  if (!adminPassword && !adminPasswordHash) {
    throw new Error('ADMIN_PASSWORD ou ADMIN_PASSWORD_HASH doit être configuré');
  }
  
  // Si on a un hash, l'utiliser pour la vérification sécurisée
  if (adminPasswordHash) {
    try {
      return await bcrypt.compare(password, adminPasswordHash);
    } catch (error) {
      console.error('Erreur vérification bcrypt:', error);
      return false;
    }
  }
  
  // Fallback pour la compatibilité ascendante (développement uniquement)
  if (process.env.NODE_ENV === 'development' && adminPassword) {
    console.warn('⚠️  SÉCURITÉ: Utilisation du mot de passe en clair - configurez ADMIN_PASSWORD_HASH pour la production');
    return password === adminPassword;
  }
  
  throw new Error('Configuration sécurité incomplète - ADMIN_PASSWORD_HASH requis en production');
}

// Hash un mot de passe avec bcrypt
async function hashPassword(password) {
  const saltRounds = 12; // Sécurité renforcée
  return await bcrypt.hash(password, saltRounds);
}

// Générer un hash pour un mot de passe (utilitaire)
async function generatePasswordHash(password) {
  const hash = await hashPassword(password);
  console.log(`Hash bcrypt pour le mot de passe: ${hash}`);
  console.log(`Ajoutez cette ligne à votre .env: ADMIN_PASSWORD_HASH=${hash}`);
  return hash;
}

module.exports = {
  requireAuth,
  verifyAdminPassword,
  hashPassword,
  generatePasswordHash
};
