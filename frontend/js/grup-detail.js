// Group Detail Page JavaScript
let currentGroup = null;
let currentUser = null;
let userMembership = null;
let groupOwner = null;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const notFoundEl = document.getElementById('not-found');
const groupContentEl = document.getElementById('group-content');
const retryBtn = document.getElementById('retry-btn');

// Status mapping for display
const statusMapping = {
    'active': { text: 'În formare', class: 'bg-green-100 text-green-800' },
    'inactive': { text: 'Inactiv', class: 'bg-gray-100 text-gray-800' },
    'full': { text: 'Complet', class: 'bg-blue-100 text-blue-800' },
    'completed': { text: 'Finalizat', class: 'bg-purple-100 text-purple-800' },
    'cancelled': { text: 'Anulat', class: 'bg-red-100 text-red-800' }
};

// Initialize the group detail page
function initGrupDetail() {
    try {
        // Get group ID from URL
        const groupId = getGroupIdFromUrl();
        if (!groupId) {
            showNotFound();
            return;
        }

        // Set up event listeners
        setupGrupDetailEventListeners();
        
        // Load group data
        loadGroupDetails(groupId);
        
    } catch (error) {
        showError('Error initializing group detail page: ' + error.message);
    }
}

// Get group ID from URL
function getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('grup');
}

// Set up event listeners (scoped for group detail page)
function setupGrupDetailEventListeners() {
    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const groupId = getGroupIdFromUrl();
            if (groupId) {
                loadGroupDetails(groupId);
            }
        });
    }
}

// Load group details from database
async function loadGroupDetails(groupId) {
    try {
        showLoading(true);
        hideError();
        hideNotFound();
        
        // Load current user
        await loadCurrentUser();
        
        // Load group data with membership info
        const { data: groupData, error: groupError } = await supabase
            .from('grup')
            .select(`
                *,
                grup_membership(
                    id,
                    user_id,
                    status,
                    role,
                    joined_at
                )
            `)
            .eq('id', groupId)
            .eq('is_disabled', false)
            .single();
        
        if (groupError) {
            if (groupError.code === 'PGRST116') {
                showNotFound();
                return;
            }
            throw groupError;
        }
        
        currentGroup = groupData;
        
        // Load group owner information
        await loadGroupOwner();
        
        // Check if current user is a member
        if (currentUser) {
            userMembership = groupData.grup_membership.find(
                membership => membership.user_id === currentUser.id
            );
        }
        
        // Render the group details
        renderGroupDetails();
        
    } catch (error) {
        console.error('Error loading group details:', error);
        showError('Eroare la încărcarea detaliilor grupului: ' + error.message);
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
                .from('profiles')
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
        // Don't throw error here, just set currentUser to null
        currentUser = null;
    }
}

