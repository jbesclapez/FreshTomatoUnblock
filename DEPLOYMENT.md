# FreshTomato Unblock - Deployment Guide

## 🖥️ Development (Windows)

```bash
# Default development setup (SSH will timeout but web interface works)
docker-compose up -d

# Access: http://localhost:3000
```

## 🏠 Production (Synology NAS)

### Step 1: Transfer Files to Synology

1. Copy the project folder to your Synology NAS (192.168.1.10)
2. SSH into your Synology or use File Station

### Step 2: Deploy with Production Configuration

```bash
# On Synology, use production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Or set environment variables
export ADMIN_PASSWORD="your_secure_password"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Step 3: Access the Service

- **Web Interface**: `http://192.168.1.10:3000`
- **Admin Interface**: `http://192.168.1.10:3000/admin`

## 🔧 Configuration

### Router SSH Setup

1. **Convert your PPK key** to OpenSSH format using PuTTYgen:
   ```bash
   puttygen kidtemp_router.ppk -O private-openssh -o kidtemp_router.key
   ```

2. **In Admin Interface**:
   - Router IP: `192.168.1.1`
   - SSH User: `root`
   - SSH Key: Upload your converted `.key` file

3. **Test SSH Connection** in the admin interface

## 🌐 Network Architecture

```
User Device (192.168.1.x)
    ↓
Synology NAS (192.168.1.10:3000)
    ↓ SSH
FreshTomato Router (192.168.1.1:22)
```

## 🔒 Security

- Change the default admin password
- Use strong SSH keys
- Configure firewall rules on Synology if needed
- Review unblock logs regularly

## 🚨 Troubleshooting

### SSH Connection Issues
1. Verify SSH key format (OpenSSH private key)
2. Check router SSH is enabled
3. Test SSH manually from Synology: `ssh root@192.168.1.1`
4. Check network connectivity: `ping 192.168.1.1`

### Web Interface Issues
1. Check container status: `docker-compose ps`
2. View logs: `docker-compose logs -f`
3. Verify port 3000 is not blocked
