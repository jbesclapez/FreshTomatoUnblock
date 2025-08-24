const express = require('express');
const { verifyAdminPassword } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const router = express.Router();

// Route de connexion admin
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    const isValid = await verifyAdminPassword(password);
    
    if (isValid) {
      req.session.isAdmin = true;
      console.log(`🔐 Connexion admin réussie depuis ${req.ip}`);
      res.json({ success: true, message: 'Connexion réussie' });
    } else {
      console.log(`🚫 Tentative connexion admin échouée depuis ${req.ip}`);
      res.status(401).json({ error: 'Mot de passe incorrect' });
    }
  } catch (error) {
    console.error('Erreur connexion admin:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Route de déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur déconnexion:', err);
      return res.status(500).json({ error: 'Erreur déconnexion' });
    }
    
    console.log(`🔒 Déconnexion admin depuis ${req.ip}`);
    res.json({ success: true, message: 'Déconnexion réussie' });
  });
});

// Vérifier le statut de connexion
router.get('/status', (req, res) => {
  res.json({ 
    isAuthenticated: !!req.session.isAdmin,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
