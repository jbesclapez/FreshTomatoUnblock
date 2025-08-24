const rateLimit = require('express-rate-limit');

// Rate limiting pour les tentatives de déblocage
const unblockLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 tentatives par minute par IP
  message: {
    error: 'Trop de tentatives de déblocage',
    message: 'Veuillez attendre avant de réessayer',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Identifier par IP
  keyGenerator: (req) => req.ip,
  // Handler personnalisé pour les erreurs
  handler: (req, res) => {
    console.log(`🚫 Rate limit dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de tentatives de déblocage',
      message: 'Veuillez attendre 1 minute avant de réessayer'
    });
  }
});

// Rate limiting pour les tentatives de login admin
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: {
    error: 'Trop de tentatives de connexion',
    message: 'Veuillez attendre 15 minutes avant de réessayer'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne pas compter les connexions réussies
  handler: (req, res) => {
    console.log(`🚫 Rate limit login dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de tentatives de connexion',
      message: 'Veuillez attendre 15 minutes avant de réessayer'
    });
  }
});

// Rate limiting général pour l'API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute par IP
  message: {
    error: 'Trop de requêtes',
    message: 'Limite de requêtes dépassée'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  unblockLimiter,
  loginLimiter,
  apiLimiter
};
