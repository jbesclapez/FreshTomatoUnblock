const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const database = require('./config/database');

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
    secure: false, // Set to false for localhost testing
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
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
