// État global de l'application admin
const adminApp = {
    currentSection: 'dashboard',
    devices: [],
    logs: [],
    config: {},
    stats: {}
};

// Éléments DOM
const elements = {
    notification: document.getElementById('notification'),
    navBtns: document.querySelectorAll('.nav-btn'),
    sections: document.querySelectorAll('.admin-section'),
    logoutBtn: document.getElementById('logout-btn')
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
});

async function initAdmin() {
    try {
        // Vérifier l'authentification
        const authResponse = await fetch('/auth/status', {
            credentials: 'include'
        });
        const authData = await authResponse.json();
        
        if (!authData.isAuthenticated) {
            window.location.href = '/admin/login.html';
            return;
        }

        // Initialiser l'interface
        initNavigation();
        initEventListeners();
        setupModalEventListeners();
        await loadDashboard();
        
    } catch (error) {
        console.error('Erreur initialisation admin:', error);
        showNotification('Erreur de chargement de l\'interface admin', 'error');
    }
}

function initNavigation() {
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(sectionName) {
    // Mettre à jour la navigation
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionName);
    });
    
    // Mettre à jour les sections
    elements.sections.forEach(section => {
        section.classList.toggle('active', section.id === `${sectionName}-section`);
    });
    
    adminApp.currentSection = sectionName;
    
    // Charger le contenu de la section
    switch (sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'devices':
            loadDevices();
            break;
        case 'config':
            loadConfig();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'tools':
            initTools();
            break;
    }
}

function initEventListeners() {
    // Déconnexion
    elements.logoutBtn.addEventListener('click', logout);
    
    // Dashboard
    document.getElementById('test-ssh-btn')?.addEventListener('click', testSshConnection);
    document.getElementById('refresh-stats-btn')?.addEventListener('click', loadDashboard);
    
    // Appareils
    document.getElementById('add-device-btn')?.addEventListener('click', () => openDeviceModal());
    document.getElementById('device-form')?.addEventListener('submit', saveDevice);
    
    // Configuration
    document.getElementById('config-form')?.addEventListener('submit', saveConfig);
    document.getElementById('test-config-btn')?.addEventListener('click', testConfig);
    
    // Logs
    document.getElementById('refresh-logs-btn')?.addEventListener('click', loadLogs);
    document.getElementById('cleanup-logs-btn')?.addEventListener('click', cleanupLogs);
    
    // Outils
    document.getElementById('export-config-btn')?.addEventListener('click', exportConfig);
    document.getElementById('import-file')?.addEventListener('change', importConfig);
    document.getElementById('test-all-btn')?.addEventListener('click', testAll);
}

function setupModalEventListeners() {
    console.log('Setting up modal event listeners');
    
    // Gestionnaire pour le bouton X
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        console.log('Adding listener to close button:', button);
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Direct close button clicked');
            const modalId = button.getAttribute('data-modal');
            if (modalId) {
                closeModal(modalId);
            }
        });
    });
    
    // Gestionnaire pour les boutons Annuler
    const cancelButtons = document.querySelectorAll('.modal-cancel');
    cancelButtons.forEach(button => {
        console.log('Adding listener to cancel button:', button);
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Direct cancel button clicked');
            const modalId = button.getAttribute('data-modal');
            if (modalId) {
                closeModal(modalId);
            }
        });
    });
}

