const database = require('../config/database');
const { validateDeviceName, validateMacAddress, normalizeMacAddress } = require('../utils/validator');

class DeviceService {
  // Récupérer tous les appareils
  async getAllDevices() {
    try {
      const db = database.getDb();
      const stmt = db.prepare('SELECT * FROM devices ORDER BY name ASC');
      return stmt.all();
    } catch (error) {
      throw error;
    }
  }

  // Récupérer un appareil par ID
  async getDeviceById(id) {
    try {
      const db = database.getDb();
      const stmt = db.prepare('SELECT * FROM devices WHERE id = ?');
      return stmt.get(id);
    } catch (error) {
      throw error;
    }
  }

  // Récupérer un appareil par MAC
  async getDeviceByMac(mac) {
    try {
      const db = database.getDb();
      const normalizedMac = normalizeMacAddress(mac);
      const stmt = db.prepare('SELECT * FROM devices WHERE mac = ?');
      return stmt.get(normalizedMac);
    } catch (error) {
      throw error;
    }
  }

  // Ajouter un appareil
  async addDevice(name, mac) {
    if (!validateDeviceName(name)) {
      throw new Error('Nom d\'appareil invalide (1-50 caractères, lettres, chiffres, espaces, tirets et underscores)');
    }
    
    if (!validateMacAddress(mac)) {
      throw new Error('Adresse MAC invalide (format: xx:xx:xx:xx:xx:xx)');
    }
    
    const normalizedMac = normalizeMacAddress(mac);
    const trimmedName = name.trim();
    
    try {
      const db = database.getDb();
      const stmt = db.prepare('INSERT INTO devices (name, mac) VALUES (?, ?)');
      const result = stmt.run(trimmedName, normalizedMac);
      
      return {
        id: result.lastInsertRowid,
        name: trimmedName,
        mac: normalizedMac,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Cette adresse MAC existe déjà');
      }
      throw error;
    }
  }

  // Modifier un appareil
  async updateDevice(id, name, mac) {
    if (!validateDeviceName(name)) {
      throw new Error('Nom d\'appareil invalide');
    }
    
    if (!validateMacAddress(mac)) {
      throw new Error('Adresse MAC invalide');
    }
    
    const normalizedMac = normalizeMacAddress(mac);
    const trimmedName = name.trim();
    
    try {
      const db = database.getDb();
      const stmt = db.prepare('UPDATE devices SET name = ?, mac = ? WHERE id = ?');
      const result = stmt.run(trimmedName, normalizedMac, id);
      
      if (result.changes === 0) {
        throw new Error('Appareil non trouvé');
      }
      
      return {
        id: parseInt(id),
        name: trimmedName,
        mac: normalizedMac
      };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Cette adresse MAC existe déjà');
      }
      throw error;
    }
  }

  // Supprimer un appareil
  async deleteDevice(id) {
    try {
      const db = database.getDb();
      
      // Vérifier que l'appareil existe
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        throw new Error('Appareil non trouvé');
      }
      
      // Supprimer l'appareil
      const stmt = db.prepare('DELETE FROM devices WHERE id = ?');
      stmt.run(id);
      
      return device;
    } catch (error) {
      throw error;
    }
  }

  // Obtenir les statistiques des appareils
  async getDeviceStats() {
    try {
      const db = database.getDb();
      
      const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
      const unlocks24h = db.prepare('SELECT COUNT(*) as count FROM unblock_logs WHERE timestamp > datetime("now", "-24 hours")').get().count;
      const unlocks7d = db.prepare('SELECT COUNT(*) as count FROM unblock_logs WHERE timestamp > datetime("now", "-7 days")').get().count;
      
      return {
        total_devices: totalDevices,
        total_unlocks_24h: unlocks24h,
        total_unlocks_7d: unlocks7d
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new DeviceService();