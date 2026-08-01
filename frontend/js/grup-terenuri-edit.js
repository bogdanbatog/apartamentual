// Group Terrain Edit Page JavaScript
let currentGroup = null;
let currentUser = null;
let linkedTerenuri = [];
let availableTerenuri = [];

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const accessDeniedEl = document.getElementById('access-denied');
const contentEl = document.getElementById('content');
const backToGroupLink = document.getElementById('back-to-group-link');
const backToGroupBtn = document.getElementById('back-to-group-btn');
const groupNameDisplay = document.getElementById('group-name-display');
const linkedTerrainsList = document.getElementById('linked-terrains-list');
const linkedTerrainsEmpty = document.getElementById('linked-terrains-empty');
const availableTerrainsContainer = document.getElementById('available-terrains-container');
const availableTerrainsTbody = document.getElementById('available-terrains-tbody');
const availableTerrainsEmpty = document.getElementById('available-terrains-empty');

// Status mapping for display
const statusMapping = {
    'active': { text: 'Disponibil', class: 'badge bg-green-100 text-green-800' },
    'under_review': { text: 'În analiză', class: 'badge bg-yellow-100 text-yellow-800' },
    'reserved': { text: 'Rezervat', class: 'badge bg-blue-100 text-blue-800' },
    'sold': { text: 'Vândut', class: 'badge bg-gray-100 text-gray-800' },
    'inactive': { text: 'Inactiv', class: 'badge bg-red-100 text-red-800' }
};

// Initialize the page
function initGrupTerenuriEdit() {
    try {
        // Get group ID from URL
        const groupId = getGroupIdFromUrl();
        if (!groupId) {
            showError('ID grup lipsă din URL');
            return;
        }

        // Set up event listeners
        setupEventListeners();
        
        // Load data
        loadData(groupId);
        
    } catch (error) {
        showError('Eroare la inițializarea paginii: ' + error.message);
    }
}

// Get group ID from URL
function getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('grup');
}

// Set up event listeners
function setupEventListeners() {
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const groupId = getGroupIdFromUrl();
            if (groupId) {
                loadData(groupId);
            }
        });
    }

    if (backToGroupLink) {
        backToGroupLink.addEventListener('click', (e) => {
            e.preventDefault();
            const groupId = getGroupIdFromUrl();
            window.location.href = `/grup-detail.html?grup=${groupId}`;
        });
    }

    if (backToGroupBtn) {
        backToGroupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const groupId = getGroupIdFromUrl();
            if (groupId) {
                window.location.href = `/grup-detail.html?grup=${groupId}`;
            } else {
                window.location.href = `/grup-detail.html`;
            }
        });
    }
}

// Load all data (user, group, terrains)
async function loadData(groupId) {
    try {
        showLoading(true);
        hideError();
        hideAccessDenied();
        hideContent();
        
        // Load current user
        await loadCurrentUser();
        
        // Load group data
        await loadGroup(groupId);
        
        // Check permissions
        if (!hasPermission()) {
            showAccessDenied();
            return;
        }
        
        // Load terrains
        await loadLinkedTerenuri(groupId);
        await loadAvailableTerenuri(groupId);
        
        // Render data
        renderData();
        
        showContent();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Eroare la încărcarea datelor: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Load current user
async function loadCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles_visible')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (profileError) throw profileError;
            
            currentUser = {
                id: user.id,
                email: user.email,
                ...profile
            };
        }
    } catch (error) {
        console.error('Error loading current user:', error);
        currentUser = null;
    }
}

// Load group data
async function loadGroup(groupId) {
    const { data, error } = await supabase
        .from('grup')
        .select('*')
        .eq('id', groupId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            throw new Error('Grupul nu a fost găsit');
        }
        throw error;
    }
    
    currentGroup = data;
}

// Check if user has permission (owner or super admin)
function hasPermission() {
    if (!currentUser || !currentGroup) return false;
    
    const isOwner = currentUser.id === currentGroup.owner_user_id;
    const isSuperAdmin = currentUser.is_super_admin === true;
    
    return isOwner || isSuperAdmin;
}

// Load linked terenuri for the group
async function loadLinkedTerenuri(groupId) {
    // Query join table, filtering out soft-deleted associations (removed_at IS NULL)
    const { data, error } = await supabase
        .from('grup_terenuri')
        .select(`
            terenuri(*)
        `)
        .eq('grup_id', groupId)
        .is('removed_at', null);
    
    if (error) throw error;
    
    linkedTerenuri = (data || [])
        .map(row => row.terenuri)
        .filter(Boolean);
}

// Load available terenuri (active, not deleted, not already linked)
async function loadAvailableTerenuri(groupId) {
    // First, get all linked terrain IDs (including soft-deleted ones to exclude them)
    const { data: linkedData, error: linkedError } = await supabase
        .from('grup_terenuri')
        .select('teren_id')
        .eq('grup_id', groupId);
    
    if (linkedError) throw linkedError;
    
    const linkedTerenIds = (linkedData || []).map(row => row.teren_id);
    
    // Get user profile to check if super admin
    const userProfile = await fetchUserProfile();
    const isSuperAdmin = userProfile?.is_super_admin;
    
    // Query active terenuri
    let query = supabase
        .from('terenuri')
        .select('*')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('data_adaugat', { ascending: false });
    
    // If not super admin, exclude linked terenuri
    // If super admin, show all active terenuri but we'll filter in JS
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filter out already linked terenuri
    availableTerenuri = (data || []).filter(
        teren => !linkedTerenIds.includes(teren.id)
    );
}

// Fetch user profile
async function fetchUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles_visible')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }

        return data;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

