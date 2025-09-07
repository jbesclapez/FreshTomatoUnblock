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
    const sshKeysDir = process.env.SSH_KEYS_PATH || './data/ssh_keys';
    const keyPath = path.join(sshKeysDir, `temp_${keyId}`);
    
    // S'assurer que le répertoire existe
    try {
      await fs.mkdir(sshKeysDir, { recursive: true, mode: 0o700 });
    } catch (mkdirError) {
      console.warn('Avertissement création répertoire SSH keys:', mkdirError.message);
    }
    
    // Nettoyer et formater la clé SSH
    let cleanKey = sshKey.trim();
    
    // Vérifier si c'est une clé OpenSSH ou PEM
    if (!cleanKey.includes('-----BEGIN') && !cleanKey.includes('-----END')) {
      throw new Error('Format de clé SSH invalide. Utilisez une clé privée au format OpenSSH ou PEM.');
    }
    
    // S'assurer que la clé se termine par un saut de ligne
    if (!cleanKey.endsWith('\n')) {
      cleanKey += '\n';
    }
    
    try {
      await fs.writeFile(keyPath, cleanKey, { mode: 0o600 });
      console.log(`🔑 Clé SSH temporaire créée: ${keyPath}`);
    } catch (writeError) {
      console.error('Erreur écriture clé SSH:', writeError.message);
      throw new Error(`Impossible de sauvegarder la clé SSH: ${writeError.message}`);
    }
    
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
      
      // Timeout plus long pour les environnements Synology/Docker
      socket.setTimeout(8000);
      
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
        
        // Messages d'erreur plus spécifiques selon le contexte
        let errorMsg = `Erreur réseau vers ${host}:22: ${error.message}`;
        if (error.code === 'ECONNREFUSED') {
          errorMsg = `Connexion refusée vers ${host}:22 - vérifiez que SSH est activé sur le routeur`;
        } else if (error.code === 'EHOSTUNREACH') {
          errorMsg = `Hôte injoignable ${host} - vérifiez l'adresse IP du routeur et la connectivité réseau`;
        } else if (error.code === 'ENETUNREACH') {
          errorMsg = `Réseau injoignable vers ${host} - vérifiez la configuration réseau du conteneur Docker`;
        }
        
        reject(new Error(errorMsg));
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
        tryKeyboard: true,
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
      
      // Construire la commande avec validation des paramètres
      const minutes = parseInt(durationMinutes, 10);
      if (isNaN(minutes) || minutes < 1 || minutes > 1440) { // Max 24h
        throw new Error(`Durée invalide: ${durationMinutes}. Doit être entre 1 et 1440 minutes.`);
      }
      
      // Normaliser l'adresse MAC (format standard avec deux-points)
      const normalizedMac = macAddress.toUpperCase().replace(/[^0-9A-F]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
      
      // Construire la commande SSH
      let command = config.ssh_command_template || 'SSH_ORIGINAL_COMMAND="unblock {MAC} {MINUTES}" sh /tmp/kidtemp_unblock.sh';
      command = command
        .replace('{MAC}', normalizedMac)
        .replace('{MINUTES}', minutes.toString());
      
      // Log détaillé pour debug
      console.log(`🔍 Paramètres de déblocage:`);
      console.log(`   MAC originale: ${macAddress}`);
      console.log(`   MAC normalisée: ${normalizedMac}`);
      console.log(`   Durée: ${minutes} minute(s)`);
      console.log(`   Template: ${config.ssh_command_template}`);
      console.log(`   Commande finale: ${command}`);
      
      console.log(`🔓 Déblocage: ${macAddress} pour ${durationMinutes} minute(s)`);
      console.log(`📡 Commande SSH: ${command}`);
      
      // Test de connectivité réseau avant SSH
      try {
        await this.testNetworkConnectivity(config.router_ip);
      } catch (networkError) {
        console.log('❌ Connectivité réseau échouée pour déblocage:', networkError.message);
        throw new Error(`Connexion réseau impossible vers le routeur: ${networkError.message}`);
      }
      
      await this.ssh.connect({
        host: config.router_ip,
        username: config.ssh_user,
        privateKeyPath: keyPath,
        port: 22,
        readyTimeout: 15000, // 15 secondes pour éviter les timeouts
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
        tryKeyboard: true,
        debug: process.env.NODE_ENV === 'development' ? 
          (msg) => console.log(`SSH Debug: ${msg}`) : undefined
      });
      
      const result = await this.ssh.execCommand(command);
      
      await this.ssh.dispose();
      
      // Log détaillé du résultat SSH pour debug
      console.log(`🔍 Résultat SSH pour ${macAddress}:`);
      console.log(`   Code de retour: ${result.code}`);
      console.log(`   STDOUT: "${result.stdout}"`);
      console.log(`   STDERR: "${result.stderr}"`);
      
      if (result.code === 0) {
        console.log(`✅ Déblocage réussi pour ${macAddress}`);
        return { 
          success: true, 
          message: `Appareil ${macAddress} débloqué pour ${minutes} minute(s)`,
          output: result.stdout
        };
      } else {
        // Si "minutes out of range", essayer des valeurs alternatives communes
        if (result.stdout && result.stdout.includes('minutes out of range')) {
          console.log(`⚠️  Minutes out of range (${minutes}), tentative avec valeurs alternatives...`);
          
          // Essayer des valeurs communes acceptées par FreshTomato
          const alternativeMinutes = [5, 10, 15, 30, 60];
          const closestMinutes = alternativeMinutes.reduce((prev, curr) => 
            Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
          );
          
          if (closestMinutes !== minutes) {
            console.log(`🔄 Nouvelle tentative avec ${closestMinutes} minutes...`);
            const altCommand = command.replace(minutes.toString(), closestMinutes.toString());
            
            try {
              await this.ssh.connect({
                host: config.router_ip,
                username: config.ssh_user,
                privateKeyPath: keyPath,
                port: 22,
                readyTimeout: 15000,
                algorithms: {
                  kex: [
                    'diffie-hellman-group14-sha256',
                    'diffie-hellman-group14-sha1', 
                    'diffie-hellman-group1-sha1',
                    'ecdh-sha2-nistp256'
                  ],
                  cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
                  hmac: ['hmac-sha2-256', 'hmac-sha2-512']
                },
                tryKeyboard: true
              });
              
              const altResult = await this.ssh.execCommand(altCommand);
              await this.ssh.dispose();
              
              if (altResult.code === 0) {
                console.log(`✅ Déblocage réussi avec valeur alternative: ${closestMinutes} minutes`);
                return { 
                  success: true, 
                  message: `Appareil ${macAddress} débloqué pour ${closestMinutes} minute(s) (valeur ajustée)`,
                  output: altResult.stdout,
                  adjustedDuration: closestMinutes
                };
              }
            } catch (retryError) {
              console.error(`❌ Échec de la tentative alternative:`, retryError.message);
            }
          }
        }
        
        // Construire un message d'erreur plus informatif
        const errorDetails = [];
        if (result.stderr && result.stderr.trim()) {
          errorDetails.push(`STDERR: ${result.stderr.trim()}`);
        }
        if (result.stdout && result.stdout.trim()) {
          errorDetails.push(`STDOUT: ${result.stdout.trim()}`);
        }
        if (result.code !== undefined) {
          errorDetails.push(`Code: ${result.code}`);
        }
        
        const errorMessage = errorDetails.length > 0 
          ? errorDetails.join(' | ')
          : `Code de retour ${result.code} sans message d'erreur`;
        
        console.error(`❌ Échec déblocage pour ${macAddress}: ${errorMessage}`);
        return { 
          success: false, 
          message: `Échec du déblocage: ${errorMessage}`,
          output: result.stderr || result.stdout,
          code: result.code
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
