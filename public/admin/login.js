// Login page JavaScript
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const loginBtn = loginForm.querySelector('.login-btn');
const btnText = loginBtn.querySelector('.btn-text');
const btnSpinner = loginBtn.querySelector('.btn-spinner');
const errorDiv = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = passwordInput.value.trim();
    if (!password) return;

    // État de chargement
    loginBtn.disabled = true;
    btnText.textContent = 'Connexion...';
    btnSpinner.classList.remove('hidden');
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Important for session cookies
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Petite pause pour s'assurer que la session est enregistrée
            setTimeout(() => {
                window.location.href = '/admin/';
            }, 100);
        } else {
            throw new Error(data.error || 'Erreur de connexion');
        }

    } catch (error) {
        console.error('Erreur connexion:', error);
        
        errorDiv.textContent = error.message.includes('Trop de tentatives')
            ? 'Trop de tentatives. Veuillez attendre avant de réessayer.'
            : 'Mot de passe incorrect';
        errorDiv.classList.remove('hidden');
        
        // Secouer le formulaire
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 500);
        
        passwordInput.focus();
        passwordInput.select();
    } finally {
        // Restaurer l'état du bouton
        loginBtn.disabled = false;
        btnText.textContent = 'Se connecter';
        btnSpinner.classList.add('hidden');
    }
});

// Vérifier si déjà connecté
fetch('/auth/status', {
    credentials: 'include'
})
    .then(response => response.json())
    .then(data => {
        if (data.isAuthenticated) {
            window.location.href = '/admin/';
        }
    })
    .catch(() => {
        // Ignorer les erreurs de vérification
    });
