# FreshTomato Unblock Service

Mini-service web Docker pour débloquer temporairement l'accès Internet d'appareils via SSH vers routeur FreshTomato.

## 🎯 Fonctionnalités

### Interface Utilisateur
- **Liste des appareils** configurés avec cartes visuelles
- **Sélection de durée** de déblocage (1-60 minutes)
- **Déblocage en un clic** avec feedback en temps réel
- **Interface responsive** adaptée mobile et desktop

### Interface Admin
- **Dashboard** avec statistiques de déblocages
- **Gestion des appareils** (CRUD complet)
- **Configuration SSH** (IP routeur, utilisateur, clé privée)
- **Journal des déblocages** avec historique complet
- **Tests de connectivité** SSH et déblocage
- **Export/Import** de configuration

## 🚀 Installation

### Prérequis
- Docker et Docker Compose
- Routeur FreshTomato avec script de déblocage configuré
- Accès SSH au routeur

### Configuration par défaut
- **Routeur IP**: 192.168.1.1
- **Utilisateur SSH**: root
- **Clé SSH**: ssh-ed25519 (intégrée)
- **Timeout par défaut**: 1 minute
- **Commande SSH**: `SSH_ORIGINAL_COMMAND="unblock <MAC> <minutes>" sh /tmp/kidtemp_unblock.sh`

### Démarrage rapide

1. **Cloner et configurer**
   ```bash
   git clone <repo>
   cd FreshTomatoUnblock
   cp env.example .env
   ```

2. **Modifier `.env`**
   ```bash
   ADMIN_PASSWORD=votre_mot_de_passe_admin
   SESSION_SECRET=votre_clé_session_sécurisée
   ```

3. **Lancer avec Docker**
   ```bash
   docker-compose up -d
   ```

4. **Accéder aux interfaces**
   - Interface utilisateur: http://localhost:3000
   - Interface admin: http://localhost:3000/admin

## 📱 Utilisation

### Pour les utilisateurs (enfants)
1. Ouvrir http://localhost:3000
2. Choisir la durée de déblocage (1-60 minutes)
3. Cliquer sur "Débloquer" pour l'appareil souhaité
4. Confirmation instantanée du déblocage

### Pour l'administrateur
1. Se connecter sur http://localhost:3000/admin
2. **Dashboard**: Voir les statistiques d'utilisation
3. **Appareils**: Ajouter/modifier/supprimer les appareils
4. **Configuration**: Configurer l'accès SSH au routeur
5. **Logs**: Consulter l'historique des déblocages
6. **Outils**: Exporter/importer la configuration

## ⚙️ Configuration

### Variables d'environnement
```bash
# Authentification admin
ADMIN_PASSWORD=mot_de_passe_sécurisé
SESSION_SECRET=clé_session_32_caractères_minimum

# Base de données et stockage
DB_PATH=/app/data/app.db
SSH_KEYS_PATH=/app/data/ssh_keys

# Configuration SSH par défaut
DEFAULT_ROUTER_IP=192.168.1.1
DEFAULT_SSH_USER=root
DEFAULT_TIMEOUT_MINUTES=1
MAX_TIMEOUT_MINUTES=60

# Serveur
NODE_ENV=production
PORT=3000
```

### Configuration SSH
L'interface admin permet de configurer :
- **IP du routeur** et utilisateur SSH
- **Clé SSH privée** (supporte OpenSSH, PuTTY .ppk, PEM)
- **Timeouts** par défaut et maximum
- **Test de connectivité** avant sauvegarde

### Gestion des appareils
- **Nom lisible** pour identification facile
- **Adresse MAC** au format XX:XX:XX:XX:XX:XX
- **Validation automatique** des formats
- **Tests de déblocage** depuis l'interface admin

## 🔧 Architecture technique

### Stack technologique
- **Backend**: Node.js + Express (léger, minimal dependencies)
- **Frontend**: Vanilla JavaScript + CSS moderne (pas de framework)
- **Base de données**: SQLite (fichier local, simple)
- **SSH**: node-ssh library
- **Docker**: Alpine-based (image optimisée)
- **Auth**: Session-based avec express-session

