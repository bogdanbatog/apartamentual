// Status mapping for display
const statusMapping = {
    'active': { text: 'Disponibil', class: 'bg-green-100 text-green-800' },
    'under_review': { text: 'În analiză', class: 'bg-yellow-100 text-yellow-800' },
    'reserved': { text: 'Rezervat', class: 'bg-blue-100 text-blue-800' },
    'sold': { text: 'Vândut', class: 'bg-gray-100 text-gray-800' },
    'inactive': { text: 'Inactiv', class: 'bg-red-100 text-red-800' }
};

// Global state for group likes
let userGroups = [];
let terenGroupLikes = [];
let currentTerenId = null;

// Extract teren ID from URL query parameter
function getTerenIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Get image URL from storage. Prefers the new image_urls array (first element
// = primary image). Falls back to the legacy image_url scalar so both old and
// new data render correctly during the rollout.
function getImageUrl(teren) {
    if (teren.image_urls && Array.isArray(teren.image_urls) && teren.image_urls.length > 0) {
        return teren.image_urls[0];
    }
    if (teren.image_url) {
        return teren.image_url;
    }
    return null;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Image modal functions
function openImageModal() {
    const imageSrc = document.getElementById('teren-image').src;
    if (imageSrc) {
        document.getElementById('modal-image').src = imageSrc;
        document.getElementById('image-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Fetch user profile data
async function fetchUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
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

// Fetch user's groups (where they are active member)
async function fetchUserGroups() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('grup_membri')
            .select(`
                grup_id,
                grupuri:grup_id (
                    id,
                    nume,
                    status
                )
            `)
            .eq('user_id', user.id)
            .eq('status', 'activ');

        if (error) {
            console.error("Error fetching user groups:", error);
            return [];
        }

        // Extract and filter valid groups
        return (data || [])
            .map(m => m.grupuri)
            .filter(g => g && g.status !== 'arhivat');
    } catch (error) {
        console.error("Error fetching user groups:", error);
        return [];
    }
}

// Fetch which groups have liked this teren
async function fetchTerenGroupLikes(terenId) {
    try {
        const { data, error } = await supabase
            .from('terenuri_likes_grupuri')
            .select('grup_id')
            .eq('teren_id', terenId);

        if (error) {
            console.error("Error fetching teren group likes:", error);
            return [];
        }

        return (data || []).map(l => l.grup_id);
    } catch (error) {
        console.error("Error fetching teren group likes:", error);
        return [];
    }
}

// Toggle group like for teren
async function toggleGroupLike(grupId) {
    if (!currentTerenId) return;

    const isLiked = terenGroupLikes.includes(grupId);
    
    try {
        if (isLiked) {
            // Remove like
            const { error } = await supabase
                .from('terenuri_likes_grupuri')
                .delete()
                .eq('teren_id', currentTerenId)
                .eq('grup_id', grupId);

            if (error) throw error;
            
            terenGroupLikes = terenGroupLikes.filter(id => id !== grupId);
            showToast('Terenul a fost eliminat din favoritele grupului.', 'success');
        } else {
            // Add like
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Trebuie să fii autentificat.', 'error');
                return;
            }

            const { error } = await supabase
                .from('terenuri_likes_grupuri')
                .insert({
                    teren_id: currentTerenId,
                    grup_id: grupId,
                    added_by: user.id
                });

            if (error) throw error;
            
            terenGroupLikes.push(grupId);
            showToast('Terenul a fost adăugat la favoritele grupului!', 'success');
        }

        // Update UI
        renderGroupLikesSection();
        
    } catch (error) {
        console.error('Error toggling group like:', error);
        showToast('A apărut o eroare. Încearcă din nou.', 'error');
    }
}

// Render group likes section
function renderGroupLikesSection() {
    const container = document.getElementById('group-likes-section');
    if (!container) return;

    // No groups - hide section
    if (userGroups.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    
    const groupsHtml = userGroups.map(group => {
        const isLiked = terenGroupLikes.includes(group.id);
        return `
            <button 
                onclick="toggleGroupLike('${group.id}')"
                class="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    isLiked 
                        ? 'bg-orange-100 border-orange-300 text-orange-800' 
                        : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                }"
            >
                <svg class="w-5 h-5 ${isLiked ? 'text-orange-500' : 'text-gray-400'}" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
                <span class="font-medium">${escapeHtml(group.nume)}</span>
                ${isLiked ? '<span class="text-xs bg-orange-200 px-2 py-0.5 rounded">Adăugat</span>' : ''}
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                Adaugă la unul din grupurile tale
            </h3>
            <p class="text-sm text-gray-600 mb-3">Selectează grupurile tale care ar putea fi interesate de acest teren:</p>
            <div class="flex flex-wrap gap-2">
                ${groupsHtml}
            </div>
        </div>
    `;
}

// Check if teren is already liked and update button state
async function checkTerenLikeState(terenId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existing } = await supabase
            .from('terenuri_likes')
            .select('id')
            .eq('teren_id', terenId)
            .eq('user_id', user.id)
            .maybeSingle();

        const btnLike = document.getElementById('btn-like-profil');
        if (btnLike && existing) {
            updateLikeButton(btnLike, true);
        }
    } catch (e) {
        console.warn('Could not check like state:', e);
    }
}

// Update like button appearance
function updateLikeButton(btn, isLiked) {
    const svg = btn.querySelector('svg');
    // Get or create the text node
    const textNodes = Array.from(btn.childNodes).filter(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !n.matches('svg')));
    
    if (isLiked) {
        svg.setAttribute('fill', 'currentColor');
        svg.classList.remove('text-gray-500');
        svg.classList.add('text-orange-500');
        btn.classList.add('bg-orange-50', 'border-orange-300');
        btn.classList.remove('border-gray-300');
        // Update text
        const spanText = btn.querySelector('.btn-like-text');
        if (spanText) {
            spanText.textContent = 'Adăugat la profil';
        } else {
            // Replace raw text
            btn.innerHTML = btn.innerHTML.replace('Adaugă la profil', '<span class="btn-like-text">Adăugat la profil</span>');
        }
    } else {
        svg.setAttribute('fill', 'none');
        svg.classList.remove('text-orange-500');
        svg.classList.add('text-gray-500');
        btn.classList.remove('bg-orange-50', 'border-orange-300');
        btn.classList.add('border-gray-300');
        const spanText = btn.querySelector('.btn-like-text');
        if (spanText) {
            spanText.textContent = 'Adaugă la profil';
        } else {
            btn.innerHTML = btn.innerHTML.replace('Adăugat la profil', '<span class="btn-like-text">Adaugă la profil</span>');
        }
    }
}

// Toggle personal teren like (add to profile favorites)
async function toggleTerenLike(terenId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Trebuie să fii autentificat.', 'error');
            return;
        }

        // Check if already liked
        const { data: existing } = await supabase
            .from('terenuri_likes')
            .select('id')
            .eq('teren_id', terenId)
            .eq('user_id', user.id)
            .maybeSingle();

        const btnLike = document.getElementById('btn-like-profil');

        if (existing) {
            // Remove like
            await supabase
                .from('terenuri_likes')
                .delete()
                .eq('teren_id', terenId)
                .eq('user_id', user.id);
            
            if (btnLike) updateLikeButton(btnLike, false);
            showToast('Terenul a fost eliminat din favorite.', 'success');
        } else {
            // Add like
            await supabase
                .from('terenuri_likes')
                .insert({ teren_id: terenId, user_id: user.id });
            
            if (btnLike) updateLikeButton(btnLike, true);
            showToast('Terenul a fost adăugat la favorite!', 'success');
        }
    } catch (error) {
        console.error('Error toggling teren like:', error);
        showToast('A apărut o eroare.', 'error');
    }
}

