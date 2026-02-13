

// Initialize the app — uses global `sb` / `supabase` from supabase-config.js
function initApp() {
    try {
        // Check if user is already logged in
        checkAuth();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        showMessage('Error initializing Supabase: ' + error.message, 'error');
    }
}

// Check authentication state
async function checkAuth() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        updateUI(user);
    } catch (error) {
        showMessage('Error checking auth state: ' + error.message, 'error');
    }
}


// Function to clear custom auth message
function clearCustomAuthMessage() {
    const customMessage = document.getElementById('custom-auth-message');
    if (customMessage) {
        customMessage.classList.add('hidden');
    }
}

// Set up event listeners
function setupEventListeners() {
    const authToggle = document.getElementById('auth-toggle');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn'); // Auth modal logout button

    // If auth modal elements aren't ready yet, retry after a short delay
    if (!authModal || !loginBtn) {
        setTimeout(setupEventListeners, 50);
        return;
    }

    if (authToggle) {
        authToggle.addEventListener('click', () => {
            authModal.classList.remove('hidden');
        });
    }

    if (closeAuthModal) {
        closeAuthModal.addEventListener('click', () => {
            authModal.classList.add('hidden');
            clearCustomAuthMessage();
        });
    }

    // Close modal when clicking outside
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
                clearCustomAuthMessage();
            }
        });
    }

    if (loginBtn) loginBtn.addEventListener('click', signIn);
    if (logoutBtn) logoutBtn.addEventListener('click', signOut);
    
    // Allow Enter key to trigger sign in
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !document.getElementById('login-form').classList.contains('hidden')) {
            signIn();
        }
    });
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        updateUI(session?.user || null);
    });
}

// Sign in function
async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please enter both email and password.', 'error');
        return;
    }
    
    // Show loading state
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn ? loginBtn.textContent : '';
    if (loginBtn) {
        loginBtn.textContent = 'Se autentifică...';
        loginBtn.disabled = true;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (error) {
            showMessage('Autentificare eșuată: ' + error.message, 'error');
            if (loginBtn) {
                loginBtn.textContent = originalText || 'Autentificare';
                loginBtn.disabled = false;
            }
        } else {
            showMessage('Autentificare reușită!', 'success');
            clearForm();
            
            // Close modal
            const authModal = document.getElementById('auth-modal');
            if (authModal) authModal.classList.add('hidden');
            
            // Check for redirect URL (e.g. from invitation link)
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect');
            if (redirectUrl) {
                window.location.href = decodeURIComponent(redirectUrl);
            } else {
                // Reload to update UI
                window.location.reload();
            }
        }
    } catch (error) {
        showMessage('Eroare la autentificare: ' + error.message, 'error');
        if (loginBtn) {
            loginBtn.textContent = originalText || 'Autentificare';
            loginBtn.disabled = false;
        }
    }
}

// Sign up function
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please enter both email and password.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long.', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });
        
        if (error) {
            showMessage('Sign up failed: ' + error.message, 'error');
        } else {
            showMessage('Sign up successful! Please check your email for verification.', 'success');
            clearForm();
        }
    } catch (error) {
        showMessage('Error during sign up: ' + error.message, 'error');
    }
}

// Sign out function
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showMessage('Sign out failed: ' + error.message, 'error');
        } else {
            showMessage('Signed out successfully!', 'success');
            // Redirect to home page after successful logout
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
        }
    } catch (error) {
        showMessage('Error during sign out: ' + error.message, 'error');
    }
}

// Update UI based on authentication state
function updateUI(user) {
    const loginForm = document.getElementById('login-form');
    const logoutSection = document.getElementById('logout-section');
    const authState = document.getElementById('auth-state');
    const userEmail = document.getElementById('user-email');
    const authToggle = document.getElementById('auth-toggle');
    
    // Set global user ID for navigation
    window.currentUserId = user ? user.id : null;
    
    if (user) {
        // User is logged in
        if (loginForm) loginForm.classList.add('hidden');
        if (logoutSection) logoutSection.classList.remove('hidden');
        if (authState) authState.classList.remove('hidden');
        if (userEmail) userEmail.textContent = user.email;
        if (authToggle) authToggle.textContent = 'Profil';
        
        // Update navigation auth state
        if (typeof updateAuthUI === 'function') {
            updateAuthUI(user);
        }
    } else {
        // User is logged out
        if (loginForm) loginForm.classList.remove('hidden');
        if (logoutSection) logoutSection.classList.add('hidden');
        if (authState) authState.classList.add('hidden');
        if (authToggle) authToggle.textContent = 'Login/Sign Up';
        
        // Update navigation auth state
        if (typeof updateAuthUI === 'function') {
            updateAuthUI(null);
        }
    }
}

// Show messages
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.classList.remove('hidden');
    messageDiv.className = 'mt-4 p-3 rounded-md text-sm';
    
    if (type === 'success') {
        messageDiv.classList.add('bg-green-50', 'text-green-800', 'border', 'border-green-200');
    } else {
        messageDiv.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
    }
    
    messageDiv.textContent = text;
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

// Clear form inputs
function clearForm() {
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Global function for nav.js to open login modal
function openLoginModal() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.classList.remove('hidden');
        // Focus email field
        setTimeout(() => {
            const emailField = document.getElementById('email');
            if (emailField) emailField.focus();
        }, 100);
    }
}
