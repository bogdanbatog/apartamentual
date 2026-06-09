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

// Global state for image gallery
let terenImages = [];      // array de URL-uri (din image_urls sau fallback image_url)
let currentImageIndex = 0; // imaginea afișată curent (în main + modal)

// Extract teren ID from URL query parameter
function getTerenIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Get all image URLs from teren.
// Prefer image_urls (array, multi-photo). Fall back to image_url (legacy single
// photo) pentru terenurile vechi salvate înainte de multi-upload.
function getImageUrls(teren) {
    if (teren.image_urls && Array.isArray(teren.image_urls) && teren.image_urls.length > 0) {
        return teren.image_urls.filter(Boolean);
    }
    if (teren.image_url) {
        return [teren.image_url];
    }
    return [];
}

// Setează imaginea principală afișată + evidențiază miniatura activă.
function setMainImage(index) {
    if (index < 0 || index >= terenImages.length) return;
    currentImageIndex = index;
    const imageEl = document.getElementById('teren-image');
    if (imageEl) imageEl.src = terenImages[index];
    document.querySelectorAll('#teren-thumbnails .teren-thumb').forEach((el, i) => {
        if (i === index) {
            el.classList.add('ring-2', 'ring-orange-500');
        } else {
            el.classList.remove('ring-2', 'ring-orange-500');
        }
    });
}