// Toast notification
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-y-0 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-gray-800 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('opacity-100'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fetch teren details
async function fetchTerenDetails() {
    const terenId = getTerenIdFromUrl();
    currentTerenId = terenId;
    
    if (!terenId) {
        showNotFound();
        return;
    }

    // Terenurile în status "pending" sunt vizibile doar pentru superadmin și
    // proprietar (via RLS). Dacă userul nu e logat, query-ul cu .single()
    // întoarce 0 rânduri și Supabase aruncă "Cannot coerce the result to a
    // single JSON object" — o eroare tehnică lipsită de sens pentru user.
    // Interceptăm aici: dacă nu e logat, arătăm modalul de login cu un mesaj
    // clar. După login, login-modal.js face window.location.reload(), deci
    // userul rămâne pe aceeași pagină și vede terenul dacă are drept.
    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            hideLoading();
            if (typeof openAuthModalWithMessage === 'function') {
                openAuthModalWithMessage('Te rugăm să te autentifici pentru a vedea detaliile terenului.');
            } else {
                // Fallback dacă auth-modal.js nu s-a încărcat încă
                window.location.href = '/index.html?login=1';
            }
            return;
        }
    } catch (e) {
        console.warn('Auth check failed, continuing:', e);
    }

    try {
        showLoading();
        
        // Fetch teren details, user profile, user groups, and teren group likes in parallel
        const [terenResult, userProfile, groups, groupLikes] = await Promise.all([
            supabase
                .from('terenuri')
                .select('*')
                .eq('id', terenId)
                .single(),
            fetchUserProfile(),
            fetchUserGroups(),
            fetchTerenGroupLikes(terenId)
        ]);

        const { data: terenData, error: terenError } = terenResult;

        if (terenError) {
            throw terenError;
        }

        if (!terenData) {
            showNotFound();
            return;
        }

        // Store groups and likes in global state
        userGroups = groups;
        terenGroupLikes = groupLikes;

        await displayTerenDetails(terenData, userProfile);
        renderGroupLikesSection();
        loadInterestCounts(terenId, terenData);
        hideLoading();
        
    } catch (error) {
        console.error("Error fetching teren details:", error);
        const errorMessage = error.message || "A apărut o eroare la încărcarea detaliilor terenului.";
        showError(errorMessage);
    }
}