// === DASHBOARD ===
async function loadDashboard() {
    try {
        const response = await fetch('/admin/api/dashboard', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            adminApp.stats = data.stats;
            updateDashboardStats(data.stats);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        showNotification('Erreur de chargement des statistiques', 'error');
    }
}

function updateDashboardStats(stats) {
    document.getElementById('total-devices').textContent = stats.total_devices || 0;
    document.getElementById('unlocks-24h').textContent = stats.total_unlocks_24h || 0;
    document.getElementById('unlocks-7d').textContent = stats.total_unlocks_7d || 0;
    
    const sshStatus = document.getElementById('ssh-status');
    sshStatus.textContent = 'À tester';
    sshStatus.style.color = 'var(--warning-color)';
}

async function testSshConnection() {
    const btn = document.getElementById('test-ssh-btn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '🔍 Test en cours...';
    
    try {
        const response = await fetch('/admin/api/test-ssh', { 
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        
        const sshStatus = document.getElementById('ssh-status');
        
        if (data.success) {
            sshStatus.textContent = '✅ Connecté';
            sshStatus.style.color = 'var(--success-color)';
            showNotification('Connexion SSH réussie', 'success');
        } else {
            sshStatus.textContent = '❌ Erreur';
            sshStatus.style.color = 'var(--danger-color)';
            showNotification(`Erreur SSH: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur test SSH:', error);
        showNotification('Erreur lors du test SSH', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// === APPAREILS ===
async function loadDevices() {
    try {
        const response = await fetch('/admin/api/devices', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            adminApp.devices = data.devices;
            renderDevicesTable();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur chargement appareils:', error);
        showNotification('Erreur de chargement des appareils', 'error');
    }
}

function renderDevicesTable() {
    const tbody = document.querySelector('#devices-table tbody');
    tbody.innerHTML = '';
    
    if (adminApp.devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Aucun appareil configuré</td></tr>';
        return;
    }
    
    adminApp.devices.forEach(device => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(device.name)}</td>
            <td><code>${device.mac}</code></td>
            <td>${formatDate(device.created_at)}</td>
            <td class="table-actions">
                <button class="btn btn-secondary" onclick="testDeviceUnblock(${device.id})">🧪 Test</button>
                <button class="btn btn-primary" onclick="editDevice(${device.id})">✏️ Modifier</button>
                <button class="btn btn-danger" onclick="deleteDevice(${device.id})">🗑️ Supprimer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openDeviceModal(deviceId = null) {
    const modal = document.getElementById('device-modal');
    const form = document.getElementById('device-form');
    const title = document.getElementById('modal-title');
    
    form.reset();
    
    if (deviceId) {
        const device = adminApp.devices.find(d => d.id === deviceId);
        if (device) {
            title.textContent = 'Modifier l\'appareil';
            document.getElementById('device-id').value = device.id;
            document.getElementById('device-name').value = device.name;
            document.getElementById('device-mac').value = device.mac;
        }
    } else {
        title.textContent = 'Ajouter un appareil';
    }
    
    modal.classList.remove('hidden');
}

function editDevice(deviceId) {
    openDeviceModal(deviceId);
}

async function saveDevice(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceData = {
        name: formData.get('name'),
        mac: formData.get('mac')
    };
    
    const deviceId = formData.get('id');
    const isEdit = deviceId && deviceId !== '';
    
    try {
        const url = isEdit ? `/admin/api/devices/${deviceId}` : '/admin/api/devices';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(deviceData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            closeModal('device-modal');
            await loadDevices();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur sauvegarde appareil:', error);
        showNotification(error.message, 'error');
    }
}

async function deleteDevice(deviceId) {
    const device = adminApp.devices.find(d => d.id === deviceId);
    if (!device) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'appareil "${device.name}" ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/api/devices/${deviceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            await loadDevices();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur suppression appareil:', error);
        showNotification(error.message, 'error');
    }
}

async function testDeviceUnblock(deviceId) {
    const device = adminApp.devices.find(d => d.id === deviceId);
    if (!device) return;
    
    try {
        const response = await fetch('/admin/api/test-unblock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ deviceId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Test de déblocage réussi pour ${device.name}`, 'success');
        } else {
            showNotification(`Échec du test pour ${device.name}: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur test déblocage:', error);
        showNotification('Erreur lors du test de déblocage', 'error');
    }
}

// === CONFIGURATION ===
async function loadConfig() {
    try {
        const response = await fetch('/admin/api/config', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            adminApp.config = data.config;
            populateConfigForm(data.config);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur chargement config:', error);
        showNotification('Erreur de chargement de la configuration', 'error');
    }
}

function populateConfigForm(config) {
    document.getElementById('router-ip').value = config.router_ip || '';
    document.getElementById('ssh-user').value = config.ssh_user || '';
    document.getElementById('ssh-key').value = config.ssh_key || '';
    document.getElementById('default-timeout').value = config.default_timeout_minutes || '';
    document.getElementById('max-timeout').value = config.max_timeout_minutes || '';
}

async function saveConfig(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const configData = {
        router_ip: formData.get('router_ip'),
        ssh_user: formData.get('ssh_user'),
        ssh_key: formData.get('ssh_key'),
        default_timeout_minutes: formData.get('default_timeout_minutes'),
        max_timeout_minutes: formData.get('max_timeout_minutes')
    };
    
    try {
        const response = await fetch('/admin/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(configData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur sauvegarde config:', error);
        showNotification(error.message, 'error');
    }
}

async function testConfig() {
    await testSshConnection();
}

// === LOGS ===
async function loadLogs() {
    try {
        const response = await fetch('/admin/api/logs?limit=100', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            adminApp.logs = data.logs;
            renderLogsTable();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur chargement logs:', error);
        showNotification('Erreur de chargement des logs', 'error');
    }
}

function renderLogsTable() {
    const tbody = document.querySelector('#logs-table tbody');
    tbody.innerHTML = '';
    
    if (adminApp.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Aucun log disponible</td></tr>';
        return;
    }
    
    adminApp.logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${escapeHtml(log.device_name || 'Appareil supprimé')}</td>
            <td><code>${log.device_mac || 'N/A'}</code></td>
            <td>${log.source_ip}</td>
            <td>${log.duration_minutes} min</td>
        `;
        tbody.appendChild(row);
    });
}

async function cleanupLogs() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer les logs de plus de 90 jours ?')) {
        return;
    }
    
    try {
        const response = await fetch('/admin/api/cleanup-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ days: 90 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            await loadLogs();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Erreur nettoyage logs:', error);
        showNotification('Erreur lors du nettoyage des logs', 'error');
    }
}

// === OUTILS ===
function initTools() {
    // Les événements sont déjà initialisés
}

async function exportConfig() {
    try {
        const response = await fetch('/admin/api/export', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'freshtomato-unblock-config.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('Configuration exportée avec succès', 'success');
        } else {
            throw new Error('Erreur lors de l\'export');
        }
    } catch (error) {
        console.error('Erreur export:', error);
        showNotification('Erreur lors de l\'export', 'error');
    }
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const configData = JSON.parse(event.target.result);
            
            const response = await fetch('/admin/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(configData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                // Recharger les sections
                await loadDevices();
                await loadConfig();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Erreur import:', error);
            showNotification('Erreur lors de l\'import: ' + error.message, 'error');
        } finally {
            e.target.value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
}

async function testAll() {
    const btn = document.getElementById('test-all-btn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '🔍 Tests en cours...';
    
    try {
        // Test SSH
        showNotification('Test de la connexion SSH...', 'info');
        await testSshConnection();
        
        // Test d'un appareil (si disponible)
        if (adminApp.devices.length > 0) {
            showNotification('Test de déblocage...', 'info');
            await testDeviceUnblock(adminApp.devices[0].id);
        }
        
        showNotification('Tests terminés', 'success');
    } catch (error) {
        console.error('Erreur tests:', error);
        showNotification('Erreur lors des tests', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// === UTILITAIRES ===
async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        window.location.href = '/admin/login.html';
    }
}

function showNotification(message, type = 'info') {
    const notification = elements.notification;
    
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.classList.remove('hidden');
    
    // Auto-hide après 5 secondes
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
    
    // Permettre de fermer en cliquant
    notification.onclick = () => {
        notification.classList.add('hidden');
    };
}

// Make functions globally available for inline onclick handlers
window.closeModal = function(modalId) {
    console.log('closeModal called with:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        console.log('Modal closed successfully');
    } else {
        console.error('Modal not found:', modalId);
    }
}

// Make device functions globally available
window.testDeviceUnblock = testDeviceUnblock;
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;

// Make key upload functions globally available
window.handleKeyFileUpload = handleKeyFileUpload;
window.convertExistingKey = convertExistingKey;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
        return 'N/A';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString('fr-FR');
    } catch {
        return 'N/A';
    }
}

// === KEY FILE UPLOAD ===
async function handleKeyFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const content = await readFileContent(file);
        const keyTextarea = document.getElementById('ssh-key');
        
        if (file.name.toLowerCase().endsWith('.ppk') || content.includes('PuTTY-User-Key-File')) {
            // Convertir le fichier PPK via le backend
            try {
                showNotification('Conversion PPK en cours...', 'info');
                const response = await fetch('/admin/api/convert-key', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ keyContent: content })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    keyTextarea.value = result.convertedKey;
                    showNotification(result.message, 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Erreur conversion PPK:', error);
                // Afficher le message d'erreur avec les instructions dans une alerte
                alert('CONVERSION PPK REQUISE:\n\n' + error.message);
                showNotification('Conversion PPK manuelle requise - voir les instructions', 'warning');
            }
        } else {
            // Fichier PEM/OpenSSH, copier directement
            keyTextarea.value = content;
            showNotification('Clé SSH chargée avec succès', 'success');
        }
    } catch (error) {
        console.error('Erreur lecture fichier:', error);
        showNotification('Erreur lors de la lecture du fichier: ' + error.message, 'error');
    }
}

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur lecture fichier'));
        reader.readAsText(file);
    });
}

