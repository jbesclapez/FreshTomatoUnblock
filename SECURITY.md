# FreshTomato Unblock - Security Guide

## 🔒 Configuration Sécurisée

### 1. Génération du Hash de Mot de Passe Admin

**⚠️ CRITIQUE**: Ne jamais utiliser `ADMIN_PASSWORD` en production. Utilisez `ADMIN_PASSWORD_HASH`.

```bash
# Générer un hash bcrypt sécurisé
node utils/generate-hash.js "VotreMotDePasseSecurise123"
```

Ceci génèrera un hash bcrypt que vous devez ajouter à votre `.env`:

```bash
ADMIN_PASSWORD_HASH=$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Variables d'Environnement Obligatoires

#### Production (OBLIGATOIRE)
```bash
# Clé de session (minimum 32 caractères)
SESSION_SECRET=your_very_long_session_secret_key_32_chars_minimum

# Hash du mot de passe admin (généré avec utils/generate-hash.js)
ADMIN_PASSWORD_HASH=$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mode production
NODE_ENV=production
```

#### Développement (optionnel)
```bash
# En développement uniquement, vous pouvez utiliser:
ADMIN_PASSWORD=votre_mot_de_passe_dev
NODE_ENV=development
```

### 3. Sécurité des Sessions

En production:
- ✅ Cookies sécurisés (HTTPS uniquement)
- ✅ httpOnly activé
- ✅ Protection CSRF avec sameSite
- ✅ Nom de session personnalisé

### 4. Sécurité SSH

- ✅ Clés temporaires avec permissions 600
- ✅ Timeouts configurés (10s pour déblocage, 15s pour test)
- ✅ Algorithms SSH restreints
- ✅ Debug désactivé en production
- ✅ Nettoyage automatique des clés temporaires

### 5. Protection contre les Attaques

#### Rate Limiting
- **Déblocages**: 5 tentatives/minute par IP
- **Login admin**: 5 tentatives/15 minutes par IP
- **API générale**: 100 requêtes/minute par IP

#### Validation des Entrées
- ✅ Adresses MAC: format strict XX:XX:XX:XX:XX:XX
- ✅ Durées: entre 1 et 60 minutes
- ✅ Adresses IP: validation regex
- ✅ Noms d'appareils: caractères alphanumériques + tirets/underscores

#### Protection SQL
- ✅ Requêtes préparées (prepared statements)
- ✅ Pas d'injection SQL possible

## 🛡️ Bonnes Pratiques

### Déploiement Sécurisé

1. **Permissions Docker**
   ```bash
   # Les données sont protégées avec des permissions restrictives
   /app/data       -> 750 (rwxr-x---)
   /app/data/ssh_keys -> 700 (rwx------)
   ```

2. **Variables d'Environnement**
   ```bash
   # Ne jamais commiter de vraies valeurs dans Git
   cp env.example .env
   # Éditez .env avec vos vraies valeurs
   ```

3. **Mots de Passe Forts**
   - Minimum 12 caractères
   - Mélange majuscules/minuscules/chiffres/symboles
   - Unique pour cette application

### Monitoring de Sécurité

1. **Logs à Surveiller**
   - Tentatives de connexion admin échouées
   - Rate limiting déclenché
   - Erreurs SSH suspectes

2. **Endpoints de Monitoring**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Statut authentification
   curl http://localhost:3000/auth/status
   ```

## 🚨 Que Faire en Cas de Compromission

1. **Changer immédiatement**:
   - Mot de passe admin
   - SESSION_SECRET
   - Clés SSH

2. **Régénérer les hashes**:
   ```bash
   node utils/generate-hash.js "NouveauMotDePasseSecurise456"
   ```

3. **Redémarrer le service**:
   ```bash
   docker-compose restart
   ```

4. **Vérifier les logs**:
   ```bash
   docker-compose logs -f freshtomato-unblock
   ```

## 📋 Checklist de Sécurité

Avant la mise en production:

- [ ] `ADMIN_PASSWORD_HASH` configuré (pas `ADMIN_PASSWORD`)
- [ ] `SESSION_SECRET` de 32+ caractères
- [ ] `NODE_ENV=production`
- [ ] HTTPS configuré (si accessible depuis Internet)
- [ ] Firewall configuré sur le serveur
- [ ] Clés SSH sécurisées et uniques
- [ ] Surveillance des logs activée
- [ ] Sauvegarde de la configuration

## 🔍 Tests de Sécurité

```bash
# Vérifier la configuration
npm test

# Tester les endpoints critiques
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"test"}'

# Vérifier le rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/unblock \
    -H "Content-Type: application/json" \
    -d '{"deviceId":1,"duration":1}'
done
```

---

**⚠️ RAPPEL**: La sécurité est un processus continu. Surveillez régulièrement les logs et maintenez le système à jour.