// Display teren details
async function displayTerenDetails(teren, userProfile) {
    // Update page title
    document.title = `${teren.titlu} - ApartamenTUal`;
    
    // Check if teren is disabled (soft deleted)
    const isDisabled = teren.deleted_at !== null;
    
    // Add disabled indicator to the page
    if (isDisabled) {
        const backButton = document.querySelector('.mb-6');
        if (backButton && !document.getElementById('disabled-indicator')) {
            const disabledIndicator = document.createElement('div');
            disabledIndicator.id = 'disabled-indicator';
            disabledIndicator.className = 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg';
            disabledIndicator.innerHTML = `
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Acest teren este dezactivat</span>
                </div>
            `;
            backButton.insertAdjacentElement('afterend', disabledIndicator);
        }
        
        const mainContent = document.querySelector('.grid.lg\\:grid-cols-2');
        if (mainContent) {
            mainContent.classList.add('opacity-75');
        }
    }
    
    // Basic information
    document.getElementById('teren-title').textContent = teren.titlu || 'Teren fără titlu';
    document.getElementById('teren-description').textContent = teren.descriere || 'Fără descriere disponibilă';
    
    // Status
    let status = statusMapping[teren.status] || { text: teren.status, class: 'bg-gray-100 text-gray-800' };
    if (isDisabled) {
        status = { text: 'Dezactivat', class: 'bg-red-100 text-red-800' };
    }
    const statusEl = document.getElementById('teren-status');
    statusEl.textContent = status.text;
    statusEl.className = `badge ${status.class}`;
    
    // Basic details
    document.getElementById('teren-suprafata').textContent = teren.suprafata ? `${teren.suprafata} mp` : 'N/A';
    document.getElementById('teren-zona').textContent = teren.zona || 'N/A';
    
    // Preț total
    const pretTotalEl = document.getElementById('teren-pret-total');
    if (teren.pret_total) {
        pretTotalEl.textContent = `${Number(teren.pret_total).toLocaleString('ro-RO')} €`;
    } else {
        pretTotalEl.textContent = 'N/A';
    }
    
    // Preț pe mp
    document.getElementById('teren-pret').textContent = teren.pret_pe_mp ? `${teren.pret_pe_mp} €/mp` : 'N/A';
    
    // Număr apartamente - cu link "cere o analiză" dacă N/A
    const apartamenteEl = document.getElementById('teren-apartamente');
    const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max 
        ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}` 
        : null;
    if (apartamenteRange) {
        apartamenteEl.textContent = apartamenteRange;
    } else {
        apartamenteEl.innerHTML = '<a href="#" id="apartamente-cere-analiza" class="text-blue-600 hover:underline">Cere o analiză</a>';
        const apartLink = document.getElementById('apartamente-cere-analiza');
        if (apartLink) {
            apartLink.addEventListener('click', (e) => {
                e.preventDefault();
                openAnalysisModal(teren);
            });
        }
    }
    
    document.getElementById('teren-data-adaugat').textContent = formatDate(teren.data_adaugat);
    
    // Sursă
    const sursaRow = document.getElementById('teren-sursa-row');
    const sursaEl = document.getElementById('teren-sursa');
    if (teren.link_sursa && sursaRow && sursaEl) {
        sursaEl.href = teren.link_sursa;
        sursaRow.classList.remove('hidden');
    }
    
    // Adăugat de (posted_by / user_id)
    const adaugatDeRow = document.getElementById('teren-adaugat-de-row');
    const adaugatDeEl = document.getElementById('teren-adaugat-de');
    const postedByUserId = teren.created_by_user_id || teren.posted_by || teren.user_id;
    if (postedByUserId && adaugatDeRow && adaugatDeEl) {
        try {
            const { data: posterProfile } = await supabase
                .from('profiles')
                .select('pseudonym, agency_name, account_type, user_id')
                .eq('user_id', postedByUserId)
                .single();
            
            if (posterProfile) {
                const posterName = posterProfile.account_type === 'profesional' 
                    ? (posterProfile.agency_name || 'Agenție') 
                    : (posterProfile.pseudonym || 'Utilizator');
                adaugatDeEl.textContent = posterName;
                // Agency accounts cannot view user profiles
                if (userProfile && userProfile.account_type === 'profesional') {
                    adaugatDeEl.removeAttribute('href');
                    adaugatDeEl.style.pointerEvents = 'none';
                    adaugatDeEl.style.color = '#64748b';
                } else {
                    adaugatDeEl.href = `profile-view-new.html?id=${posterProfile.user_id}`;
                }
                adaugatDeRow.classList.remove('hidden');
            }
        } catch (e) {
            console.warn('Could not load poster profile:', e);
        }
    }
    
    // User action buttons (show if logged in)
    const userActionBtns = document.getElementById('user-action-buttons');
    if (userProfile && userActionBtns) {
        userActionBtns.classList.remove('hidden');
        
        // Like to profile
        const btnLikeProfil = document.getElementById('btn-like-profil');
        if (btnLikeProfil) {
            // Hide button for agency accounts (they have posted terrains on profile, not favorites)
            if (userProfile.account_type === 'profesional') {
                btnLikeProfil.style.display = 'none';
            } else {
                btnLikeProfil.addEventListener('click', () => toggleTerenLike(teren.id));
                // Check initial like state
                checkTerenLikeState(teren.id);
            }
        }
        
        // Like to group - toggle group likes section visibility
        const btnLikeGrup = document.getElementById('btn-like-grup');
        if (btnLikeGrup) {
            btnLikeGrup.addEventListener('click', () => {
                const groupSection = document.getElementById('group-likes-section');
                if (groupSection) {
                    groupSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        
        // Share button
        const btnShare = document.getElementById('btn-share');
        if (btnShare) {
            btnShare.addEventListener('click', () => {
                const url = window.location.href;
                if (navigator.share) {
                    navigator.share({ title: teren.titlu, url: url });
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(url);
                    showToast('Link copiat în clipboard!', 'success');
                }
            });
        }
    }
    
    // Cere o analiză button
    const btnCereAnaliza = document.getElementById('btn-cere-analiza');
    if (btnCereAnaliza) {
        btnCereAnaliza.addEventListener('click', () => openAnalysisModal(teren));
    }
    
    // Action buttons
    const actionButtons = document.getElementById('action-buttons');
    const hasPendingAnalysis = teren.analiza_generala_status === 'pending' || teren.analiza_specifica_status === 'pending';
    const ownerId = teren.created_by_user_id || teren.posted_by || teren.user_id;
    const canModify = userProfile && (
        (userProfile.user_id === ownerId && !teren.deleted_at) || 
        userProfile.is_super_admin
    );
    const canToggleStatus = userProfile && userProfile.is_super_admin;
    const canApprove = userProfile && userProfile.is_super_admin && teren.status === 'pending';
    
    if (hasPendingAnalysis || canModify || canToggleStatus || canApprove) {
        actionButtons.classList.remove('hidden');
        updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, canApprove, teren);
    } else {
        actionButtons.classList.add('hidden');
    }
    
    // Image handling
    const imageContainer = document.getElementById('teren-image-container');
    const noImageDiv = document.getElementById('no-image');
    const imageEl = document.getElementById('teren-image');
    
    const imageUrl = getImageUrl(teren);
    
    if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = `Imagine teren - ${teren.titlu}`;
        
        if (isDisabled) {
            imageEl.classList.add('opacity-50');
        } else {
            imageEl.classList.remove('opacity-50');
        }
        
        imageContainer.classList.remove('hidden');
        noImageDiv.classList.add('hidden');
    } else {
        imageContainer.classList.add('hidden');
        noImageDiv.classList.remove('hidden');
    }
    
    // Show teren details section
    document.getElementById('teren-details').classList.remove('hidden');
}

// Update action buttons
function updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, canApprove, teren) {
    const actionButtons = document.getElementById('action-buttons');
    actionButtons.innerHTML = '';
    
    // Add "Aprobă" / "Respinge" buttons if terrain is pending and user is super admin.
    // Shown prominently because the typical entry point is the admin notification email.
    if (canApprove) {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        approveBtn.innerHTML = '<i class="fas fa-check mr-1"></i> Aprobă';
        approveBtn.onclick = () => setTerenApprovalStatus(teren.id, 'approved');
        actionButtons.appendChild(approveBtn);
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        rejectBtn.innerHTML = '<i class="fas fa-times mr-1"></i> Respinge';
        rejectBtn.onclick = () => setTerenApprovalStatus(teren.id, 'rejected');
        actionButtons.appendChild(rejectBtn);
    }
    
    // Add "Modifica" button if user can modify
    if (canModify) {
        const modificaBtn = document.createElement('button');
        modificaBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        modificaBtn.textContent = 'Modifică';
        modificaBtn.onclick = () => editTeren(teren.id);
        actionButtons.appendChild(modificaBtn);
    }
    
    // Add "Dezactivează/Activează" button if user is super admin
    if (canToggleStatus) {
        const toggleBtn = document.createElement('button');
        const isDeleted = teren.deleted_at !== null;
        toggleBtn.className = isDeleted 
            ? 'bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors'
            : 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        toggleBtn.textContent = isDeleted ? 'Activează' : 'Dezactivează';
        toggleBtn.onclick = () => toggleTerenStatus(teren.id, isDeleted);
        actionButtons.appendChild(toggleBtn);
    }
}

// Approve or reject a pending terrain (super admin only).
async function setTerenApprovalStatus(terenId, newStatus) {
    const actionLabel = newStatus === 'approved' ? 'aprobi' : 'respingi';
    if (!confirm(`Sigur vrei să ${actionLabel} acest teren?`)) return;
    
    try {
        const userProfile = await fetchUserProfile();
        if (!userProfile?.is_super_admin) {
            throw new Error('Nu aveți permisiuni de administrator pentru această operație');
        }
        
        const { error } = await supabase
            .from('terenuri')
            .update({ status: newStatus })
            .eq('id', terenId);
        
        if (error) throw error;
        
        const message = newStatus === 'approved' 
            ? 'Terenul a fost aprobat cu succes!' 
            : 'Terenul a fost respins.';
        alert(message);
        window.location.reload();
    } catch (error) {
        console.error('Error updating teren approval status:', error);
        alert('A apărut o eroare la actualizarea statusului terenului: ' + error.message);
    }
}

// Edit teren function
function editTeren(terenId) {
    window.location.href = `/terenuri-propune.html?edit=${terenId}`;
}

// Toggle teren status (activate/deactivate)
async function toggleTerenStatus(terenId, isCurrentlyDeleted) {
    try {
        const userProfile = await fetchUserProfile();
        
        if (!userProfile?.is_super_admin) {
            throw new Error('Nu aveți permisiuni de administrator pentru această operație');
        }
        
        const newStatus = isCurrentlyDeleted ? null : new Date().toISOString();
        
        const { data, error } = await supabase
            .from('terenuri')
            .update({ deleted_at: newStatus })
            .eq('id', terenId)
            .select();
        
        if (error) {
            throw error;
        }
        
        const message = isCurrentlyDeleted ? 'Terenul a fost activat cu succes!' : 'Terenul a fost dezactivat cu succes!';
        alert(message);
        window.location.reload();
        
    } catch (error) {
        console.error('Error toggling teren status:', error);
        alert('A apărut o eroare la modificarea statusului terenului: ' + error.message);
    }
}

// Show/hide loading state
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('teren-details').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message = "A apărut o eroare la încărcarea detaliilor terenului.") {
    hideLoading();
    document.getElementById("error").classList.remove("hidden");
    document.getElementById("not-found").classList.add("hidden");
    document.getElementById("teren-details").classList.add("hidden");
    document.getElementById("error-message").textContent = message;
}

function showNotFound() {
    hideLoading();
    document.getElementById("not-found").classList.remove("hidden");
    document.getElementById("error").classList.add("hidden");
    document.getElementById("teren-details").classList.add("hidden");
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    const retryBtn = document.getElementById("retry-btn");
    if (retryBtn) {
        retryBtn.addEventListener("click", fetchTerenDetails);
    }
    
    const sendEmailBtn = document.getElementById("send-email-btn");
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener("click", function() {
            const terenId = getTerenIdFromUrl();
            if (terenId) {
                const teren = {
                    titlu: document.getElementById('teren-title')?.textContent || 'Teren fără titlu',
                    suprafata: document.getElementById('teren-suprafata')?.textContent?.replace(' mp', '') || 'N/A',
                    zona: document.getElementById('teren-zona')?.textContent || 'N/A',
                    pret_pe_mp: document.getElementById('teren-pret')?.textContent?.replace(' €/mp', '') || 'N/A'
                };
                sendAnalysisEmail(teren);
            }
        });
    }

    // Wait for Supabase to be initialized
    if (typeof supabase !== 'undefined') {
        fetchTerenDetails();
    } else {
        setTimeout(fetchTerenDetails, 100);
    }
});

// Analysis Modal Functions
function openAnalysisModal(teren) {
    const terenUrl = window.location.href;
    const emailSubject = `Solicitare analiză teren - ${teren.titlu || 'Teren fără titlu'}`;
    
    const emailContent = `Bună ziua,

