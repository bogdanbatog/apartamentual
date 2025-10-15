// Auth Modal component
function createAuthModal() {
    const authModalHTML = `
        <!-- Auth Modal -->
        <div id="auth-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">Autentificare</h2>
                    <button id="close-auth-modal" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <!-- Auth State Display -->
                <div id="auth-state" class="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 hidden">
                    <p class="text-blue-800">Bine ai venit, <span id="user-email" class="font-semibold"></span>!</p>
                </div>
                
                <!-- Login Form -->
                <div id="login-form" class="space-y-4">
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" id="email" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
                        <input type="password" id="password" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div class="space-y-3">
                        <button id="login-btn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200">
                            Autentificare
                        </button>
                        
                        <button id="signup-btn" class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-200">
                            Înregistrare
                        </button>
                    </div>
                </div>
                
                <!-- Logout Button -->
                <div id="logout-section" class="hidden">
                    <button id="logout-btn" class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-200">
                        Deconectare
                    </button>
                </div>
                
                <!-- Messages -->
                <div id="message" class="mt-4 hidden"></div>
            </div>
        </div>
    `;

    return authModalHTML;
}

// Function to inject auth modal into the page
function loadAuthModal() {
    // Create a container for the auth modal if it doesn't exist
    let authContainer = document.getElementById('auth-modal-container');
    if (!authContainer) {
        authContainer = document.createElement('div');
        authContainer.id = 'auth-modal-container';
        document.body.appendChild(authContainer);
    }
    
    // Inject the auth modal HTML
    authContainer.innerHTML = createAuthModal();
}

// Initialize auth modal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadAuthModal();
});

// Shared helpers to be reused across pages
async function isUserAuthenticated() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user !== null;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

function openAuthModalWithMessage(message) {
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');

    if (authModal && loginForm) {
        let customMessage = document.getElementById('custom-auth-message');
        if (!customMessage) {
            customMessage = document.createElement('div');
            customMessage.id = 'custom-auth-message';
            customMessage.className = 'mb-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm';
            loginForm.parentNode.insertBefore(customMessage, loginForm);
        }
        customMessage.textContent = message;
        customMessage.classList.remove('hidden');

        authModal.classList.remove('hidden');
    }
}

// Global interceptor for any link to terenuri-propune.html
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', async (event) => {
        // Only handle unmodified left-clicks
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const anchor = event.target.closest('a');
        if (!anchor || !anchor.href) return;

        try {
            const url = new URL(anchor.href, window.location.origin);
            // Match both absolute and relative links, with or without leading slash, and allow query params
            const isProposeTerenLink = url.pathname.endsWith('/terenuri-propune.html') || url.pathname === 'terenuri-propune.html';
            if (!isProposeTerenLink) return;

            event.preventDefault();

            const authenticated = await isUserAuthenticated();
            if (authenticated) {
                window.location.href = url.href;
            } else {
                openAuthModalWithMessage('Va rugam sa va inregistrati sau sa intrati in contul dvs. pentru a adauga un teren.');
            }
        } catch (e) {
            // If URL parsing fails, do nothing
        }
    });
});
