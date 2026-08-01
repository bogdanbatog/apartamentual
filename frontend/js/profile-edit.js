// Profile Edit JavaScript
// Handles editing user profiles

let currentUser = null;
let originalProfile = null;

// Initialize profile edit
function initProfileEdit() {
    checkAuthAndLoadProfile();
}

// Check authentication and load profile
async function checkAuthAndLoadProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        
        if (!user) {
            showNotAuthenticated();
            return;
        }
        
        await loadProfile();
    } catch (error) {
        console.error('Error checking auth:', error);
        showError('Eroare la verificarea autentificării: ' + error.message);
    }
}

// Load current user's profile
async function loadProfile() {
    try {
        showLoading();
        
        const { data: profile, error } = await supabase
            .from('profiles_visible')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) {
            throw error;
        }
        
        originalProfile = profile;
        populateForm(profile);
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('Eroare la încărcarea profilului: ' + error.message);
    }
}

// Populate form with profile data
function populateForm(profile) {
    // Personal Information
    document.getElementById('first_name').value = profile.first_name || '';
    document.getElementById('last_name').value = profile.last_name || '';
    document.getElementById('varsta').value = profile.varsta || '';
    document.getElementById('profesie').value = profile.profesie || '';
    document.getElementById('phone').value = profile.phone || '';
    
    // Apartment Preferences
    document.getElementById('tip_apartament_cauta').value = profile.tip_apartament_cauta || '';
    document.getElementById('zona').value = profile.zona || '';
    
    // Contact Information
    document.getElementById('email').value = profile.email || '';
    
    // Set the view profile link to the user's own profile
    const viewProfileLink = document.getElementById('view-profile-link');
    if (viewProfileLink && currentUser) {
        viewProfileLink.href = `/profile-view.html?id=${currentUser.id}`;
    }
    
    // Show form
    hideAllStates();
    document.getElementById('profile-edit-content').style.display = 'block';
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    try {
        // Get form data
        const formData = new FormData(event.target);
        const profileData = {
            first_name: formData.get('first_name') || null,
            last_name: formData.get('last_name') || null,
            varsta: formData.get('varsta') ? parseInt(formData.get('varsta')) : null,
            profesie: formData.get('profesie') || null,
            phone: formData.get('phone') || null,
            tip_apartament_cauta: formData.get('tip_apartament_cauta') || null,
            zona: formData.get('zona') || null,
            updated_at: new Date().toISOString()
        };
        
        // Validate age if provided
        if (profileData.varsta && (profileData.varsta < 18 || profileData.varsta > 120)) {
            showMessage('Vârsta trebuie să fie între 18 și 120 de ani.', 'error');
            return;
        }
        
        // Update profile
        const { error } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        // Show success message
        showMessage('Profilul a fost actualizat cu succes!', 'success');
        
        // Update original profile
        originalProfile = { ...originalProfile, ...profileData };
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage('Eroare la actualizarea profilului: ' + error.message, 'error');
    }
}

// Handle cancel button
function handleCancel() {
    if (confirm('Ești sigur că vrei să anulezi modificările? Toate modificările nesalvate vor fi pierdute.')) {
        // Reset form to original values
        if (originalProfile) {
            populateForm(originalProfile);
        }
    }
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

// Show not authenticated state
function showNotAuthenticated() {
    hideAllStates();
    document.getElementById('not-authenticated').style.display = 'block';
}

// Hide all states
function hideAllStates() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('not-authenticated').style.display = 'none';
    document.getElementById('profile-edit-content').style.display = 'none';
}

// Show message
function showMessage(text, type) {
    const messageDiv = document.getElementById('success-message');
    
    if (type === 'success') {
        messageDiv.style.display = 'block';
        messageDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-4 mb-6';
        messageDiv.querySelector('h3').textContent = 'Profil actualizat cu succes!';
        messageDiv.querySelector('p').textContent = text;
    } else {
        // Create error message if it doesn't exist
        let errorDiv = document.getElementById('error-message-form');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-message-form';
            errorDiv.className = 'bg-red-50 border border-red-200 rounded-lg p-4 mb-6';
            errorDiv.innerHTML = `
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">Eroare</h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p></p>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('profile-form').insertBefore(errorDiv, document.getElementById('profile-form').firstChild);
        }
        
        errorDiv.style.display = 'block';
        errorDiv.querySelector('p').textContent = text;
    }
    
    // Hide message after 5 seconds
    setTimeout(() => {
        if (type === 'success') {
            messageDiv.style.display = 'none';
        } else {
            const errorDiv = document.getElementById('error-message-form');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }
    }, 5000);
}

// Retry loading profile
function retryLoadProfile() {
    loadProfile();
}

// Set up event listeners
function setupEventListeners() {
    // Form submission
    const form = document.getElementById('profile-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
    
    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryLoadProfile);
    }
    
    // Auth toggle
    const authToggle = document.getElementById('edit-auth-toggle');
    if (authToggle) {
        authToggle.addEventListener('click', () => {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.classList.remove('hidden');
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initProfileEdit();
});
