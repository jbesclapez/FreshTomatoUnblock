const express = require('express');
const sshService = require('../services/ssh.service');
const deviceService = require('../services/device.service');
const logService = require('../services/log.service');
const { unblockLimiter, apiLimiter } = require('../middleware/rateLimit');
const { validateMacAddress, validateDuration, normalizeMacAddress } = require('../utils/validator');
const database = require('../config/database');

const router = express.Router();

// Appliquer le rate limiting général à toutes les routes
router.use(apiLimiter);

// Route pour récupérer la liste des appareils (pour l'interface utilisateur)
router.get('/devices', async (req, res) => {
  try {
    const devices = await deviceService.getAllDevices();
    res.json({ devices });
  } catch (error) {
    console.error('Erreur récupération appareils:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour récupérer les paramètres de timeout
router.get('/config', async (req, res) => {
  try {
    const db = database.getDb();
    const stmt = db.prepare('SELECT key, value FROM config WHERE key IN (?, ?)');
    const rows = stmt.all('default_timeout_minutes', 'max_timeout_minutes');
    
    const config = {};
    rows.forEach(row => {
      config[row.key] = parseInt(row.value, 10);
    });
    
    res.json({
      default_timeout: config.default_timeout_minutes || 1,
      max_timeout: config.max_timeout_minutes || 60
    });
  } catch (error) {
    console.error('Erreur récupération config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour débloquer un appareil
router.post('/unblock', unblockLimiter, async (req, res) => {
  try {
    const { deviceId, duration } = req.body;
    const sourceIp = req.ip || req.connection.remoteAddress;
    
    // Validation des paramètres
    if (!deviceId) {
      return res.status(400).json({ error: 'ID appareil requis' });
    }
    
    if (!duration || !validateDuration(duration)) {
      return res.status(400).json({ error: 'Durée invalide' });
    }
    
    // Récupérer l'appareil
    const device = await deviceService.getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    // Débloquer l'appareil via SSH
    const result = await sshService.unblockDevice(device.mac, duration);
    
    if (result.success) {
      // Enregistrer le log
      await logService.logUnblock(deviceId, sourceIp, duration);
      
      console.log(`✅ Déblocage réussi: ${device.name} (${device.mac}) pour ${duration}min depuis ${sourceIp}`);
      
      res.json({
        success: true,
        message: `${device.name} a été débloqué pour ${duration} minute(s)`,
        device: {
          id: device.id,
          name: device.name,
          mac: device.mac
        },
        duration: duration
      });
    } else {
      console.log(`❌ Échec déblocage: ${device.name} (${device.mac}) depuis ${sourceIp} - ${result.message}`);
      res.status(500).json({
        error: 'Échec du déblocage',
        message: 'Une erreur est survenue lors du déblocage. Veuillez réessayer.'
      });
    }
    
  } catch (error) {
    console.error('Erreur déblocage:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue. Veuillez réessayer.'
    });
  }
});

// Route pour débloquer par MAC (alternative pour liens directs)
router.post('/unblock-mac', unblockLimiter, async (req, res) => {
  try {
    const { mac, duration } = req.body;
    const sourceIp = req.ip || req.connection.remoteAddress;
    
    // Validation
    if (!mac || !validateMacAddress(mac)) {
      return res.status(400).json({ error: 'Adresse MAC invalide' });
    }
    
    if (!duration || !validateDuration(duration)) {
      return res.status(400).json({ error: 'Durée invalide' });
    }
    
    const normalizedMac = normalizeMacAddress(mac);
    
    // Rechercher l'appareil par MAC
    const device = await deviceService.getDeviceByMac(normalizedMac);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    // Débloquer l'appareil
    const result = await sshService.unblockDevice(normalizedMac, duration);
    
    if (result.success) {
      // Enregistrer le log
      await logService.logUnblock(device.id, sourceIp, duration);
      
      console.log(`✅ Déblocage MAC réussi: ${device.name} (${normalizedMac}) pour ${duration}min depuis ${sourceIp}`);
      
      res.json({
        success: true,
        message: `${device.name} a été débloqué pour ${duration} minute(s)`,
        device: {
          id: device.id,
          name: device.name,
          mac: device.mac
        },
        duration: duration
      });
    } else {
      res.status(500).json({
        error: 'Échec du déblocage',
        message: 'Une erreur est survenue lors du déblocage.'
      });
    }
    
  } catch (error) {
    console.error('Erreur déblocage MAC:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue.'
    });
  }
});

// Route pour récupérer un appareil spécifique (pour pages dédiées)
router.get('/device/:id', async (req, res) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id);
    
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    // Récupérer les derniers logs pour cet appareil
    const logs = await logService.getLogsByDevice(device.id, 10);
    
    res.json({
      device,
      recent_logs: logs
    });
  } catch (error) {
    console.error('Erreur récupération appareil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
