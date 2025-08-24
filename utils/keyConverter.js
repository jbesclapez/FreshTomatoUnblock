const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convertir avec puttygen (si disponible)
 */
async function convertWithPuttygen(ppkFilePath) {
    return new Promise((resolve, reject) => {
        const puttygen = spawn('puttygen', [ppkFilePath, '-O', 'private-openssh'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        puttygen.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        puttygen.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        puttygen.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`puttygen failed: ${stderr}`));
            }
        });
        
        puttygen.on('error', (error) => {
            reject(new Error(`puttygen not available: ${error.message}`));
        });
    });
}

/**
 * Parser PPK manuellement (fallback)
 */
async function parsePpkManually(ppkContent) {
    // Fournir des instructions détaillées pour la conversion manuelle
    throw new Error(`Conversion PPK automatique non disponible dans ce conteneur Alpine.

🔧 SOLUTION: Convertir manuellement votre fichier .ppk

📋 Étapes à suivre:

1️⃣ Ouvrez PuTTYgen sur votre machine Windows/Linux
2️⃣ Cliquez "Load" et sélectionnez votre fichier kidtemp_router.ppk
3️⃣ Dans le menu "Conversions", choisissez "Export OpenSSH key"
4️⃣ Sauvegardez sous "kidtemp_router_openssh.key"
5️⃣ Ouvrez le fichier .key avec un éditeur de texte
6️⃣ Copiez TOUT le contenu et collez-le dans la zone de texte ci-dessous

✅ La clé OpenSSH commence par:
-----BEGIN OPENSSH PRIVATE KEY-----
et se termine par:
-----END OPENSSH PRIVATE KEY-----

💡 Alternative en ligne de commande:
   puttygen kidtemp_router.ppk -O private-openssh -o kidtemp_router_openssh.key

⚠️  Important: N'utilisez PAS la clé publique (ssh-ed25519...), il faut la clé PRIVÉE`);
}

/**
 * Convertir une clé PuTTY .ppk en format OpenSSH
 * @param {string} ppkContent - Contenu du fichier .ppk
 * @returns {Promise<string>} - Clé OpenSSH convertie
 */
async function convertPpkToOpenSsh(ppkContent) {
    const tempDir = path.join(__dirname, '../data/ssh_keys');
    const tempPpkFile = path.join(tempDir, `temp_${Date.now()}.ppk`);
    const tempKeyFile = path.join(tempDir, `temp_${Date.now()}_openssh`);
    
    try {
        // Créer le répertoire temporaire si nécessaire
        await fs.mkdir(tempDir, { recursive: true });
        
        // Écrire le fichier .ppk temporaire
        await fs.writeFile(tempPpkFile, ppkContent);
        
        // Pour les conteneurs Alpine, puttygen n'est pas disponible
        // Utiliser une approche alternative avec instructions claires
        const result = await parsePpkManually(ppkContent);
        
        return result;
        
    } catch (error) {
        throw new Error(`Erreur conversion .ppk: ${error.message}`);
    } finally {
        // Nettoyer les fichiers temporaires
        try {
            await fs.unlink(tempPpkFile);
        } catch (e) {
            console.warn('Erreur nettoyage fichier .ppk temporaire:', e.message);
        }
        
        try {
            await fs.unlink(tempKeyFile);
        } catch (e) {
            // Ignorer si le fichier n'existe pas
        }
    }
}

/**
 * Détecter le format d'une clé SSH
 * @param {string} keyContent - Contenu de la clé
 * @returns {string} - 'openssh', 'ppk', ou 'unknown'
 */
function detectKeyFormat(keyContent) {
    if (!keyContent || typeof keyContent !== 'string') {
        return 'unknown';
    }
    
    const content = keyContent.trim();
    
    // Clé OpenSSH
    if (content.startsWith('ssh-') || content.includes('BEGIN OPENSSH PRIVATE KEY')) {
        return 'openssh';
    }
    
    // Clé PuTTY
    if (content.startsWith('PuTTY-User-Key-File-') || content.includes('PuTTY-User-Key-File-')) {
        return 'ppk';
    }
    
    // Clé PEM
    if (content.includes('BEGIN PRIVATE KEY') || content.includes('BEGIN RSA PRIVATE KEY')) {
        return 'pem';
    }
    
    return 'unknown';
}

/**
 * Convertir une clé vers le format OpenSSH si nécessaire
 * @param {string} keyContent - Contenu de la clé
 * @returns {Promise<string>} - Clé au format OpenSSH
 */
async function ensureOpenSshFormat(keyContent) {
    const format = detectKeyFormat(keyContent);
    
    switch (format) {
        case 'openssh':
            return keyContent.trim();
            
        case 'ppk':
            console.log('🔑 Conversion clé PuTTY vers OpenSSH...');
            return await convertPpkToOpenSsh(keyContent);
            
        case 'pem':
            // Pour les clés PEM, on peut essayer une conversion directe
            try {
                return await convertPemToOpenSsh(keyContent);
            } catch (error) {
                throw new Error(`Conversion PEM échouée: ${error.message}`);
            }
            
        default:
            throw new Error('Format de clé non reconnu. Formats supportés: OpenSSH, PuTTY (.ppk), PEM');
    }
}

/**
 * Convertir une clé PEM en format OpenSSH
 * @param {string} pemContent - Contenu de la clé PEM
 * @returns {Promise<string>} - Clé OpenSSH convertie
 */
async function convertPemToOpenSsh(pemContent) {
    const tempDir = path.join(__dirname, '../data/ssh_keys');
    const tempPemFile = path.join(tempDir, `temp_${Date.now()}.pem`);
    
    try {
        // Créer le répertoire temporaire si nécessaire
        await fs.mkdir(tempDir, { recursive: true });
        
        // Écrire le fichier PEM temporaire
        await fs.writeFile(tempPemFile, pemContent, { mode: 0o600 });
        
        // Convertir avec ssh-keygen
        const result = await new Promise((resolve, reject) => {
            const sshKeygen = spawn('ssh-keygen', [
                '-y',
                '-f', tempPemFile
            ]);
            
            let stdout = '';
            let stderr = '';
            
            sshKeygen.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            sshKeygen.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            sshKeygen.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Conversion échouée: ${stderr}`));
                }
            });
            
            sshKeygen.on('error', (error) => {
                reject(new Error(`Erreur ssh-keygen: ${error.message}`));
            });
        });
        
        return result;
        
    } catch (error) {
        throw new Error(`Erreur conversion PEM: ${error.message}`);
    } finally {
        // Nettoyer les fichiers temporaires
        try {
            await fs.unlink(tempPemFile);
        } catch (e) {
            console.warn('Erreur nettoyage fichier PEM temporaire:', e.message);
        }
    }
}

/**
 * Valider qu'une clé SSH est bien formatée
 * @param {string} keyContent - Contenu de la clé
 * @returns {boolean} - True si la clé est valide
 */
function validateSshKey(keyContent) {
    if (!keyContent || typeof keyContent !== 'string') {
        return false;
    }
    
    const trimmed = keyContent.trim();
    
    // Vérifier les formats de clé publique SSH
    const sshKeyRegex = /^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+\/]+[=]{0,3}(\s+.*)?$/;
    
    return sshKeyRegex.test(trimmed);
}

module.exports = {
    convertPpkToOpenSsh,
    detectKeyFormat,
    ensureOpenSshFormat,
    validateSshKey
};