Solicit o analiză pentru următorul teren:

Titlu: ${teren.titlu || 'N/A'}
URL: ${terenUrl}
Suprafață: ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}
Zonă: ${teren.zona || 'N/A'}
Preț pe mp: ${teren.pret_pe_mp ? teren.pret_pe_mp + ' EUR/mp' : 'N/A'}

Tipul de analiză solicitat: [Vă rog să specificați: Analiză Generală (100 EUR) sau Analiză Specifică (500 EUR)]

Vă rog să îmi trimiteți detaliile pentru plata corespunzătoare.

Mulțumesc,
[Numele dumneavoastră]`;

    document.getElementById('email-subject').textContent = emailSubject;
    document.getElementById('email-content').textContent = emailContent;
    
    document.getElementById('analysis-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeAnalysisModal() {
    document.getElementById('analysis-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function sendAnalysisEmail(teren) {
    const terenUrl = window.location.href;
    const emailSubject = `Solicitare analiză teren - ${teren.titlu || 'Teren fără titlu'}`;
    
    const emailContent = `Bună ziua,

Solicit o analiză pentru următorul teren:

Titlu: ${teren.titlu || 'N/A'}
URL: ${terenUrl}
Suprafață: ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}
Zonă: ${teren.zona || 'N/A'}
Preț pe mp: ${teren.pret_pe_mp ? teren.pret_pe_mp + ' EUR/mp' : 'N/A'}