// Load group owner information
async function loadGroupOwner() {
    try {
        if (!currentGroup) return;
        
        const { data: owner, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', currentGroup.owner_user_id)
            .single();
        
        if (error) throw error;
        
        groupOwner = owner;
    } catch (error) {
        console.error('Error loading group owner:', error);
        groupOwner = null;
    }
}

// Render group details to the page
function renderGroupDetails() {
    if (!currentGroup) return;
    
    // Show content
    groupContentEl.style.display = 'block';
    
    // Basic info
    document.getElementById('group-name').textContent = currentGroup.nume;
    document.getElementById('group-location').textContent = currentGroup.zona || 'Locație nespecificată';
    
    // Status badge
    const statusInfo = statusMapping[currentGroup.status] || { text: currentGroup.status, class: 'bg-gray-100 text-gray-800' };
    const statusEl = document.getElementById('group-status');
    statusEl.textContent = statusInfo.text;
    statusEl.className = `badge ${statusInfo.class}`;
    
    // Group image
    if (currentGroup.image_url) {
        const imageContainer = document.getElementById('group-image-container');
        const image = document.getElementById('group-image');
        image.src = currentGroup.image_url;
        image.onerror = function() {
            console.error('Failed to load group image:', currentGroup.image_url);
            imageContainer.style.display = 'none';
        };
        imageContainer.style.display = 'block';
    }
    
    // Description
    document.getElementById('group-description').textContent = currentGroup.descriere || 'Nu există descriere disponibilă.';
    
    // Project details
    document.getElementById('apartments-desired').textContent = 
        currentGroup.nr_apartamente_dorite ? currentGroup.nr_apartamente_dorite.toString() : 'Nespecificat';
    
    document.getElementById('budget-per-apartment').textContent = 
        currentGroup.buget_max_per_apartament ? `${currentGroup.buget_max_per_apartament} €` : 'Nespecificat';
    
    document.getElementById('project-start-date').textContent = 
        currentGroup.data_incepere_proiect ? formatDate(currentGroup.data_incepere_proiect) : 'Nespecificat';
    
    document.getElementById('project-end-date').textContent = 
        currentGroup.data_finalizare_proiect ? formatDate(currentGroup.data_finalizare_proiect) : 'Nespecificat';
    
    // Membership info
    const approvedMembers = currentGroup.grup_membership.filter(m => m.status === 'approved');
    const currentMembers = approvedMembers.length;
    const maxMembers = currentGroup.max_members;
    
    document.getElementById('current-members').textContent = currentMembers;
    document.getElementById('max-members').textContent = maxMembers;
    
    // Membership progress bar
    const progressPercentage = (currentMembers / maxMembers) * 100;
    document.getElementById('membership-progress').style.width = `${progressPercentage}%`;
    
    // Membership status text
    const membershipStatusText = document.getElementById('membership-status-text');
    if (currentMembers >= maxMembers) {
        membershipStatusText.textContent = 'Grupul este complet';
    } else {
        membershipStatusText.textContent = `${maxMembers - currentMembers} locuri disponibile`;
    }
    
    // Group owner
    if (groupOwner) {
        document.getElementById('group-owner-name').textContent = groupOwner.full_name || groupOwner.email;
    }
    
    // Dates
    document.getElementById('group-created-date').textContent = formatDate(currentGroup.created_at);
    document.getElementById('group-updated-date').textContent = formatDate(currentGroup.updated_at);
    
    // Generate and display tags
    const tags = generateGroupTags(currentGroup);
    if (tags.length > 0) {
        const tagsSection = document.getElementById('group-tags-section');
        const tagsContainer = document.getElementById('group-tags');
        tagsContainer.innerHTML = tags.map(tag => 
            `<span class="badge ${tag.class}">${tag.text}</span>`
        ).join('');
        tagsSection.style.display = 'block';
    }
    
    // Render join/leave section
    renderJoinSection();
    
    // Render owner actions
    renderOwnerActions();
}

// Render join/leave section based on user status
function renderJoinSection() {
    const joinSection = document.getElementById('join-section');
    const memberActions = document.getElementById('member-actions');
    
    if (!currentUser) {
        // User not logged in
        joinSection.innerHTML = `
            <button id="join-group-btn" class="primary" onclick="showAuthModal()">
                Alătură-te grupului
            </button>
        `;
    } else if (userMembership) {
        // User is already a member
        if (userMembership.status === 'approved') {
            joinSection.innerHTML = `
                <span class="badge bg-green-100 text-green-800">Membru activ</span>
            `;
            memberActions.style.display = 'block';
        } else if (userMembership.status === 'pending') {
            joinSection.innerHTML = `
                <span class="badge bg-yellow-100 text-yellow-800">Cerere în așteptare</span>
            `;
        } else if (userMembership.status === 'rejected') {
            joinSection.innerHTML = `
                <span class="badge bg-red-100 text-red-800">Cerere respinsă</span>
            `;
        }
    } else {
        // User is not a member
        const isGroupFull = currentGroup.grup_membership.filter(m => m.status === 'approved').length >= currentGroup.max_members;
        
        if (isGroupFull) {
            joinSection.innerHTML = `
                <span class="badge bg-gray-100 text-gray-800">Grup complet</span>
            `;
        } else {
            joinSection.innerHTML = `
                <button id="join-group-btn" class="primary">
                    Alătură-te grupului
                </button>
            `;
            
            // Add event listener for join button
            document.getElementById('join-group-btn').addEventListener('click', joinGroup);
        }
    }
    
    // Add event listener for leave button
    const leaveBtn = document.getElementById('leave-group-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', leaveGroup);
    }
}

