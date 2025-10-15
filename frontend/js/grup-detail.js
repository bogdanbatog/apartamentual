// Group Detail Page JavaScript
let currentGroup = null;
let currentUser = null;
let userMembership = null;
let groupOwner = null;

// Markdown rendering is now handled by markdown-utils.js

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
        
        // Check if user is super admin to determine query
        const isSuperAdmin = currentUser?.is_super_admin || false;
        
        // Load group data with membership info
        let query = supabase
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
            .eq('id', groupId);
            
        // If not super admin, only show non-disabled groups
        if (!isSuperAdmin) {
            query = query.eq('is_disabled', false);
        }
        
        const { data: groupData, error: groupError } = await query.single();
        
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
    
    // Check if group is disabled
    const isDisabled = currentGroup.is_disabled === true;
    
    // Add disabled indicator if group is disabled
    if (isDisabled) {
        const disabledIndicator = document.createElement('div');
        disabledIndicator.className = 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg';
        disabledIndicator.innerHTML = `
            <div class="flex items-center">
                <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <span class="text-red-800 font-medium">Acest grup este dezactivat</span>
            </div>
        `;
        
        // Insert the disabled indicator at the top of the group content
        const groupContent = document.getElementById('group-content');
        if (groupContent) {
            groupContent.insertBefore(disabledIndicator, groupContent.firstChild);
        }
        
        // Apply visual styling to the main content
        if (groupContent) {
            groupContent.classList.add('opacity-75');
        }
    }
    
    // Basic info
    document.getElementById('group-name').textContent = currentGroup.nume;
    document.getElementById('group-location').textContent = currentGroup.zona || 'Locație nespecificată';
    
    // Status badge - show disabled status if applicable
    let statusInfo = statusMapping[currentGroup.status] || { text: currentGroup.status, class: 'bg-gray-100 text-gray-800' };
    if (isDisabled) {
        statusInfo = { text: 'Dezactivat', class: 'bg-red-100 text-red-800' };
    }
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
    
    // Description (render markdown)
    const descriereEl = document.getElementById('group-description');
    try {
        if (currentGroup.descriere && currentGroup.descriere.trim()) {
            descriereEl.innerHTML = renderMarkdown(currentGroup.descriere);
        } else {
            descriereEl.textContent = 'Nu există descriere disponibilă.';
        }
    } catch (error) {
        console.error('Error rendering group description markdown:', error);
        descriereEl.textContent = currentGroup.descriere || 'Nu există descriere disponibilă.';
    }
    
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
        const displayName = groupOwner.full_name || redactEmail(groupOwner.email);
        document.getElementById('group-owner-name').textContent = displayName;
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

    // Render owner/super admin membership management section
    renderOwnerMembershipSection();
}

// Render join/leave section based on user status
function renderJoinSection() {
    const joinSection = document.getElementById('join-section');
    const memberActions = document.getElementById('member-actions');
    const isOwner = currentUser && currentGroup && currentUser.id === currentGroup.owner_user_id;
    
    // Reset member actions visibility by default
    if (memberActions) {
        memberActions.style.display = 'none';
    }

    // If current user is the owner, show owner info and no join/leave buttons
    if (isOwner) {
        if (joinSection) {
            joinSection.innerHTML = `
                <span class="badge bg-blue-100 text-blue-800">Ești creatorul acestui grup</span>
            `;
        }
        return;
    }

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
            // Show leave button only for members who are not owners
            if (memberActions) {
                memberActions.style.display = 'block';
            }
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

// Render owner/super admin membership management
async function renderOwnerMembershipSection() {
    const section = document.getElementById('owner-membership-section');
    if (!section || !currentGroup) return;

    const isOwner = currentUser && currentUser.id === currentGroup.owner_user_id;
    const isSuperAdmin = !!(currentUser && currentUser.is_super_admin);

    // Show only if owner or super admin
    if (!isOwner && !isSuperAdmin) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Show admin view note if super admin and not owner
    const adminViewNote = document.getElementById('admin-view-note');
    if (adminViewNote) {
        if (isSuperAdmin && !isOwner) {
            adminViewNote.style.display = 'inline';
        } else {
            adminViewNote.style.display = 'none';
        }
    }

    // Prepare lists
    const approvedList = document.getElementById('owner-members-approved');
    const pendingList = document.getElementById('owner-members-pending');
    const removedList = document.getElementById('owner-members-removed');

    const approvedEmpty = document.getElementById('owner-members-approved-empty');
    const pendingEmpty = document.getElementById('owner-members-pending-empty');
    const removedEmpty = document.getElementById('owner-members-removed-empty');

    if (!approvedList || !pendingList || !removedList) return;

    const memberships = Array.isArray(currentGroup.grup_membership) ? currentGroup.grup_membership : [];

    // Fetch profiles for all user_ids
    const userIds = memberships.map(m => m.user_id).filter(Boolean);
    const profilesByUserId = await fetchProfilesByUserIds(userIds);

    // Build items
    const approvedItems = memberships
        .filter(m => m.status === 'approved')
        .map(m => createMemberItem(m, profilesByUserId, { showApprove: false }));

    const pendingItems = memberships
        .filter(m => m.status === 'pending')
        .map(m => createMemberItem(m, profilesByUserId, { showApprove: true }));

    const removedItems = memberships
        .filter(m => m.status === 'removed' || m.status === 'left' || m.status === 'rejected')
        .map(m => createMemberItem(m, profilesByUserId, { showApprove: false }));

    approvedList.innerHTML = approvedItems.join('');
    pendingList.innerHTML = pendingItems.join('');
    removedList.innerHTML = removedItems.join('');

    if (approvedEmpty) approvedEmpty.style.display = approvedItems.length ? 'none' : 'block';
    if (pendingEmpty) pendingEmpty.style.display = pendingItems.length ? 'none' : 'block';
    if (removedEmpty) removedEmpty.style.display = removedItems.length ? 'none' : 'block';

    // Wire approve buttons
    if (pendingItems.length) {
        pendingList.querySelectorAll('[data-approve-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-approve-id');
                await approveMembership(id);
            });
        });
    }
}

