const express = require('express');
const { requireAuth } = require('../middleware/auth');
const deviceService = require('../services/device.service');
const logService = require('../services/log.service');
const sshService = require('../services/ssh.service');
const database = require('../config/database');
const { validateSshKey, validateIpAddress, validateDuration } = require('../utils/validator');
const { ensureOpenSshFormat, detectKeyFormat } = require('../utils/keyConverter');

const router = express.Router();

// Servir la page de login admin (non protégée)
router.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: './public/admin' });
});

// Route pour l'interface admin principale
router.get('/', (req, res) => {
  console.log('🔍 Admin route accessed:', {
    hasSession: !!req.session,
    isAdmin: req.session?.isAdmin,
    sessionId: req.session?.id,
    ip: req.ip
  });
  
  if (!req.session || !req.session.isAdmin) {
    console.log('❌ Redirecting to login - not authenticated');
    return res.redirect('/admin/login.html');
  }
  
  console.log('✅ Serving admin interface');
  res.sendFile('index.html', { root: './public/admin' });
});

// Route explicite pour index.html
router.get('/index.html', (req, res) => {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect('/admin/login.html');
  }
  res.sendFile('index.html', { root: './public/admin' });
});

// Toutes les autres routes admin nécessitent une authentification
router.use('/api', requireAuth);
router.use((req, res, next) => {
  // Rediriger vers login si pas authentifié et que c'est une page HTML
  if (!req.session || !req.session.isAdmin) {
    if (req.path.endsWith('.html')) {
      return res.redirect('/admin/login.html');
    }
    return res.status(401).json({ error: 'Authentification requise' });
  }
  next();
});

// === ROUTES API ADMIN ===