// Construiește miniaturile sub imaginea principală. Apar doar dacă sunt >1 imagini.
function renderThumbnails() {
    const thumbsContainer = document.getElementById('teren-thumbnails');
    if (!thumbsContainer) return;

    if (terenImages.length <= 1) {
        thumbsContainer.classList.add('hidden');
        thumbsContainer.innerHTML = '';
        return;
    }

    thumbsContainer.classList.remove('hidden');
    thumbsContainer.innerHTML = terenImages.map((url, i) => `
        <img src="${url}" alt="Miniatură ${i + 1}"
             class="teren-thumb w-full h-20 object-cover rounded-md border border-gray-200 cursor-pointer hover:opacity-80 transition"
             data-index="${i}">
    `).join('');

    thumbsContainer.querySelectorAll('.teren-thumb').forEach(el => {
        el.addEventListener('click', function() {
            setMainImage(parseInt(this.getAttribute('data-index'), 10));
        });
    });
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
    if (terenImages.length === 0) return;
    showModalImage(currentImageIndex);
    document.getElementById('image-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Afișează în modal imaginea de la index + actualizează contor / săgeți și sincronizează main + miniaturi.
function showModalImage(index) {
    if (index < 0 || index >= terenImages.length) return;
    const modalImg = document.getElementById('modal-image');
    if (modalImg) modalImg.src = terenImages[index];

    const hasMultiple = terenImages.length > 1;
    const counter = document.getElementById('modal-counter');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    if (counter) {
        counter.textContent = `${index + 1} / ${terenImages.length}`;
        counter.classList.toggle('hidden', !hasMultiple);
    }
    if (prevBtn) prevBtn.classList.toggle('hidden', !hasMultiple);
    if (nextBtn) nextBtn.classList.toggle('hidden', !hasMultiple);

    // Ține main image + miniatura activă sincronizate cu modalul.
    setMainImage(index);
}

// Navighează în modal: direction = -1 (înapoi) / +1 (înainte), cu wrap circular.
function navigateModal(direction) {
    if (terenImages.length === 0) return;
    let newIndex = currentImageIndex + direction;
    if (newIndex < 0) newIndex = terenImages.length - 1;
    if (newIndex >= terenImages.length) newIndex = 0;
    showModalImage(newIndex);
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

    try {
        showLoading();

        // Așteaptă restaurarea sesiunii din localStorage ÎNAINTE de query.
        // Fără asta, pagina poate interoga ca utilizator anonim (race condition la
        // încărcare), iar terenurile cu status 'pending' (abia propuse) sunt vizibile
        // doar utilizatorilor autentificați (RLS). Anonim → 0 rânduri → .single() arunca
        // „cannot coerce the result to a single JSON object".
        const { data: { session } } = await supabase.auth.getSession();

        // Fetch teren details, user profile, user groups, and teren group likes in parallel
        const [terenResult, userProfile, groups, groupLikes] = await Promise.all([
            supabase
                .from('terenuri')
                .select('*')
                .eq('id', terenId)
                .maybeSingle(),  // maybeSingle: întoarce null pe 0 rânduri, nu aruncă eroare
            fetchUserProfile(),
            fetchUserGroups(),
            fetchTerenGroupLikes(terenId)
        ]);

        const { data: terenData, error: terenError } = terenResult;

        if (terenError) {
            throw terenError;
        }

        if (!terenData) {
            // 0 rânduri: fie terenul nu există, fie e 'pending' și nu ești autentificat
            // (terenurile în așteptarea aprobării nu sunt vizibile public).
            if (!session) {
                showError('Acest teren nu este vizibil public (posibil în așteptarea aprobării). Autentifică-te pentru a-l vizualiza.');
            } else {
                showNotFound();
            }
            return;
        }

        // Store groups and likes in global state
        userGroups = groups;
        terenGroupLikes = groupLikes;

        await displayTerenDetails(terenData, userProfile);
        renderGroupLikesSection();
        loadInterestCounts(terenId);
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
                redirectToAnalize(teren);
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
    
    // Cere o analiză button — redirect to /analize.html with teren context
    const btnCereAnaliza = document.getElementById('btn-cere-analiza');
    if (btnCereAnaliza) {
        btnCereAnaliza.addEventListener('click', () => redirectToAnalize(teren));
    }
    
    // Action buttons
    const actionButtons = document.getElementById('action-buttons');
    const hasPendingAnalysis = teren.analiza_generala_status === 'pending' || teren.analiza_specifica_status === 'pending';
    const canModify = userProfile && (
        (userProfile.user_id === teren.user_id && !teren.deleted_at) || 
        userProfile.is_super_admin
    );
    const canToggleStatus = userProfile && userProfile.is_super_admin;
    
    if (hasPendingAnalysis || canModify || canToggleStatus) {
        actionButtons.classList.remove('hidden');
        updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, teren);
    } else {
        actionButtons.classList.add('hidden');
    }
    
    // Image handling — galerie cu miniaturi (multi-photo)
    const imageContainer = document.getElementById('teren-image-container');
    const noImageDiv = document.getElementById('no-image');
    const imageEl = document.getElementById('teren-image');
    const thumbsContainer = document.getElementById('teren-thumbnails');

    terenImages = getImageUrls(teren);
    currentImageIndex = 0;

    if (terenImages.length > 0) {
        imageEl.alt = `Imagine teren - ${teren.titlu}`;

        if (isDisabled) {
            imageEl.classList.add('opacity-50');
        } else {
            imageEl.classList.remove('opacity-50');
        }

        imageContainer.classList.remove('hidden');
        noImageDiv.classList.add('hidden');

        renderThumbnails();
        setMainImage(0); // setează imaginea principală + evidențiază prima miniatură
    } else {
        imageContainer.classList.add('hidden');
        noImageDiv.classList.remove('hidden');
        if (thumbsContainer) thumbsContainer.classList.add('hidden');
    }
    
    // Show teren details section
    document.getElementById('teren-details').classList.remove('hidden');
}

// Update action buttons
function updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, teren) {
    const actionButtons = document.getElementById('action-buttons');
    actionButtons.innerHTML = '';
    
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

    // Wait for Supabase to be initialized
    if (typeof supabase !== 'undefined') {
        fetchTerenDetails();
    } else {
        setTimeout(fetchTerenDetails, 100);
    }
});

// Redirect to /analize.html, passing the current teren ID and slug as context
// so the analysis order form can pre-fill the terrain reference.
function redirectToAnalize(teren) {
    const params = new URLSearchParams();
    if (teren && teren.id) {
        params.set('teren_id', teren.id);
    }
    if (teren && teren.titlu) {
        params.set('teren_titlu', teren.titlu);
    }
    const qs = params.toString();
    window.location.href = qs ? `analize.html?${qs}` : 'analize.html';
}

// Close modals with Escape key + navighează cu săgețile când modalul e deschis
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('image-modal');
    const modalOpen = modal && !modal.classList.contains('hidden');
    if (e.key === 'Escape') {
        closeImageModal();
    } else if (modalOpen && e.key === 'ArrowLeft') {
        navigateModal(-1);
    } else if (modalOpen && e.key === 'ArrowRight') {
        navigateModal(1);
    }
});

// =====================================================
// INTEREST COUNTS & NAVIGATION
// =====================================================

async function loadInterestCounts(terenId) {
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
        
        // Fetch user likes count
        const { count: userLikesCount } = await supabase
            .from('terenuri_likes')
            .select('id', { count: 'exact', head: true })
            .eq('teren_id', terenId);
        
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
