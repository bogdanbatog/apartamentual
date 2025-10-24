// Profile View JavaScript
// Handles displaying user profiles

let currentProfile = null;
let currentUser = null;

// Initialize profile view
function initProfileView() {
    // Wait for Supabase to be initialized
    if (typeof supabase === 'undefined') {
        setTimeout(initProfileView, 100);
        return;
    }
    
    // Get user ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
        showError('ID-ul utilizatorului nu a fost specificat.');
        return;
    }
    
    // Check if user is authenticated
    checkAuthAndLoadProfile(userId);
}

// Check authentication and load profile
async function checkAuthAndLoadProfile(userId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        
        // Always try to load the profile, regardless of authentication status
        await loadProfile(userId);
    } catch (error) {
        console.error('Error checking auth:', error);
        showError('Eroare la verificarea autentificării: ' + error.message);
    }
}

// Load profile data
async function loadProfile(userId) {
    try {
        showLoading();
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                showNotFound();
                return;
            }
            throw error;
        }
        
        currentProfile = profile;
        displayProfile(profile);
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('Eroare la încărcarea profilului: ' + error.message);
    }
}

// Display profile data
function displayProfile(profile) {
    hideAllStates();
    
    // Update header
    const profileName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Utilizator';
    document.getElementById('profile-name').textContent = profileName;
    document.getElementById('profile-email').textContent = profile.email;
    
    // Show edit button if this is the current user's profile
    if (currentUser && currentUser.id === profile.user_id) {
        document.getElementById('edit-profile-section').style.display = 'flex';
        document.getElementById('edit-profile-btn').href = `/profile-edit.html`;
        document.getElementById('profile-actions').style.display = 'block';
    }
    
    // Personal Information
    document.getElementById('profile-first-name').textContent = profile.first_name || '-';
    document.getElementById('profile-last-name').textContent = profile.last_name || '-';
    document.getElementById('profile-age').textContent = profile.varsta ? `${profile.varsta} ani` : '-';
    document.getElementById('profile-profession').textContent = profile.profesie || '-';
    
    // Apartment Preferences
    document.getElementById('profile-apartment-type').textContent = profile.tip_apartament_cauta || '-';
    document.getElementById('profile-preferred-area').textContent = profile.zona || '-';
    
    // Profile Stats
    document.getElementById('profile-created-date').textContent = formatDate(profile.created_at);
    document.getElementById('profile-updated-date').textContent = formatDate(profile.updated_at);
    
    // Contact Information
    document.getElementById('profile-contact-email').textContent = profile.email;
    document.getElementById('profile-contact-phone').textContent = profile.phone || '-';
    
    // Show profile content
    document.getElementById('profile-content').style.display = 'block';
}

// Show loading state
function showLoading() {
    hideAllStates();
    document.getElementById('loading').style.display = 'block';
}

// Show error state
function showError(message) {
    hideAllStates();
    document.getElementById('error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
}

// Show not found state
function showNotFound() {
    hideAllStates();
    document.getElementById('not-found').style.display = 'block';
}

// Show not authenticated state
function showNotAuthenticated() {
    hideAllStates();
    document.getElementById('not-found').style.display = 'block';
    document.getElementById('not-found').innerHTML = `
        <div class="text-gray-400 text-6xl mb-4">🔒</div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Trebuie să fii autentificat</h3>
        <p class="text-gray-600 mb-4">Trebuie să te autentifici pentru a vedea profilurile.</p>
        <button id="profile-auth-toggle" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200">
            Autentifică-te
        </button>
    `;
    
    // Add event listener for auth toggle
    document.getElementById('profile-auth-toggle').addEventListener('click', () => {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
        }
    });
}

// Hide all states
function hideAllStates() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('not-found').style.display = 'none';
    document.getElementById('profile-content').style.display = 'none';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Retry loading profile
function retryLoadProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (userId) {
        loadProfile(userId);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryLoadProfile);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initProfileView();
});
