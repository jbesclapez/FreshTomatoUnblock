// État global de l'application
const app = {
    devices: [],
    config: {
        default_timeout: 1,
        max_timeout: 60
    },
    selectedDuration: 1
};

// Éléments DOM
const elements = {
    loading: document.getElementById('loading'),
    configSection: document.getElementById('config-section'),
    devicesContainer: document.getElementById('devices-container'),
    devicesList: document.getElementById('devices-list'),
    noDevices: document.getElementById('no-devices'),
    notification: document.getElementById('notification'),
    durationSelect: document.getElementById('duration')
};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        // Charger la configuration et les appareils en parallèle
        const [configResponse, devicesResponse] = await Promise.all([
            fetch('/api/config'),
            fetch('/api/devices')
        ]);

        if (!configResponse.ok || !devicesResponse.ok) {
            throw new Error('Erreur de chargement des données');
        }

        const configData = await configResponse.json();
        const devicesData = await devicesResponse.json();

        app.config = configData;
        app.devices = devicesData.devices;
        app.selectedDuration = app.config.default_timeout;

        initDurationSelector();
        renderDevices();
        hideLoading();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showNotification('Erreur de chargement. Veuillez actualiser la page.', 'error');
        hideLoading();
    }
}

function initDurationSelector() {
    const select = elements.durationSelect;
    select.innerHTML = '';

    // Générer les options de 1 à max_timeout
    for (let i = 1; i <= app.config.max_timeout; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        
        if (i === app.config.default_timeout) {
            option.selected = true;
        }
        
        select.appendChild(option);
    }

    // Écouter les changements
    select.addEventListener('change', (e) => {
        app.selectedDuration = parseInt(e.target.value);
        updateDeviceButtons();
    });

    elements.configSection.classList.remove('hidden');
}

function renderDevices() {
    const container = elements.devicesList;
    container.innerHTML = '';

    if (app.devices.length === 0) {
        elements.noDevices.classList.remove('hidden');
        elements.devicesContainer.classList.add('hidden');
        return;
    }

    elements.noDevices.classList.add('hidden');
    elements.devicesContainer.classList.remove('hidden');

    app.devices.forEach(device => {
        const card = createDeviceCard(device);
        container.appendChild(card);
    });
}

function createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.dataset.deviceId = device.id;

    card.innerHTML = `
        <div class="device-name">${escapeHtml(device.name)}</div>
        <div class="device-mac">${device.mac}</div>
        <button class="unblock-btn" onclick="unblockDevice(${device.id})">
            <span class="btn-text">🔓 Débloquer</span>
            <span class="btn-duration">${app.selectedDuration}min</span>
        </button>
    `;

    return card;
}

function updateDeviceButtons() {
    const buttons = document.querySelectorAll('.unblock-btn');
    buttons.forEach(btn => {
        const durationSpan = btn.querySelector('.btn-duration');
        if (durationSpan) {
            durationSpan.textContent = `${app.selectedDuration}min`;
        }
    });
}

async function unblockDevice(deviceId) {
    const device = app.devices.find(d => d.id === deviceId);
    if (!device) return;

    const card = document.querySelector(`[data-device-id="${deviceId}"]`);
    const button = card.querySelector('.unblock-btn');
    
    // État de chargement
    card.classList.add('unlocking');
    button.disabled = true;
    button.innerHTML = `
        <span class="btn-spinner"></span>
        <span>Déblocage en cours...</span>
    `;

    try {
        const response = await fetch('/api/unblock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceId: deviceId,
                duration: app.selectedDuration
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification(data.message, 'success');
            
            // Animation de succès
            button.innerHTML = `
                <span>✅ Débloqué pour ${app.selectedDuration}min</span>
            `;
            
            // Remettre le bouton normal après 3 secondes
            setTimeout(() => {
                resetButton(button, card);
            }, 3000);
            
        } else {
            throw new Error(data.message || data.error || 'Erreur inconnue');
        }

    } catch (error) {
        console.error('Erreur déblocage:', error);
        showNotification(
            error.message.includes('Trop de tentatives') 
                ? 'Trop de tentatives. Veuillez attendre avant de réessayer.'
                : 'Erreur lors du déblocage. Veuillez réessayer.',
            'error'
        );
        
        resetButton(button, card);
    }
}

function resetButton(button, card) {
    card.classList.remove('unlocking');
    button.disabled = false;
    button.innerHTML = `
        <span class="btn-text">🔓 Débloquer</span>
        <span class="btn-duration">${app.selectedDuration}min</span>
    `;
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

function hideLoading() {
    elements.loading.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur JavaScript:', e.error);
    showNotification('Une erreur inattendue s\'est produite.', 'error');
});

// Auto-refresh des appareils toutes les 30 secondes (optionnel)
setInterval(async () => {
    try {
        const response = await fetch('/api/devices');
        if (response.ok) {
            const data = await response.json();
            
            // Mettre à jour seulement si la liste a changé
            if (JSON.stringify(app.devices) !== JSON.stringify(data.devices)) {
                app.devices = data.devices;
                renderDevices();
            }
        }
    } catch (error) {
        // Ignorer les erreurs de refresh silencieusement
        console.warn('Erreur refresh appareils:', error);
    }
}, 30000);
