#!/usr/bin/env node

/**
 * Script de tests basiques pour FreshTomato Unblock
 * Tests des utilitaires critiques
 */

const { validateMacAddress, validateDuration, validateIpAddress } = require('../utils/validator');

console.log('🧪 Lancement des tests FreshTomato Unblock...\n');

let passed = 0;
let failed = 0;

function test(description, testFn) {
    try {
        const result = testFn();
        if (result) {
            console.log(`✅ ${description}`);
            passed++;
        } else {
            console.log(`❌ ${description}`);
            failed++;
        }
    } catch (error) {
        console.log(`❌ ${description} - Erreur: ${error.message}`);
        failed++;
    }
}

// Tests de validation MAC
console.log('📱 Tests validation adresses MAC:');
test('MAC valide (majuscules)', () => validateMacAddress('AA:BB:CC:DD:EE:FF'));
test('MAC valide (minuscules)', () => validateMacAddress('aa:bb:cc:dd:ee:ff'));
test('MAC valide (mixte)', () => validateMacAddress('Aa:Bb:Cc:Dd:Ee:Ff'));
test('MAC invalide (format)', () => !validateMacAddress('AA-BB-CC-DD-EE-FF'));
test('MAC invalide (longueur)', () => !validateMacAddress('AA:BB:CC:DD:EE'));
test('MAC invalide (caractères)', () => !validateMacAddress('GG:HH:II:JJ:KK:LL'));
test('MAC invalide (vide)', () => !validateMacAddress(''));
test('MAC invalide (null)', () => !validateMacAddress(null));

// Tests de validation durée
console.log('\n⏱️  Tests validation durées:');
process.env.DEFAULT_TIMEOUT_MINUTES = '1';
process.env.MAX_TIMEOUT_MINUTES = '60';
test('Durée valide (1 min)', () => validateDuration(1));
test('Durée valide (30 min)', () => validateDuration(30));
test('Durée valide (60 min)', () => validateDuration(60));
test('Durée invalide (0 min)', () => !validateDuration(0));
test('Durée invalide (61 min)', () => !validateDuration(61));
test('Durée invalide (negative)', () => !validateDuration(-5));
test('Durée invalide (string)', () => !validateDuration('abc'));
test('Durée invalide (null)', () => !validateDuration(null));

// Tests de validation IP
console.log('\n🌐 Tests validation adresses IP:');
test('IP valide (192.168.1.1)', () => validateIpAddress('192.168.1.1'));
test('IP valide (10.0.0.1)', () => validateIpAddress('10.0.0.1'));
test('IP valide (172.16.0.1)', () => validateIpAddress('172.16.0.1'));
test('IP invalide (format)', () => !validateIpAddress('192.168.1'));
test('IP invalide (valeurs)', () => !validateIpAddress('256.256.256.256'));
test('IP invalide (caractères)', () => !validateIpAddress('192.168.1.a'));
test('IP invalide (vide)', () => !validateIpAddress(''));
test('IP invalide (null)', () => !validateIpAddress(null));

// Test de la base de données (simulation)
console.log('\n💾 Tests configuration base de données:');
test('Variables d\'environnement définies', () => {
    const required = ['DEFAULT_TIMEOUT_MINUTES', 'MAX_TIMEOUT_MINUTES'];
    return required.every(env => process.env[env]);
});

// Test des dépendances critiques
console.log('\n📦 Tests dépendances:');
test('Module express disponible', () => {
    try {
        require('express');
        return true;
    } catch {
        return false;
    }
});

test('Module sqlite3 disponible', () => {
    try {
        require('sqlite3');
        return true;
    } catch {
        return false;
    }
});

test('Module node-ssh disponible', () => {
    try {
        require('node-ssh');
        return true;
    } catch {
        return false;
    }
});

// Résultats finaux
console.log('\n📊 Résultats des tests:');
console.log(`✅ Réussis: ${passed}`);
console.log(`❌ Échoués: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);

if (failed === 0) {
    console.log('\n🎉 Tous les tests sont passés avec succès!');
    process.exit(0);
} else {
    console.log('\n⚠️  Certains tests ont échoué. Vérifiez la configuration.');
    process.exit(1);
}