function convertPpkToOpenSsh(ppkContent) {
    // Simple parser pour les fichiers PPK PuTTY v2
    const lines = ppkContent.split('\n');
    
    // Vérifier que c'est un fichier PPK valide
    if (!lines[0].includes('PuTTY-User-Key-File')) {
        throw new Error('Fichier PPK invalide - en-tête manquant');
    }
    
    // Extraire les informations du fichier PPK
    let keyType = '';
    let publicLines = [];
    let privateLines = [];
    let inPublicSection = false;
    let inPrivateSection = false;
    
    for (const line of lines) {
        if (line.startsWith('PuTTY-User-Key-File-')) {
            // Version PPK
            continue;
        } else if (line.startsWith('Encryption:')) {
            if (!line.includes('none')) {
                throw new Error('Clé PPK chiffrée non supportée. Utilisez une clé sans mot de passe.');
            }
        } else if (line.startsWith('Comment:')) {
            // Commentaire
            continue;
        } else if (line.startsWith('Public-Lines:')) {
            inPublicSection = true;
            continue;
        } else if (line.startsWith('Private-Lines:')) {
            inPublicSection = false;
            inPrivateSection = true;
            continue;
        } else if (line.startsWith('Private-MAC:')) {
            inPrivateSection = false;
            break;
        } else if (inPublicSection && line.trim()) {
            publicLines.push(line.trim());
        } else if (inPrivateSection && line.trim()) {
            privateLines.push(line.trim());
        }
    }
    
    if (privateLines.length === 0) {
        throw new Error('Aucune clé privée trouvée dans le fichier PPK');
    }
    
    // Pour une conversion basique, on va demander à l'utilisateur d'utiliser puttygen
    throw new Error('Conversion PPK automatique non implémentée. Veuillez utiliser PuTTYgen pour convertir votre clé .ppk en format OpenSSH et copier-coller le résultat.');
}

