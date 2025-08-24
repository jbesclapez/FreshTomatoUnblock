const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async init() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/app.db');
    
    try {
      this.db = new Database(dbPath);
      console.log('Connexion SQLite établie');
      await this.createTables();
      return Promise.resolve();
    } catch (err) {
      console.error('Erreur connexion SQLite:', err);
      return Promise.reject(err);
    }
  }

  async createTables() {
    const queries = [
      // Table de configuration
      `CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      
      // Table des appareils
      `CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mac TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Table des logs de déblocage
      `CREATE TABLE IF NOT EXISTS unblock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER,
        source_ip TEXT,
        duration_minutes INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id)
      )`
    ];

    // Insérer les valeurs par défaut
    const defaultConfig = [
      ['router_ip', process.env.DEFAULT_ROUTER_IP || '192.168.1.1'],
      ['ssh_user', process.env.DEFAULT_SSH_USER || 'root'],
      ['ssh_key', '# Clé privée SSH requise - remplacez par votre clé privée\n# Exemple de format OpenSSH:\n# -----BEGIN OPENSSH PRIVATE KEY-----\n# b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcnNh\n# ...\n# -----END OPENSSH PRIVATE KEY-----'],
      ['default_timeout_minutes', process.env.DEFAULT_TIMEOUT_MINUTES || '1'],
      ['max_timeout_minutes', process.env.MAX_TIMEOUT_MINUTES || '60'],
      ['ssh_command_template', 'SSH_ORIGINAL_COMMAND="unblock {MAC} {MINUTES}" sh /tmp/kidtemp_unblock.sh']
    ];

    try {
      // Créer les tables
      queries.forEach(query => {
        this.db.exec(query);
      });

      // Insérer la configuration par défaut
      const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      defaultConfig.forEach(([key, value]) => {
        stmt.run(key, value);
      });

      console.log('Tables SQLite créées avec succès');
      return Promise.resolve();
    } catch (error) {
      console.error('Erreur création tables:', error);
      return Promise.reject(error);
    }
  }

  getDb() {
    return this.db;
  }

  async close() {
    try {
      if (this.db) {
        this.db.close();
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Erreur fermeture DB:', error);
      return Promise.resolve(); // Ne pas faire échouer l'arrêt
    }
  }
}

module.exports = new DatabaseManager();