// Helper: fetch profiles for a set of user ids
async function fetchProfilesByUserIds(userIds) {
    const map = new Map();
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    if (unique.length === 0) return map;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', unique);
        if (error) throw error;
        (data || []).forEach(p => map.set(p.user_id, p));
    } catch (err) {
        console.error('Error fetching member profiles:', err);
    }
    return map;
}

// Helper: create list item HTML for a membership
function createMemberItem(membership, profilesByUserId, options) {
    const { showApprove } = options || {};
    const profile = profilesByUserId.get(membership.user_id) || {};
    const displayName = profile.full_name || redactEmail(profile.email || '');
    const roleText = membership.role ? ` · rol: ${membership.role}` : '';
    const statusBadge = membership.status === 'pending'
        ? '<span class="badge bg-yellow-100 text-yellow-800">în așteptare</span>'
        : membership.status === 'approved'
            ? '<span class="badge bg-green-100 text-green-800">aprobat</span>'
            : `<span class="badge bg-gray-100 text-gray-800">${membership.status}</span>`;

    const approveButton = showApprove
        ? `<button class="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700" data-approve-id="${membership.id}">Aprobă</button>`
        : '';

    return `
        <li class="flex items-center justify-between">
            <div class="truncate">
                <span class="font-medium">${escapeHtml(displayName || 'Utilizator')}</span>
                <span class="text-gray-500">${roleText}</span>
            </div>
            <div class="flex items-center gap-2">
                ${statusBadge}
                ${approveButton}
            </div>
        </li>
    `;
}

// Approve membership
async function approveMembership(membershipId) {
    if (!membershipId) return;
    try {
        const { error } = await supabase
            .from('grup_membership')
            .update({ status: 'approved', joined_at: new Date().toISOString() })
            .eq('id', membershipId);
        if (error) throw error;
        // Reload details to refresh lists and counters
        await loadGroupDetails(currentGroup.id);
    } catch (err) {
        console.error('Error approving membership:', err);
        alert('Eroare la aprobare: ' + err.message);
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
    if (descriere.includes('accesibil') || descriere.includes('senior')) {
        tags.push({ text: 'Accessible design', class: 'bg-blue-100 text-blue-800' });
    }
    
    return tags;
}

// Redact email to show only first few and last few characters
function redactEmail(email) {
    if (!email || !email.includes('@')) return email;
    
    const [localPart, domain] = email.split('@');
    
    // Show first 2 characters and last 2 characters of local part
    if (localPart.length <= 4) {
        // If email is very short, show first character and last character
        return localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1) + '@' + domain;
    } else {
        // Show first 2
        return localPart.substring(0, 2) + '*'.repeat(localPart.length - 2) + '@' + domain;
    }
}

// Escape HTML to prevent XSS when rendering names/emails
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
