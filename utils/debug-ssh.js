#!/usr/bin/env node

/**
 * Utilitaire de débogage SSH pour FreshTomatoUnblock
 * Usage: node utils/debug-ssh.js [router_ip] [ssh_user]
 */

const { NodeSSH } = require('node-ssh');
const net = require('net');
const fs = require('fs').promises;
const path = require('path');
const database = require('../config/database');

async function testNetworkConnectivity(host, port = 22) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    
    console.log(`🌐 Test de connectivité réseau vers ${host}:${port}...`);
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log(`✅ Connectivité réseau OK vers ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ Timeout de connectivité réseau vers ${host}:${port}`);
      socket.destroy();
      reject(new Error(`Timeout vers ${host}:${port}`));
    });
    
    socket.on('error', (error) => {
      console.log(`❌ Erreur de connectivité réseau vers ${host}:${port}:`, error.message);
      socket.destroy();
      reject(error);
    });
    
    socket.connect(port, host);
  });
}

async function getSshConfig() {
  try {
    await database.init();
    const db = database.getDb();
    const stmt = db.prepare('SELECT key, value FROM config WHERE key IN (?, ?, ?, ?)');
    const rows = stmt.all('router_ip', 'ssh_user', 'ssh_key', 'ssh_command_template');
    
    const config = {};
    rows.forEach(row => {
      config[row.key] = row.value;
    });
    
    return config;
  } catch (error) {
    console.error('❌ Erreur récupération config:', error.message);
    throw error;
  }
}

async function saveTemporaryKey(sshKey) {
  const crypto = require('crypto');
  
  const keyId = crypto.randomBytes(16).toString('hex');
  const keyPath = path.join(process.env.SSH_KEYS_PATH || './data/ssh_keys', `debug_${keyId}`);
  
  // Nettoyer et formater la clé SSH
  let cleanKey = sshKey.trim();
  
  if (!cleanKey.includes('-----BEGIN') && !cleanKey.includes('-----END')) {
    throw new Error('Format de clé SSH invalide');
  }
  
  if (!cleanKey.endsWith('\n')) {
    cleanKey += '\n';
  }
  
  await fs.writeFile(keyPath, cleanKey, { mode: 0o600 });
  return keyPath;
}

async function testSshConnection(config) {
  const ssh = new NodeSSH();
  let keyPath = null;
  
  try {
    keyPath = await saveTemporaryKey(config.ssh_key);
    
    console.log(`🔗 Test connexion SSH vers ${config.router_ip} en tant que ${config.ssh_user}`);
    console.log(`🔑 Clé SSH temporaire: ${keyPath}`);
    
    await ssh.connect({
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
      debug: (msg) => console.log(`SSH Debug: ${msg}`)
    });
    
    console.log(`✅ Connexion SSH établie`);
    
    // Test des commandes de base
    console.log(`🧪 Test commande 'echo'...`);
    const echoResult = await ssh.execCommand('echo "Test SSH connection"');
    console.log(`   Code: ${echoResult.code}, STDOUT: "${echoResult.stdout}", STDERR: "${echoResult.stderr}"`);
    
    console.log(`🧪 Test commande 'whoami'...`);
    const whoamiResult = await ssh.execCommand('whoami');
    console.log(`   Code: ${whoamiResult.code}, STDOUT: "${whoamiResult.stdout}", STDERR: "${whoamiResult.stderr}"`);
    
    console.log(`🧪 Test existence script déblocage...`);
    const scriptResult = await ssh.execCommand('ls -la /tmp/kidtemp_unblock.sh');
    console.log(`   Code: ${scriptResult.code}, STDOUT: "${scriptResult.stdout}", STDERR: "${scriptResult.stderr}"`);
    
    // Test avec différentes valeurs de minutes
    const testMinutes = [1, 5, 10, 15, 30, 60];
    const testMac = '68:54:5A:96:69:BE';
    
    for (const minutes of testMinutes) {
      console.log(`🧪 Test déblocage avec ${minutes} minutes...`);
      const command = (config.ssh_command_template || 'SSH_ORIGINAL_COMMAND="unblock {MAC} {MINUTES}" sh /tmp/kidtemp_unblock.sh')
        .replace('{MAC}', testMac)
        .replace('{MINUTES}', minutes.toString());
      
      console.log(`   Commande: ${command}`);
      const result = await ssh.execCommand(command);
      console.log(`   Code: ${result.code}, STDOUT: "${result.stdout}", STDERR: "${result.stderr}"`);
      
      if (result.code === 0) {
        console.log(`   ✅ ${minutes} minutes: SUCCÈS`);
        break;
      } else {
        console.log(`   ❌ ${minutes} minutes: ÉCHEC`);
      }
    }
    
    await ssh.dispose();
    console.log(`✅ Tests SSH terminés`);
    
  } catch (error) {
    console.error(`❌ Erreur SSH:`, error.message);
    throw error;
  } finally {
    if (keyPath) {
      try {
        await fs.unlink(keyPath);
        console.log(`🧹 Clé temporaire supprimée: ${keyPath}`);
      } catch (cleanupError) {
        console.warn(`⚠️  Erreur nettoyage clé temporaire:`, cleanupError.message);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const routerIp = args[0];
  const sshUser = args[1];
  
  try {
    console.log(`🚀 Démarrage du débogage SSH FreshTomatoUnblock`);
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`─────────────────────────────────────────────────`);
    
    // Récupérer la configuration
    const config = await getSshConfig();
    
    // Override avec les paramètres de ligne de commande si fournis
    if (routerIp) {
      config.router_ip = routerIp;
      console.log(`🔧 IP routeur overridée: ${routerIp}`);
    }
    
    if (sshUser) {
      config.ssh_user = sshUser;
      console.log(`🔧 Utilisateur SSH overridé: ${sshUser}`);
    }
    
    console.log(`📋 Configuration SSH:`);
    console.log(`   IP routeur: ${config.router_ip}`);
    console.log(`   Utilisateur: ${config.ssh_user}`);
    console.log(`   Template commande: ${config.ssh_command_template}`);
    console.log(`   Clé SSH: ${config.ssh_key ? config.ssh_key.substring(0, 50) + '...' : 'Non configurée'}`);
    console.log(`─────────────────────────────────────────────────`);
    
    // Vérifier que la clé SSH est configurée
    if (!config.ssh_key || config.ssh_key.includes('# Clé privée SSH requise')) {
      throw new Error('Clé SSH non configurée. Configurez une clé privée SSH dans l\'interface admin.');
    }
    
    // Test de connectivité réseau
    try {
      await testNetworkConnectivity(config.router_ip);
    } catch (networkError) {
      console.log(`⚠️  Connectivité réseau échouée, tentative SSH directe...`);
    }
    
    // Test SSH
    await testSshConnection(config);
    
    console.log(`─────────────────────────────────────────────────`);
    console.log(`✅ Débogage terminé avec succès`);
    
  } catch (error) {
    console.error(`─────────────────────────────────────────────────`);
    console.error(`❌ Erreur durant le débogage:`, error.message);
    console.error(`📊 Stack trace:`, error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testNetworkConnectivity,
  testSshConnection,
  getSshConfig
};
