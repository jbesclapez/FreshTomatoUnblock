const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const database = require('./config/database');

// Validation des variables d'environnement critiques
function validateEnvironment() {
  const requiredEnvVars = ['SESSION_SECRET'];
  const productionRequiredVars = ['ADMIN_PASSWORD_HASH'];
  
  // Variables toujours requises
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`❌ Variable d'environnement manquante: ${envVar}`);
    }
  }
  
  // Variables requises en production
  if (process.env.NODE_ENV === 'production') {
    for (const envVar of productionRequiredVars) {
      if (!process.env[envVar]) {
        throw new Error(`❌ Variable d'environnement de production manquante: ${envVar}`);
      }
    }
    
    // Vérifier que ADMIN_PASSWORD n'est pas utilisé en production
    if (process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
      console.warn('⚠️  SÉCURITÉ: ADMIN_PASSWORD détecté en production. Utilisez ADMIN_PASSWORD_HASH à la place.');
    }
  }
  
  // Validation de la longueur de SESSION_SECRET
  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error('❌ SESSION_SECRET doit contenir au moins 32 caractères');
  }
  
  console.log('✅ Validation des variables d\'environnement réussie');
}

// Valider l'environnement au démarrage
validateEnvironment();

// Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      imgSrc: ["'self'", "data:"],
      upgradeInsecureRequests: null, // Disable HTTPS upgrade for local HTTP service
    },
  },
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.FORCE_HTTPS === 'true', // Only require HTTPS if explicitly set
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    sameSite: 'lax' // Protection CSRF
  },
  name: 'freshtomato.sid' // Nom de session personnalisé
}));

// Route de santé pour Docker
app.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        limit: '256MB'
      },
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0'
    };

    // Test database connection
    if (database.getDb()) {
      try {
        database.getDb().prepare('SELECT 1').get();
        healthStatus.database = 'healthy';
      } catch (dbError) {
        healthStatus.database = 'error';
        healthStatus.status = 'WARNING';
      }
    } else {
      healthStatus.database = 'disconnected';
      healthStatus.status = 'ERROR';
    }

    const statusCode = healthStatus.status === 'ERROR' ? 503 : 200;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Route favicon pour éviter les erreurs 404
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Servir les fichiers statiques AVANT les routes pour éviter les conflits
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use(express.static(path.join(__dirname, 'public/user')));

// Routes API (après les fichiers statiques)
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/unblock'));

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Middleware 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    await database.init();
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur FreshTomato Unblock démarré sur le port ${PORT}`);
      console.log(`📱 Interface utilisateur: http://localhost:${PORT}`);
      console.log(`⚙️  Interface admin: http://localhost:${PORT}/admin`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
  console.log('📴 Arrêt du serveur...');
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Arrêt du serveur...');
  await database.close();
  process.exit(0);
});

// Démarrer le serveur
startServer();