Tipul de analiză solicitat: [Vă rog să specificați: Analiză Generală (100 EUR) sau Analiză Specifică (500 EUR)]

Vă rog să îmi trimiteți detaliile pentru plata corespunzătoare.

Mulțumesc,
[Numele dumneavoastră]`;

    const mailtoLink = `mailto:office@ltfbstudio.ro?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailContent)}`;
    
    window.location.href = mailtoLink;
    closeAnalysisModal();
}

// Close modals with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
        closeAnalysisModal();
    }
});

// =====================================================
// INTEREST COUNTS & NAVIGATION
// =====================================================

async function loadInterestCounts(terenId, teren) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Only show for logged-in users
        
        // Check account type
        const { data: profile } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('user_id', user.id)
            .single();
        
        if (profile && profile.account_type === 'profesional') return; // Hide for agencies
        
        // Identify the terrain owner. Agency accounts get an auto-like on their
        // own listing (so the terrain shows up in their profile), but that
        // self-like should not count as "interes" from another user. Exclude
        // the owner from both the count and the list shown to the user.
        const ownerId = teren && (teren.created_by_user_id || teren.posted_by || teren.user_id);
        
        // Fetch user likes count, excluding the owner
        let userLikesQuery = supabase
            .from('terenuri_likes')
            .select('id', { count: 'exact', head: true })
            .eq('teren_id', terenId);
        if (ownerId) userLikesQuery = userLikesQuery.neq('user_id', ownerId);
        const { count: userLikesCount } = await userLikesQuery;
        
        // Fetch group likes count
        const { count: groupLikesCount } = await supabase
            .from('terenuri_likes_grupuri')
            .select('id', { count: 'exact', head: true })
            .eq('teren_id', terenId);
        
        // Update UI
        const container = document.getElementById('interest-buttons');
        const usersCountEl = document.getElementById('interested-users-count');
        const groupsCountEl = document.getElementById('interested-groups-count');
        
        if (container) {
            container.style.display = 'block';
            container.classList.remove('hidden');
        }
        if (usersCountEl) usersCountEl.textContent = userLikesCount || 0;
        if (groupsCountEl) groupsCountEl.textContent = groupLikesCount || 0;
        
    } catch (e) {
        console.warn('Could not load interest counts:', e);
    }
}

window.viewInterestedUsersFromDetail = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const terenId = urlParams.get('id');
    if (terenId) {
        window.location.href = `utilizatori.html?teren=${terenId}`;
    }
};

window.viewInterestedGroupsFromDetail = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const terenId = urlParams.get('id');
    if (terenId) {
        window.location.href = `grupuri.html?teren=${terenId}`;
    }
};
