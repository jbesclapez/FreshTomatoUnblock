// Authentification simplifiée sans bcrypt pour Docker

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

// Vérifier le mot de passe admin (version simplifiée)
async function verifyAdminPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD non configuré');
  }
  
  // Comparaison directe pour simplifier (production: utiliser bcrypt)
  return password === adminPassword;
}

// Hash un mot de passe (version simplifiée)
async function hashPassword(password) {
  // Pour la production, utiliser bcrypt
  return password;
}

module.exports = {
  requireAuth,
  verifyAdminPassword,
  hashPassword
};
