const { NodeSSH } = require('node-ssh');
const database = require('../config/database');
const { validateMacAddress, validateDuration } = require('../utils/validator');

class SshService {
  constructor() {
    this.ssh = new NodeSSH();
  }

  // Récupérer la configuration SSH depuis la base de données
  async getSshConfig() {
    try {
      const db = database.getDb();
      const stmt = db.prepare('SELECT key, value FROM config WHERE key IN (?, ?, ?, ?)');
      const rows = stmt.all('router_ip', 'ssh_user', 'ssh_key', 'ssh_command_template');
      
      const config = {};
      rows.forEach(row => {
        config[row.key] = row.value;
      });
      
      // Vérifier que la configuration est complète
      if (!config.router_ip || !config.ssh_user || !config.ssh_key) {
        throw new Error('Configuration SSH incomplète');
      }
      
      return config;
    } catch (error) {
      throw error;
    }
  }

  // Sauvegarder la clé SSH dans un fichier temporaire
  async saveTemporaryKey(sshKey) {
    const fs = require('fs').promises;
    const path = require('path');
    const crypto = require('crypto');
    
    const keyId = crypto.randomBytes(16).toString('hex');
    const keyPath = path.join(process.env.SSH_KEYS_PATH || './data/ssh_keys', `temp_${keyId}`);
    
    await fs.writeFile(keyPath, sshKey, { mode: 0o600 });
    return keyPath;
  }

  // Nettoyer les clés temporaires
  async cleanupTemporaryKey(keyPath) {
    try {
      const fs = require('fs').promises;
      await fs.unlink(keyPath);
    } catch (error) {
      console.warn('Erreur nettoyage clé temporaire:', error.message);
    }
  }

  // Test de connectivité réseau
  async testNetworkConnectivity(host) {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const socket = new net.Socket();
      
      console.log(`🌐 Test de connectivité réseau vers ${host}:22`);
      
      socket.setTimeout(5000);
      
      socket.on('connect', () => {
        console.log(`✅ Connectivité réseau OK vers ${host}:22`);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        console.log(`❌ Timeout de connectivité réseau vers ${host}:22`);
        socket.destroy();
        reject(new Error(`Impossible de joindre ${host}:22 - vérifiez l'IP du routeur et la connectivité réseau`));
      });
      
      socket.on('error', (error) => {
        console.log(`❌ Erreur de connectivité réseau vers ${host}:22:`, error.message);
        socket.destroy();
        reject(new Error(`Erreur réseau vers ${host}:22: ${error.message}`));
      });
      
      socket.connect(22, host);
    });
  }

  // Tester la connexion SSH
  async testConnection() {
    let keyPath = null;
    
    try {
      const config = await this.getSshConfig();
      
      // Vérifier que la clé SSH est configurée et semble être une clé privée
      if (!config.ssh_key || config.ssh_key.includes('# Clé privée SSH requise') || config.ssh_key.startsWith('ssh-')) {
        throw new Error('Clé privée SSH non configurée. Veuillez configurer une clé privée SSH dans les paramètres (pas une clé publique).');
      }
      
      keyPath = await this.saveTemporaryKey(config.ssh_key);
      
      console.log(`🔗 Tentative de connexion SSH vers ${config.router_ip} en tant que ${config.ssh_user}`);
      console.log(`🔑 Clé SSH: ${keyPath}`);
      
      // Test de connectivité réseau avant SSH
      try {
        await this.testNetworkConnectivity(config.router_ip);
      } catch (networkError) {
        console.log('❌ Connectivité réseau échouée, tentative SSH directe...');
        console.log('Network error:', networkError.message);
        // Continue avec SSH même si le test réseau échoue
      }
      
      await this.ssh.connect({
        host: config.router_ip,
        username: config.ssh_user,
        privateKeyPath: keyPath,
        port: 22,
        readyTimeout: 15000, // 15 secondes
        // Algorithmes plus larges pour compatibilité FreshTomato
        algorithms: {
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1', 
            'diffie-hellman-group1-sha1',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521'
          ],
          cipher: [
            'aes128-ctr', 
            'aes192-ctr', 
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm',
            'aes128-cbc',
            'aes192-cbc',
            'aes256-cbc',
            '3des-cbc'
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512', 
            'hmac-sha1',
            'hmac-sha1-96',
            'hmac-md5'
          ],
          compress: ['none', 'zlib@openssh.com', 'zlib']
        },
        debug: process.env.NODE_ENV === 'development' ? 
          (msg) => console.log(`SSH Debug: ${msg}`) : undefined
      });
      
      // Test simple - exécuter 'echo test'
      const result = await this.ssh.execCommand('echo "SSH connection test"');
      
      await this.ssh.dispose();
      
      if (result.code === 0) {
        return { success: true, message: 'Connexion SSH réussie' };
      } else {
        return { success: false, message: `Erreur SSH: ${result.stderr || result.stdout}` };
      }
      
    } catch (error) {
      console.error('Erreur test SSH:', error);
      return { success: false, message: `Échec connexion SSH: ${error.message}` };
    } finally {
      if (keyPath) {
        await this.cleanupTemporaryKey(keyPath);
      }
    }
  }

  // Débloquer un appareil
  async unblockDevice(macAddress, durationMinutes) {
    // Validation
    if (!validateMacAddress(macAddress)) {
      throw new Error('Adresse MAC invalide');
    }
    
    if (!validateDuration(durationMinutes)) {
      throw new Error('Durée invalide');
    }
    
    let keyPath = null;
    
    try {
      const config = await this.getSshConfig();
      keyPath = await this.saveTemporaryKey(config.ssh_key);
      
      // Construire la commande
      const command = config.ssh_command_template
        .replace('{MAC}', macAddress)
        .replace('{MINUTES}', durationMinutes);
      
      console.log(`🔓 Déblocage: ${macAddress} pour ${durationMinutes} minute(s)`);
      console.log(`📡 Commande SSH: ${command}`);
      
      await this.ssh.connect({
        host: config.router_ip,
        username: config.ssh_user,
        privateKeyPath: keyPath,
        readyTimeout: 10000, // 10 secondes
        algorithms: {
          kex: ['diffie-hellman-group14-sha256', 'ecdh-sha2-nistp256'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512']
        }
      });
      
      const result = await this.ssh.execCommand(command);
      
      await this.ssh.dispose();
      
      if (result.code === 0) {
        console.log(`✅ Déblocage réussi pour ${macAddress}`);
        return { 
          success: true, 
          message: `Appareil ${macAddress} débloqué pour ${durationMinutes} minute(s)`,
          output: result.stdout
        };
      } else {
        console.error(`❌ Échec déblocage pour ${macAddress}:`, result.stderr);
        return { 
          success: false, 
          message: `Échec du déblocage: ${result.stderr || 'Erreur inconnue'}`,
          output: result.stderr
        };
      }
      
    } catch (error) {
      console.error('Erreur déblocage SSH:', error);
      throw new Error(`Erreur déblocage: ${error.message}`);
    } finally {
      if (keyPath) {
        await this.cleanupTemporaryKey(keyPath);
      }
    }
  }

  // Tester le déblocage d'un appareil (pour l'interface admin)
  async testUnblock(macAddress, durationMinutes = 1) {
    try {
      const result = await this.unblockDevice(macAddress, durationMinutes);
      return result;
    } catch (error) {
      return { 
        success: false, 
        message: error.message
      };
    }
  }
}

module.exports = new SshService();
