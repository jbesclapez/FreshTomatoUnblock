const database = require('../config/database');

class LogService {
  // Enregistrer un déblocage
  async logUnblock(deviceId, sourceIp, durationMinutes) {
    try {
      const db = database.getDb();
      const stmt = db.prepare('INSERT INTO unblock_logs (device_id, source_ip, duration_minutes) VALUES (?, ?, ?)');
      const result = stmt.run(deviceId, sourceIp, durationMinutes);
      
      return {
        id: result.lastInsertRowid,
        device_id: deviceId,
        source_ip: sourceIp,
        duration_minutes: durationMinutes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Récupérer les logs avec informations des appareils
  async getLogs(limit = 100, offset = 0) {
    try {
      const db = database.getDb();
      const stmt = db.prepare(`
        SELECT 
          ul.*,
          d.name as device_name,
          d.mac as device_mac
        FROM unblock_logs ul
        LEFT JOIN devices d ON ul.device_id = d.id
        ORDER BY ul.timestamp DESC
        LIMIT ? OFFSET ?
      `);
      
      return stmt.all(limit, offset);
    } catch (error) {
      throw error;
    }
  }

  // Récupérer les logs pour un appareil spécifique
  async getLogsByDevice(deviceId, limit = 50) {
    try {
      const db = database.getDb();
      const stmt = db.prepare(`
        SELECT 
          ul.*,
          d.name as device_name,
          d.mac as device_mac
        FROM unblock_logs ul
        LEFT JOIN devices d ON ul.device_id = d.id
        WHERE ul.device_id = ?
        ORDER BY ul.timestamp DESC
        LIMIT ?
      `);
      
      return stmt.all(deviceId, limit);
    } catch (error) {
      throw error;
    }
  }

  // Obtenir des statistiques sur les déblocages
  async getUnblockStats(days = 7) {
    try {
      const db = database.getDb();
      
      const totalUnlocks = db.prepare(`SELECT COUNT(*) as count FROM unblock_logs WHERE timestamp > datetime(\'now\', \'-${days} days\')`).get().count;
      
      const unlocksByDay = db.prepare(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM unblock_logs 
        WHERE timestamp > datetime(\'now\', \'-${days} days\')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `).all();
      
      const topDevices = db.prepare(`
        SELECT 
          d.name as device_name,
          d.mac as device_mac,
          COUNT(*) as unlock_count
        FROM unblock_logs ul
        LEFT JOIN devices d ON ul.device_id = d.id
        WHERE ul.timestamp > datetime(\'now\', \'-${days} days\')
        GROUP BY ul.device_id
        ORDER BY unlock_count DESC
        LIMIT 5
      `).all();
      
      const durationDistribution = db.prepare(`
        SELECT 
          duration_minutes,
          COUNT(*) as count
        FROM unblock_logs 
        WHERE timestamp > datetime(\'now\', \'-${days} days\')
        GROUP BY duration_minutes
        ORDER BY duration_minutes ASC
      `).all();
      
      return {
        total_unlocks: totalUnlocks,
        unlocks_by_day: unlocksByDay,
        top_devices: topDevices,
        duration_distribution: durationDistribution
      };
    } catch (error) {
      throw error;
    }
  }

  // Nettoyer les anciens logs
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const db = database.getDb();
      const stmt = db.prepare(`DELETE FROM unblock_logs WHERE timestamp < datetime(\'now\', \'-${daysToKeep} days\')`);
      const result = stmt.run();
      
      console.log(`🧹 Nettoyage logs: ${result.changes} entrées supprimées`);
      return result.changes;
    } catch (error) {
      throw error;
    }
  }

  // Compter le total des logs
  async getTotalLogsCount() {
    try {
      const db = database.getDb();
      const result = db.prepare('SELECT COUNT(*) as total FROM unblock_logs').get();
      return result.total;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new LogService();