// Render owner actions
function renderOwnerActions() {
    const ownerActions = document.getElementById('owner-actions');
    const editGroupBtn = document.getElementById('edit-group-btn');
    
    if (!ownerActions || !editGroupBtn) return;
    
    // Show owner actions if current user is the group owner
    if (currentUser && currentGroup && currentUser.id === currentGroup.owner_user_id) {
        ownerActions.style.display = 'block';
        editGroupBtn.href = `/grup-form.html?id=${currentGroup.id}`;
    } else {
        ownerActions.style.display = 'none';
    }
}

// Join group function
async function joinGroup() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('grup_membership')
            .insert({
                grup_id: currentGroup.id,
                user_id: currentUser.id,
                status: 'pending'
            });
        
        if (error) throw error;
        
        // Show success message
        alert('Cererea de aderare a fost trimisă! Administratorul grupului va examina cererea.');
        
        // Reload group details to update UI
        loadGroupDetails(currentGroup.id);
        
    } catch (error) {
        console.error('Error joining group:', error);
        alert('Eroare la trimiterea cererii de aderare: ' + error.message);
    }
}

// Leave group function
async function leaveGroup() {
    if (!userMembership) return;
    
    if (!confirm('Ești sigur că vrei să părăsești acest grup?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('grup_membership')
            .update({
                status: 'left',
                left_at: new Date().toISOString()
            })
            .eq('id', userMembership.id);
        
        if (error) throw error;
        
        // Show success message
        alert('Ai părăsit grupul cu succes.');
        
        // Reload group details to update UI
        loadGroupDetails(currentGroup.id);
        
    } catch (error) {
        console.error('Error leaving group:', error);
        alert('Eroare la părăsirea grupului: ' + error.message);
    }
}

// Generate tags based on group characteristics
function generateGroupTags(grup) {
    const tags = [];
    const descriere = (grup.descriere || '').toLowerCase();
    const nume = (grup.nume || '').toLowerCase();
    
    // Age-based tags
    if (descriere.includes('senior') || nume.includes('senior') || descriere.includes('55+')) {
        tags.push({ text: '55+', class: 'bg-orange-100 text-orange-800' });
    }
    if (descriere.includes('tineri') || descriere.includes('25-35') || nume.includes('student')) {
        tags.push({ text: '25-35 ani', class: 'bg-red-100 text-red-800' });
    }
    
    // Lifestyle tags
    if (descriere.includes('eco') || descriere.includes('sustenabil') || descriere.includes('verde')) {
        tags.push({ text: 'Eco-friendly', class: 'bg-green-100 text-green-800' });
    }
    if (descriere.includes('familie') || descriere.includes('copii')) {
        tags.push({ text: 'Familii cu copii', class: 'bg-blue-100 text-blue-800' });
    }
    if (descriere.includes('co-housing') || descriere.includes('comunitar')) {
        tags.push({ text: 'Co-housing', class: 'bg-purple-100 text-purple-800' });
    }
    if (descriere.includes('tech') || descriere.includes('modern')) {
        tags.push({ text: 'Tech-oriented', class: 'bg-purple-100 text-purple-800' });
    }
    if (descriere.includes('accesibil') || descriere.includes('senior')) {
        tags.push({ text: 'Accessible design', class: 'bg-blue-100 text-blue-800' });
    }
    
    return tags;
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Show loading state
function showLoading(show) {
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    if (errorEl) {
        const errorMessageEl = document.getElementById('error-message');
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

// Show not found message
function showNotFound() {
    if (notFoundEl) {
        notFoundEl.style.display = 'block';
    }
    if (groupContentEl) {
        groupContentEl.style.display = 'none';
    }
}

// Hide not found message
function hideNotFound() {
    if (notFoundEl) {
        notFoundEl.style.display = 'none';
    }
}

// Show auth modal (placeholder - should be implemented in auth-modal.js)
function showAuthModal() {
    // This should trigger the auth modal
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.classList.remove('hidden');
    } else {
        // Fallback: redirect to login
        window.location.href = '/grupuri.html';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for supabase to be available
    if (typeof supabase !== 'undefined') {
        initGrupDetail();
    } else {
        // Wait a bit for supabase to load
        setTimeout(() => {
            if (typeof supabase !== 'undefined') {
                initGrupDetail();
            } else {
                showError('Supabase nu a fost încărcat. Vă rugăm să reîncărcați pagina.');
            }
        }, 1000);
    }
});