// Dashboard - statistiques générales
router.get('/api/dashboard', async (req, res) => {
  try {
    const [deviceStats, unblockStats] = await Promise.all([
      deviceService.getDeviceStats(),
      logService.getUnblockStats(7)
    ]);
    
    res.json({
      stats: deviceStats,
      unlock_stats: unblockStats
    });
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === GESTION DES APPAREILS ===

// Lister tous les appareils
router.get('/api/devices', async (req, res) => {
  try {
    const devices = await deviceService.getAllDevices();
    res.json({ devices });
  } catch (error) {
    console.error('Erreur récupération appareils:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un appareil
router.post('/api/devices', async (req, res) => {
  try {
    const { name, mac } = req.body;
    
    if (!name || !mac) {
      return res.status(400).json({ error: 'Nom et adresse MAC requis' });
    }
    
    const device = await deviceService.addDevice(name, mac);
    console.log(`➕ Appareil ajouté: ${device.name} (${device.mac}) par admin depuis ${req.ip}`);
    
    res.status(201).json({ device, message: 'Appareil ajouté avec succès' });
  } catch (error) {
    console.error('Erreur ajout appareil:', error);
    res.status(400).json({ error: error.message });
  }
});

// Modifier un appareil
router.put('/api/devices/:id', async (req, res) => {
  try {
    const { name, mac } = req.body;
    const { id } = req.params;
    
    if (!name || !mac) {
      return res.status(400).json({ error: 'Nom et adresse MAC requis' });
    }
    
    const device = await deviceService.updateDevice(id, name, mac);
    console.log(`✏️ Appareil modifié: ${device.name} (${device.mac}) par admin depuis ${req.ip}`);
    
    res.json({ device, message: 'Appareil modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification appareil:', error);
    res.status(400).json({ error: error.message });
  }
});

// Supprimer un appareil
router.delete('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const device = await deviceService.deleteDevice(id);
    
    console.log(`🗑️ Appareil supprimé: ${device.name} (${device.mac}) par admin depuis ${req.ip}`);
    
    res.json({ message: 'Appareil supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression appareil:', error);
    res.status(400).json({ error: error.message });
  }
});

// === CONFIGURATION SSH ===

// Récupérer la configuration
router.get('/api/config', async (req, res) => {
  try {
    const db = database.getDb();
    const stmt = db.prepare('SELECT key, value FROM config');
    const rows = stmt.all();
    
    const config = {};
    rows.forEach(row => {
      config[row.key] = row.value;
    });
    
    res.json({ config });
  } catch (error) {
    console.error('Erreur récupération config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier la configuration
router.post('/api/config', async (req, res) => {
  try {
    const { router_ip, ssh_user, ssh_key, default_timeout_minutes, max_timeout_minutes } = req.body;
    
    // Validation
    if (router_ip && !validateIpAddress(router_ip)) {
      return res.status(400).json({ error: 'Adresse IP routeur invalide' });
    }
    
    if (ssh_key && !validateSshKey(ssh_key)) {
      return res.status(400).json({ error: 'Clé SSH invalide' });
    }
    
    if (default_timeout_minutes && !validateDuration(default_timeout_minutes)) {
      return res.status(400).json({ error: 'Timeout par défaut invalide' });
    }
    
    if (max_timeout_minutes && !validateDuration(max_timeout_minutes)) {
      return res.status(400).json({ error: 'Timeout maximum invalide' });
    }
    
    const db = database.getDb();
    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    
    // Mettre à jour seulement les champs fournis
    const updates = { router_ip, ssh_user, ssh_key, default_timeout_minutes, max_timeout_minutes };
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        stmt.run(key, value);
      }
    }
    
    console.log(`⚙️ Configuration mise à jour par admin depuis ${req.ip}`);
    res.json({ message: 'Configuration mise à jour avec succès' });
    
  } catch (error) {
    console.error('Erreur mise à jour config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === TESTS SSH ===

// Conversion de clé PPK
router.post('/api/convert-key', async (req, res) => {
    try {
        const { keyContent } = req.body;
        
        if (!keyContent) {
            return res.status(400).json({ 
                success: false, 
                message: 'Contenu de clé manquant' 
            });
        }
        
        console.log('🔑 Demande de conversion de clé depuis admin');
        
        const format = detectKeyFormat(keyContent);
        console.log(`Format détecté: ${format}`);
        
        if (format === 'openssh') {
            return res.json({ 
                success: true, 
                convertedKey: keyContent.trim(),
                message: 'Clé déjà au format OpenSSH'
            });
        }
        
        const convertedKey = await ensureOpenSshFormat(keyContent);
        
        res.json({ 
            success: true, 
            convertedKey: convertedKey,
            message: `Clé convertie depuis le format ${format}`
        });
        
    } catch (error) {
        console.error('Erreur conversion clé:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Tester la connexion SSH
router.post('/api/test-ssh', async (req, res) => {
  try {
    console.log(`🔍 Test connexion SSH demandé par admin depuis ${req.ip}`);
    const result = await sshService.testConnection();
    
    res.json(result);
  } catch (error) {
    console.error('Erreur test SSH:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du test de connexion' 
    });
  }
});

// Tester le déblocage d'un appareil
router.post('/api/test-unblock', async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'ID appareil requis' });
    }
    
    const device = await deviceService.getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    console.log(`🧪 Test déblocage demandé pour ${device.name} par admin depuis ${req.ip}`);
    
    const result = await sshService.testUnblock(device.mac, 1);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur test déblocage:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du test de déblocage' 
    });
  }
});

// === LOGS ===

// Récupérer les logs
router.get('/api/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const logs = await logService.getLogs(parseInt(limit), parseInt(offset));
    const totalCount = await logService.getTotalLogsCount();
    
    res.json({ 
      logs, 
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erreur récupération logs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Nettoyer les anciens logs
router.post('/api/cleanup-logs', async (req, res) => {
  try {
    const { days = 90 } = req.body;
    
    const deletedCount = await logService.cleanupOldLogs(days);
    
    console.log(`🧹 Nettoyage logs effectué par admin depuis ${req.ip}: ${deletedCount} entrées supprimées`);
    
    res.json({ 
      message: `${deletedCount} anciens logs supprimés`,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error('Erreur nettoyage logs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === EXPORT/IMPORT CONFIGURATION ===

// Exporter la configuration
router.get('/api/export', async (req, res) => {
  try {
    const devices = await deviceService.getAllDevices();
    
    const db = database.getDb();
    const stmt = db.prepare('SELECT key, value FROM config');
    const rows = stmt.all();
    
    const config = {};
    rows.forEach(row => config[row.key] = row.value);
    
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      config,
      devices
    };
    
    console.log(`📤 Export configuration effectué par admin depuis ${req.ip}`);
    
    res.setHeader('Content-Disposition', 'attachment; filename=freshtomato-unblock-config.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
    
  } catch (error) {
    console.error('Erreur export:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// Importer la configuration
router.post('/api/import', async (req, res) => {
  try {
    const { config, devices, overwrite = false } = req.body;
    
    if (!config && !devices) {
      return res.status(400).json({ error: 'Données d\'import invalides' });
    }
    
    const db = database.getDb();
    let importedCount = 0;
    
    // Importer la configuration
    if (config) {
      const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(config)) {
        stmt.run(key, value);
        importedCount++;
      }
    }
    
    // Importer les appareils
    if (devices && Array.isArray(devices)) {
      for (const device of devices) {
        try {
          if (overwrite) {
            // En mode overwrite, supprimer l'ancien appareil s'il existe
            await deviceService.deleteDevice(device.id).catch(() => {}); // Ignorer si n'existe pas
          }
          await deviceService.addDevice(device.name, device.mac);
          importedCount++;
        } catch (error) {
          console.warn(`Erreur import appareil ${device.name}:`, error.message);
        }
      }
    }
    
    console.log(`📥 Import configuration effectué par admin depuis ${req.ip}: ${importedCount} éléments`);
    
    res.json({ 
      message: 'Import terminé avec succès',
      imported_count: importedCount
    });
    
  } catch (error) {
    console.error('Erreur import:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import' });
  }
});

module.exports = router;