// Render all data
function renderData() {
    // Display group name
    if (groupNameDisplay && currentGroup) {
        groupNameDisplay.textContent = currentGroup.nume || 'Grup fără nume';
    }
    
    // Render linked terenuri
    renderLinkedTerenuri();
    
    // Render available terenuri
    renderAvailableTerenuri();
}

// Render linked terenuri using terrain card component
function renderLinkedTerenuri() {
    if (!linkedTerrainsList || !linkedTerrainsEmpty) return;
    
    if (linkedTerenuri.length === 0) {
        linkedTerrainsList.innerHTML = '';
        linkedTerrainsEmpty.style.display = 'block';
        return;
    }
    
    linkedTerrainsEmpty.style.display = 'none';
    linkedTerrainsList.innerHTML = linkedTerenuri.map(teren => {
        // Add remove button to each card
        const cardHtml = window.createTerrainCard(teren);
        // Wrap in a container with remove button
        return `
            <div class="relative">
                ${cardHtml}
                <button 
                    onclick="removeTerenFromGrup('${teren.id}')"
                    class="absolute bottom-2 right-2 bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                    title="Elimină terenul din grup"
                >
                    Elimină
                </button>
            </div>
        `;
    }).join('');
}

// Render available terenuri in table
function renderAvailableTerenuri() {
    if (!availableTerrainsContainer || !availableTerrainsTbody || !availableTerrainsEmpty) return;
    
    if (availableTerenuri.length === 0) {
        availableTerrainsContainer.style.display = 'none';
        availableTerrainsEmpty.style.display = 'block';
        return;
    }
    
    availableTerrainsEmpty.style.display = 'none';
    availableTerrainsContainer.style.display = 'block';
    
    availableTerrainsTbody.innerHTML = availableTerenuri.map(teren => {
        const status = statusMapping[teren.status] || { 
            text: teren.status, 
            class: 'badge bg-gray-100 text-gray-800' 
        };
        
        const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max
            ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}`
            : 'N/A';
        
        const suprafata = teren.suprafata ? `${teren.suprafata} mp` : 'N/A';
        const pretPeMp = teren.pret_pe_mp ? `${teren.pret_pe_mp} €/mp` : 'N/A';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(teren.titlu || 'Fără titlu')}</div>
                    <div class="text-sm text-gray-500 truncate max-w-xs">${escapeHtml(teren.descriere || '').substring(0, 100)}${teren.descriere && teren.descriere.length > 100 ? '...' : ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(teren.zona || 'N/A')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${suprafata}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pretPeMp}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${apartamenteRange}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="${status.class}">${status.text}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                        onclick="addTerenToGrup('${teren.id}')"
                        class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition duration-200"
                    >
                        Adaugă
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Add teren to grup
async function addTerenToGrup(terenId) {
    if (!currentGroup || !currentUser) {
        alert('Eroare: datele nu sunt încărcate corect');
        return;
    }
    
    try {
        // Insert new association
        const { error } = await supabase
            .from('grup_terenuri')
            .insert({
                grup_id: currentGroup.id,
                teren_id: terenId,
                created_by_user: currentUser.id
            });
        
        if (error) throw error;
        
        // Reload data to refresh UI
        await loadLinkedTerenuri(currentGroup.id);
        await loadAvailableTerenuri(currentGroup.id);
        renderData();
        
    } catch (error) {
        console.error('Error adding teren to grup:', error);
        alert('Eroare la adăugarea terenului: ' + error.message);
    }
}

// Remove teren from grup (soft delete by setting removed_at)
async function removeTerenFromGrup(terenId) {
    if (!currentGroup || !currentUser) {
        alert('Eroare: datele nu sunt încărcate corect');
        return;
    }
    
    if (!confirm('Sigur dorești să elimini acest teren din grup?')) {
        return;
    }
    
    try {
        // Soft delete by setting removed_at and removed_by_user
        const { error } = await supabase
            .from('grup_terenuri')
            .update({
                removed_at: new Date().toISOString(),
                removed_by_user: currentUser.id
            })
            .eq('grup_id', currentGroup.id)
            .eq('teren_id', terenId);
        
        if (error) throw error;
        
        // Reload data to refresh UI
        await loadLinkedTerenuri(currentGroup.id);
        await loadAvailableTerenuri(currentGroup.id);
        renderData();
        
    } catch (error) {
        console.error('Error removing teren from grup:', error);
        alert('Eroare la eliminarea terenului: ' + error.message);
    }
}

// Make functions globally available for onclick handlers
window.addTerenToGrup = addTerenToGrup;
window.removeTerenFromGrup = removeTerenFromGrup;

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show/hide loading state
function showLoading(show) {
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    if (errorEl) {
        if (errorMessageEl) {
            errorMessageEl.textContent = message;
        }
        errorEl.style.display = 'block';
    }
    console.error(message);
}

// Hide error message
function hideError() {
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

// Show access denied
function showAccessDenied() {
    if (accessDeniedEl) {
        accessDeniedEl.style.display = 'block';
    }
    if (contentEl) {
        contentEl.style.display = 'none';
    }
}

// Hide access denied
function hideAccessDenied() {
    if (accessDeniedEl) {
        accessDeniedEl.style.display = 'none';
    }
}

// Show content
function showContent() {
    if (contentEl) {
        contentEl.style.display = 'block';
    }
}

// Hide content
function hideContent() {
    if (contentEl) {
        contentEl.style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for supabase to be available
    if (typeof supabase !== 'undefined') {
        initGrupTerenuriEdit();
    } else {
        // Wait a bit for supabase to load
        setTimeout(() => {
            if (typeof supabase !== 'undefined') {
                initGrupTerenuriEdit();
            } else {
                showError('Supabase nu a fost încărcat. Vă rugăm să reîncărcați pagina.');
            }
        }, 1000);
    }
});