### Structure du projet
```
/
├── server.js              # Point d'entrée
├── config/database.js     # Configuration SQLite
├── routes/                # Routes API (auth, admin, unblock)
├── services/              # Services métier (SSH, devices, logs)
├── middleware/            # Auth et rate limiting
├── utils/                 # Utilitaires (validation, conversion clés)
├── public/
│   ├── admin/            # Interface administration
│   └── user/             # Interface utilisateur
└── data/                 # Données persistantes (DB, clés SSH)
```

### Sécurité implémentée
- **Rate limiting**: 5 tentatives/minute pour déblocage
- **Validation stricte**: MAC addresses, durées, IPs
- **Sessions sécurisées**: httpOnly cookies, CSRF protection
- **SSH sécurisé**: timeouts, validation des réponses
- **Logs complets**: audit trail complet
- **Input sanitization**: protection contre injections

## 📊 Monitoring et logs

### Logs disponibles
- **Déblocages**: Qui, quand, combien de temps
- **Connexions admin**: Tentatives et succès
- **Erreurs SSH**: Problèmes de connectivité
- **Rate limiting**: Tentatives excessives

### Statistiques dashboard
- Nombre d'appareils configurés
- Déblocages dans les dernières 24h/7j
- Statut de la connexion SSH
- Top des appareils les plus débloqués

## 🐳 Docker

### Images optimisées
- **Base**: node:18-alpine (légère)
- **Multi-stage build**: optimisation de la taille
- **User non-root**: sécurité container
- **Health check**: monitoring intégré

### Volumes Docker
```yaml
volumes:
  - ./data:/app/data  # Persistance SQLite + clés SSH
```

### Ports exposés
- **3000**: Interface web (utilisateur + admin)

## 🔄 Maintenance

### Nettoyage automatique
- **Logs anciens**: Suppression automatique > 90 jours
- **Clés temporaires**: Nettoyage après usage SSH
- **Sessions expirées**: Purge automatique

### Sauvegarde/Restauration
- **Export JSON**: Configuration + appareils
- **Import**: Restauration complète
- **Backup automatique**: Via volumes Docker

## 🚨 Troubleshooting

### Problèmes courants

1. **Connexion SSH échoue**
   - Vérifier IP routeur et clé SSH
   - Tester connectivité réseau
   - Vérifier utilisateur SSH (root par défaut)

2. **Déblocage ne fonctionne pas**
   - Vérifier que le script `/tmp/kidtemp_unblock.sh` existe sur le routeur
   - Tester la commande SSH manuellement
   - Vérifier les logs du routeur

3. **Interface admin inaccessible**
   - Vérifier le mot de passe admin (`ADMIN_PASSWORD`)
   - Effacer les cookies du navigateur
   - Redémarrer le container

### Commandes utiles
```bash
# Voir les logs du container
docker-compose logs -f

# Redémarrer le service
docker-compose restart

# Accéder au container
docker-compose exec freshtomato-unblock sh

# Sauvegarder les données
docker cp container_name:/app/data ./backup
```

## 📝 Notes importantes

- **Aucune modification** directe de la configuration FreshTomato
- **Script externe requis** sur le routeur (`/tmp/kidtemp_unblock.sh`)
- **Validation MAC stricte** (format XX:XX:XX:XX:XX:XX)
- **Durées limitées** entre 1 et 60 minutes
- **Rate limiting** pour éviter les abus

## 🛠️ Développement

### Démarrage en mode dev
```bash
npm install
npm run dev  # Mode watch avec nodemon
```

### Tests
```bash
npm test  # Tests unitaires (à implémenter)
```

### Structure de la base de données
- `config`: Configuration globale
- `devices`: Appareils gérés
- `unblock_logs`: Historique des déblocages

---

**FreshTomato Unblock Service** - Solution simple et sécurisée pour le contrôle parental intelligent.