async function convertExistingKey() {
    const keyTextarea = document.getElementById('ssh-key');
    const content = keyTextarea.value.trim();
    
    if (!content) {
        showNotification('Veuillez d\'abord saisir ou coller une clé dans la zone de texte', 'warning');
        return;
    }
    
    try {
        showNotification('Conversion en cours...', 'info');
        
        const response = await fetch('/admin/api/convert-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ keyContent: content })
        });
        
        const result = await response.json();
        
        if (result.success) {
            keyTextarea.value = result.convertedKey;
            showNotification(result.message, 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Erreur conversion clé:', error);
        showNotification('Erreur lors de la conversion: ' + error.message, 'error');
    }
}

// Gestionnaires d'événements pour les modales
document.addEventListener('click', (e) => {
    console.log('Click event:', e.target, 'Classes:', e.target.classList.toString());
    
    // Fermer en cliquant à l'extérieur
    if (e.target.classList.contains('modal')) {
        console.log('Closing modal by clicking outside');
        e.target.classList.add('hidden');
    }
    
    // Fermer avec le bouton X
    if (e.target.classList.contains('modal-close')) {
        console.log('Close button clicked');
        const modalId = e.target.getAttribute('data-modal');
        console.log('Modal ID:', modalId);
        if (modalId) {
            closeModal(modalId);
        }
    }
    
    // Fermer avec le bouton Annuler
    if (e.target.classList.contains('modal-cancel')) {
        console.log('Cancel button clicked');
        const modalId = e.target.getAttribute('data-modal');
        console.log('Modal ID:', modalId);
        if (modalId) {
            closeModal(modalId);
        }
    }
});

// Fermer les modales avec la touche Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
            openModal.classList.add('hidden');
        }
    }
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur JavaScript:', e.error);
    showNotification('Une erreur inattendue s\'est produite.', 'error');
});
