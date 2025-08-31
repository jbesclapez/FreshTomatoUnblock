#!/usr/bin/env node

/**
 * Utilitaire pour générer un hash bcrypt d'un mot de passe admin
 * Usage: node utils/generate-hash.js [mot_de_passe]
 */

const { generatePasswordHash } = require('../middleware/auth');

async function main() {
  const password = process.argv[2];
  
  if (!password) {
    console.log('📝 Utilitaire de génération de hash bcrypt');
    console.log('');
    console.log('Usage: node utils/generate-hash.js <mot_de_passe>');
    console.log('');
    console.log('Exemple:');
    console.log('  node utils/generate-hash.js MonMotDePasseSecurise123');
    console.log('');
    process.exit(1);
  }
  
  if (password.length < 8) {
    console.error('❌ Le mot de passe doit contenir au moins 8 caractères');
    process.exit(1);
  }
  
  try {
    console.log('🔐 Génération du hash bcrypt...');
    console.log('');
    await generatePasswordHash(password);
    console.log('');
    console.log('✅ Hash généré avec succès!');
    console.log('');
    console.log('🔒 IMPORTANT: Supprimez ADMIN_PASSWORD de votre .env et utilisez uniquement ADMIN_PASSWORD_HASH');
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error.message);
    process.exit(1);
  }
}

main();
