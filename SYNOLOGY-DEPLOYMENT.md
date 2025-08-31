# 🏠 FreshTomato Unblock - Synology NAS Deployment Guide

## 🔒 Secure Production Deployment on Synology NAS

Cette guide couvre le déploiement sécurisé sur votre Synology NAS avec toutes les mesures de sécurité activées.

---

## 📋 Prérequis

- Synology NAS (DSM 7.0+) avec Docker installé
- Accès SSH au NAS ou File Station
- FreshTomato router configuré avec script de déblocage

---

## 🚀 Déploiement Rapide

### Étape 1: Préparer les fichiers

```bash
# SSH vers votre Synology NAS
ssh admin@192.168.1.10

# Naviguer vers le dossier Docker
cd /volume2/docker/freshtomato-unblock

# Ou créer le dossier s'il n'existe pas
mkdir -p /volume2/docker/freshtomato-unblock
cd /volume2/docker/freshtomato-unblock
```

### Étape 2: Générer la configuration sécurisée

```bash
# 1. Générer un hash bcrypt pour votre mot de passe admin
node utils/generate-hash.js "VotreMotDePasseSecurise123"

# Copier le hash affiché, exemple:
# $2b$12$AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCDEFGHIJKLMNOP

# 2. Générer une clé de session sécurisée (32+ caractères)
openssl rand -base64 48

# 3. Créer le fichier .env
cat > .env << 'EOF'
# SÉCURITÉ - Configuration Production Synology
ADMIN_PASSWORD_HASH=$2b$12$VotreHashBcryptIci
SESSION_SECRET=VotreCleSessionTresLongueAuMoins32Caracteres
NODE_ENV=production
EOF
```

### Étape 3: Déployer avec Docker Compose

```bash
# Déployer le service avec la configuration Synology sécurisée
docker-compose -f docker-compose.synology.yml up -d

# Vérifier le déploiement
docker-compose -f docker-compose.synology.yml ps
docker-compose -f docker-compose.synology.yml logs -f
```

---

## 🖥️ Alternative: Interface Synology Container Manager

### Via l'Interface Web DSM

1. **Ouvrir Container Manager** dans DSM

2. **Créer un nouveau projet**:
   - Nom: `freshtomato-unblock`
   - Source: Importer `docker-compose.synology.yml`

3. **Configurer les variables d'environnement**:
   ```
   ADMIN_PASSWORD_HASH = $2b$12$VotreHashBcryptGenerePrecedemment
   SESSION_SECRET = VotreCleSessionSecurisee32Caracteres
   NODE_ENV = production
   ```

4. **Déployer** le projet

5. **Vérifier** les logs dans Container Manager

---

## 🔐 Configuration de Sécurité

### Variables d'Environnement Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `ADMIN_PASSWORD_HASH` | Hash bcrypt du mot de passe admin | `$2b$12$Ab...` |
| `SESSION_SECRET` | Clé de session (32+ chars) | `VotreCleSecurisee...` |
| `NODE_ENV` | Mode production | `production` |

### Fonctionnalités de Sécurité Activées

- ✅ **Authentification bcrypt** (12 salt rounds)
- ✅ **Permissions Docker restrictives** (750/700)
- ✅ **Système de fichiers en lecture seule**
- ✅ **Capacités minimales** (CHOWN/DAC_OVERRIDE/FOWNER uniquement)
- ✅ **Isolation réseau** (bind IP NAS uniquement)
- ✅ **Limits de ressources** (256MB RAM, 100 processus)
- ✅ **Utilisateur non-root** (nodejs:1001)
- ✅ **Sessions HTTPS-ready**
- ✅ **Protection CSRF**
- ✅ **Rate limiting renforcé**

---

## 🌐 Accès aux Interfaces

Après déploiement réussi:

- **Interface Utilisateur**: http://192.168.1.10:3000
- **Interface Admin**: http://192.168.1.10:3000/admin
- **Health Check**: http://192.168.1.10:3000/health

---

## ⚙️ Configuration Post-Déploiement

### 1. Configuration SSH du Routeur

1. Se connecter à l'interface admin: http://192.168.1.10:3000/admin
2. Aller dans **Configuration**
3. Configurer:
   - **IP Routeur**: 192.168.1.1
   - **Utilisateur SSH**: root
   - **Clé SSH**: Coller votre clé privée OpenSSH
4. **Tester la connexion SSH**

### 2. Ajouter des Appareils

1. Aller dans **Appareils**
2. Ajouter chaque appareil avec:
   - **Nom**: Nom lisible (ex: "iPhone de Marie")
   - **MAC**: Adresse MAC au format XX:XX:XX:XX:XX:XX
3. **Tester le déblocage** depuis l'interface admin

---

## 🔧 Maintenance

### Commandes Utiles

```bash
# Voir les logs
docker-compose -f docker-compose.synology.yml logs -f

# Redémarrer le service
docker-compose -f docker-compose.synology.yml restart

# Mettre à jour
docker-compose -f docker-compose.synology.yml pull
docker-compose -f docker-compose.synology.yml up -d

# Sauvegarder les données
docker run --rm -v freshtomato_data:/source -v $(pwd):/backup alpine tar czf /backup/freshtomato-backup.tar.gz -C /source .
```

### Monitoring

- **Logs**: Container Manager → freshtomato-unblock → Logs
- **Health**: http://192.168.1.10:3000/health
- **Ressources**: Container Manager → Performance

---

## 🚨 Troubleshooting

### Problème: Container ne démarre pas

```bash
# Vérifier les variables d'environnement
docker-compose -f docker-compose.synology.yml config

# Vérifier les logs
docker-compose -f docker-compose.synology.yml logs
```

**Solutions courantes**:
- Vérifier que `ADMIN_PASSWORD_HASH` est correctement défini
- Vérifier que `SESSION_SECRET` fait au moins 32 caractères
- S'assurer que le volume Docker existe

### Problème: SSH ne fonctionne pas

1. Tester la connectivité réseau: `ping 192.168.1.1`
2. Vérifier que SSH est activé sur le routeur
3. S'assurer que la clé SSH est au format OpenSSH (pas .ppk)
4. Tester manuellement: `ssh root@192.168.1.1`

### Problème: Interface admin inaccessible

1. Vérifier que le container fonctionne: `docker ps`
2. Tester l'endpoint health: `curl http://192.168.1.10:3000/health`
3. Régénérer le hash du mot de passe si nécessaire
4. Vérifier les logs d'authentification

---

## 🎯 Checklist de Sécurité

Avant mise en production:

- [ ] `ADMIN_PASSWORD_HASH` généré avec bcrypt
- [ ] `SESSION_SECRET` de 32+ caractères
- [ ] Variables d'environnement dans `.env` ou Container Manager
- [ ] Test de connexion SSH réussi
- [ ] Test de déblocage réussi
- [ ] Firewall Synology configuré si nécessaire
- [ ] Monitoring des logs activé

---

**🔒 Votre installation FreshTomato Unblock est maintenant sécurisée et prête pour la production sur Synology NAS!**
