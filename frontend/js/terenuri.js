/* ═══════════════════════════════════════════
   TERENURI V2 — ApartamenTUal
   Logica: Fetch, Filtre, Sortare, Likes,
           Add to Profile, Add to Group
   ═══════════════════════════════════════════ */

// ── SUPABASE CLIENT ──
// Uses global `sb` and `supabase` from supabase-config.js

// ── DOM REFERENCES ────────────────────────
const DOM = {
    filterOras:       document.getElementById('filterOras'),
    filterCartier:    document.getElementById('filterCartier'),
    filterSort:       document.getElementById('filterSort'),
    btnResetFilters:  document.getElementById('btnResetFilters'),
    activeFilters:    document.getElementById('activeFilters'),
    activeFiltersTags:document.getElementById('activeFiltersTags'),
    resultsCount:     document.getElementById('resultsCount'),
    loadingState:     document.getElementById('loadingState'),
    emptyState:       document.getElementById('emptyState'),
    terenuriGrid:     document.getElementById('terenuriGrid'),
    // Modal
    modalAddToGroup:  document.getElementById('modalAddToGroup'),
    modalCloseGroup:  document.getElementById('modalCloseGroup'),
    groupListContainer: document.getElementById('groupListContainer'),
    groupNotAvailable:  document.getElementById('groupNotAvailable'),
    groupList:        document.getElementById('groupList'),
    // Nav
    navUser:          document.getElementById('navUser'),
    btnLoginNav:      document.getElementById('btnLoginNav'),
    btnUserAvatar:    document.getElementById('btnUserAvatar'),
    userDropdown:     document.getElementById('userDropdown'),
    btnLogout:        document.getElementById('btnLogout'),
    navMobileToggle:  document.getElementById('navMobileToggle'),
    // Toast
    toastContainer:   document.getElementById('toastContainer'),
};

// ── STATE ─────────────────────────────────
let currentUser = null;
let allTerenuri = [];
let userLikes = new Set();        // set of teren IDs the user liked
let likesCountMap = {};           // { teren_id: count }
let currentTerenForGroup = null;  // teren ID when opening "add to group" modal

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initNav();
    populateOrasFilter();
    bindFilterEvents();
    bindModalEvents();
    await checkAuth();
    await loadTerenuri();
});

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
let userAccountType = null; // 'activ' or 'profesional'

async function checkAuth() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            currentUser = user;
            DOM.navUser.style.display = 'block';
            DOM.btnLoginNav.style.display = 'none';
            
            // Get user profile to check account type
            const { data: profile } = await sb
                .from('profiles')
                .select('account_type')
                .eq('user_id', user.id)
                .single();
            
            userAccountType = profile?.account_type || 'activ';
            
            // Load user's likes only for active users
            if (userAccountType === 'activ') {
                await loadUserLikes(user.id);
            }
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
    }
}

async function loadUserLikes(userId) {
    try {
        const { data, error } = await sb
            .from('terenuri_likes')
            .select('teren_id')
            .eq('user_id', userId);

        if (!error && data) {
            userLikes = new Set(data.map(d => d.teren_id));
        }
    } catch (e) {
        console.warn('Could not load user likes:', e);
    }
}

// ══════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════
function initNav() {
    // User dropdown toggle
    if (DOM.btnUserAvatar) {
        DOM.btnUserAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.userDropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            DOM.userDropdown.classList.remove('show');
        });
    }

    // Logout
    if (DOM.btnLogout) {
        DOM.btnLogout.addEventListener('click', async () => {
            await sb.auth.signOut();
            window.location.reload();
        });
    }

    // Mobile toggle (simplified - you can expand)
    if (DOM.navMobileToggle) {
        DOM.navMobileToggle.addEventListener('click', () => {
            // Simple: redirect to homepage or toggle a mobile menu
            // For now, just a placeholder
            document.querySelector('.nav-links').classList.toggle('show-mobile');
        });
    }
}

// ══════════════════════════════════════════
//  FILTERS — Orașe & Cartiere
// ══════════════════════════════════════════

function populateOrasFilter() {
    // Uses orase-cartiere.js (already loaded)
    // Expected global: ORASE_CARTIERE = { "București": [...], "Cluj-Napoca": [...], ... }
    if (typeof ORASE_CARTIERE === 'undefined') {
        console.warn('ORASE_CARTIERE not found. Make sure orase-cartiere.js is loaded.');
        return;
    }

    const orase = Object.keys(ORASE_CARTIERE);
    orase.forEach(oras => {
        const opt = document.createElement('option');
        opt.value = oras;
        opt.textContent = oras;
        DOM.filterOras.appendChild(opt);
    });
}

function populateCartierFilter(oras) {
    // Clear existing
    DOM.filterCartier.innerHTML = '';

    if (!oras) {
        DOM.filterCartier.innerHTML = '<option value="">Alege mai întâi orașul</option>';
        DOM.filterCartier.disabled = true;
        return;
    }

    DOM.filterCartier.disabled = false;
    DOM.filterCartier.innerHTML = '<option value="">Toate cartierele</option>';

    const cartiere = ORASE_CARTIERE[oras] || [];
    cartiere.forEach(c => {
        const opt = document.createElement('option');
        // Handle both formats: string or { id, name }
        if (typeof c === 'string') {
            opt.value = c;
            opt.textContent = c;
        } else {
            opt.value = c.name || c.id;
            opt.textContent = c.name || c.id;
        }
        DOM.filterCartier.appendChild(opt);
    });
}

function bindFilterEvents() {
    DOM.filterOras.addEventListener('change', () => {
        populateCartierFilter(DOM.filterOras.value);
        applyFilters();
    });

    DOM.filterCartier.addEventListener('change', () => {
        applyFilters();
    });

    DOM.filterSort.addEventListener('change', () => {
        applyFilters();
    });

    DOM.btnResetFilters.addEventListener('click', () => {
        DOM.filterOras.value = '';
        DOM.filterCartier.innerHTML = '<option value="">Alege mai întâi orașul</option>';
        DOM.filterCartier.disabled = true;
        DOM.filterSort.value = 'newest';
        applyFilters();
    });
}

function updateActiveFilters() {
    const oras = DOM.filterOras.value;
    const cartier = DOM.filterCartier.value;
    const tags = [];

    if (oras) tags.push({ type: 'oras', label: oras });
    if (cartier) tags.push({ type: 'cartier', label: cartier });

    if (tags.length === 0) {
        DOM.activeFilters.style.display = 'none';
        return;
    }

    DOM.activeFilters.style.display = 'flex';
    DOM.activeFiltersTags.innerHTML = tags.map(t => `
        <span class="filter-tag">
            ${t.label}
            <button onclick="removeFilter('${t.type}')" title="Elimină filtrul">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');
}

// Global function for onclick in filter tags
window.removeFilter = function(type) {
    if (type === 'oras') {
        DOM.filterOras.value = '';
        DOM.filterCartier.innerHTML = '<option value="">Alege mai întâi orașul</option>';
        DOM.filterCartier.disabled = true;
    } else if (type === 'cartier') {
        DOM.filterCartier.value = '';
    }
    applyFilters();
};

// ══════════════════════════════════════════
//  LOAD & RENDER TERENURI
// ══════════════════════════════════════════

async function loadTerenuri() {
    showLoading(true);

    try {
        // Fetch all approved terenuri
        const { data, error } = await sb
            .from('terenuri')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allTerenuri = data || [];

        // Load likes count for all terenuri
        await loadLikesCounts();

        // Apply filters and render
        applyFilters();

    } catch (e) {
        console.error('Error loading terenuri:', e);
        showLoading(false);
        showToast('Eroare la încărcarea terenurilor. Reîncearcă.', 'error');
    }
}

async function loadLikesCounts() {
    try {
        // Build a map of teren_id → owner user_id, so we can exclude self-likes.
        // Agencies get an auto-like on their own listing (to show it in their
        // profile), but that self-like should not count as an external interest.
        const ownerByTeren = {};
        for (const t of allTerenuri) {
            const ownerId = t.created_by_user_id || t.posted_by || t.user_id;
            if (ownerId) ownerByTeren[t.id] = ownerId;
        }
        
        // Get counts grouped by teren_id
        const { data, error } = await sb
            .from('terenuri_likes')
            .select('teren_id, user_id');

        if (!error && data) {
            likesCountMap = {};
            data.forEach(row => {
                if (ownerByTeren[row.teren_id] && ownerByTeren[row.teren_id] === row.user_id) return;
                likesCountMap[row.teren_id] = (likesCountMap[row.teren_id] || 0) + 1;
            });
        }
    } catch (e) {
        console.warn('Could not load likes counts:', e);
    }
}

function applyFilters() {
    const oras = DOM.filterOras.value;
    const cartier = DOM.filterCartier.value;
    const sortBy = DOM.filterSort.value;

    // Filter
    let filtered = allTerenuri.filter(t => {
        if (oras && t.oras !== oras) return false;
        if (cartier && t.cartier !== cartier) return false;
        return true;
    });

    // Sort
    filtered = sortTerenuri(filtered, sortBy);

    // Update UI
    updateActiveFilters();
    renderTerenuri(filtered);
}

function sortTerenuri(list, sortBy) {
    const sorted = [...list];

    switch (sortBy) {
        case 'likes_desc':
            sorted.sort((a, b) => (getLikesCount(b.id) - getLikesCount(a.id)));
            break;
        case 'newest':
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'price_asc':
            sorted.sort((a, b) => (a.pret_total || 0) - (b.pret_total || 0));
            break;
        case 'price_desc':
            sorted.sort((a, b) => (b.pret_total || 0) - (a.pret_total || 0));
            break;
        case 'surface_desc':
            sorted.sort((a, b) => (b.suprafata || 0) - (a.suprafata || 0));
            break;
    }

    return sorted;
}

function getLikesCount(terenId) {
    return likesCountMap[terenId] || 0;
}

function renderTerenuri(terenuri) {
    showLoading(false);

    if (terenuri.length === 0) {
        DOM.terenuriGrid.innerHTML = '';
        DOM.emptyState.style.display = 'block';
        DOM.resultsCount.textContent = '0 terenuri găsite';
        return;
    }

    DOM.emptyState.style.display = 'none';
    DOM.resultsCount.textContent = `${terenuri.length} ${terenuri.length === 1 ? 'teren găsit' : 'terenuri găsite'}`;

    DOM.terenuriGrid.innerHTML = terenuri.map((t, index) => createTerenCard(t, index)).join('');

    // Bind card interactions
    bindCardInteractions();
}

function createTerenCard(teren, index) {
    const likes = getLikesCount(teren.id);
    const isLiked = userLikes.has(teren.id);
    const pretMp = (teren.pret_total && teren.suprafata)
        ? Math.round(teren.pret_total / teren.suprafata)
        : null;

    // Check if teren is "new" (less than 7 days)
    const isNew = teren.created_at && (Date.now() - new Date(teren.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

    // Format date
    const dateStr = teren.created_at
        ? new Date(teren.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    // Image — prefer image_urls[0] (new), fall back to image_url (legacy)
    const primaryImage = (teren.image_urls && Array.isArray(teren.image_urls) && teren.image_urls.length > 0)
        ? teren.image_urls[0]
        : teren.image_url;
    const imageHtml = primaryImage
        ? `<img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(teren.titlu)}" loading="lazy">`
        : `<div class="image-placeholder"><i class="fas fa-mountain-sun"></i></div>`;

    // Location string
    const location = [teren.oras, teren.cartier].filter(Boolean).join(', ');

    // Source link
    const sourceHtml = teren.link_sursa
        ? `<a href="${escapeHtml(teren.link_sursa)}" target="_blank" rel="noopener" class="teren-card-source">
             <i class="fas fa-external-link-alt"></i> Sursă
           </a>`
        : '';

    // Groups associated (placeholder - will be functional with Grupuri phase)
    // For now we show nothing or mock data
    const groupsHtml = ''; // Will be populated when grupuri table exists

    return `
    <article class="teren-card" data-teren-id="${teren.id}" style="animation-delay: ${Math.min(index * 0.05, 0.3)}s">
        <!-- Image -->
        <div class="teren-card-image">
            ${imageHtml}
            <div class="teren-badge-row">
                <span class="teren-badge teren-badge-city">${escapeHtml(teren.oras || 'România')}</span>
                ${isNew ? '<span class="teren-badge teren-badge-new">Nou</span>' : ''}
            </div>
        </div>

        <!-- Body -->
        <div class="teren-card-body">
            <h3 class="teren-card-title">${escapeHtml(teren.titlu || 'Teren fără titlu')}</h3>
            <div class="teren-card-location">
                <i class="fas fa-map-marker-alt"></i>
                ${escapeHtml(location || 'Locație nespecificată')}
            </div>

            <!-- Stats -->
            <div class="teren-card-stats">
                <div class="teren-stat">
                    <span class="teren-stat-label">Suprafață</span>
                    <span class="teren-stat-value">${teren.suprafata ? formatNumber(teren.suprafata) + ' mp' : '—'}</span>
                </div>
                <div class="teren-stat">
                    <span class="teren-stat-label">Preț total</span>
                    <span class="teren-stat-value price-highlight">${teren.pret_total ? formatPrice(teren.pret_total) + ' €' : '—'}</span>
                </div>
                ${pretMp !== null ? `
                <div class="teren-stat">
                    <span class="teren-stat-label">Preț / mp</span>
                    <span class="teren-stat-value">${formatNumber(pretMp)} €/mp</span>
                </div>` : ''}
                ${dateStr ? `
                <div class="teren-stat">
                    <span class="teren-stat-label">Adăugat</span>
                    <span class="teren-stat-value">${dateStr}</span>
                </div>` : ''}
            </div>

            ${sourceHtml}
        </div>

        <!-- Footer / Actions -->
        <div class="teren-card-footer">
            <div class="teren-likes">
                <button class="teren-likes-btn ${isLiked ? 'liked' : ''}"
                        data-teren-id="${teren.id}"
                        onclick="handleLike('${teren.id}')"
                        title="${isLiked ? 'Elimină din favorite' : 'Adaugă la profil'}">
                    <i class="like-icon ${isLiked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="like-count-text">${likes}</span>
                </button>
                <span class="teren-likes-count">${likes === 1 ? 'interesat' : 'interesați'}</span>
            </div>
            <div class="teren-card-actions">
                <button class="btn-view-interested" onclick="viewInterestedUsers('${teren.id}')" title="Vezi utilizatorii interesați">
                    <i class="fas fa-user"></i>
                </button>
                <button class="btn-view-groups" onclick="viewInterestedGroups('${teren.id}')" title="Vezi grupurile interesate">
                    <i class="fas fa-users"></i>
                </button>
                <a href="teren-details.html?id=${teren.id}" class="btn-vezi-detalii">
                    Detalii <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        </div>
    </article>
    `;
}

function bindCardInteractions() {
    // Additional JS interactions can go here if needed
    // (onclick handlers are inline for simplicity)
}

// ══════════════════════════════════════════
//  LIKE / ADD TO PROFILE
// ══════════════════════════════════════════

window.handleLike = async function(terenId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat pentru a adăuga la favorite.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }
    
    // Block for professional accounts (agencies)
    if (userAccountType === 'profesional') {
        showToast('Conturile de agenție nu pot adăuga terenuri la favorite.', 'info');
        return;
    }

    const isCurrentlyLiked = userLikes.has(terenId);

    // Optimistic UI update
    toggleLikeUI(terenId, !isCurrentlyLiked);

    try {
        if (isCurrentlyLiked) {
            // Remove like
            const { error } = await sb
                .from('terenuri_likes')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('teren_id', terenId);

            if (error) throw error;

            userLikes.delete(terenId);
            likesCountMap[terenId] = Math.max(0, (likesCountMap[terenId] || 1) - 1);
            showToast('Teren eliminat din favorite.', 'success');

        } else {
            // Add like
            const { error } = await sb
                .from('terenuri_likes')
                .insert({ user_id: currentUser.id, teren_id: terenId });

            if (error) throw error;

            userLikes.add(terenId);
            likesCountMap[terenId] = (likesCountMap[terenId] || 0) + 1;
            showToast('Teren adăugat la favorite!', 'success');
        }

        // Update the count display on the specific card
        updateLikeCountDisplay(terenId);

    } catch (e) {
        console.error('Like error:', e);
        // Revert optimistic update
        toggleLikeUI(terenId, isCurrentlyLiked);
        showToast('Eroare. Încearcă din nou.', 'error');
    }
};

function toggleLikeUI(terenId, liked) {
    const btn = document.querySelector(`.teren-likes-btn[data-teren-id="${terenId}"]`);
    if (!btn) return;

    const icon = btn.querySelector('.like-icon');
    if (liked) {
        btn.classList.add('liked');
        icon.classList.remove('far');
        icon.classList.add('fas');
    } else {
        btn.classList.remove('liked');
        icon.classList.remove('fas');
        icon.classList.add('far');
    }
}

function updateLikeCountDisplay(terenId) {
    const btn = document.querySelector(`.teren-likes-btn[data-teren-id="${terenId}"]`);
    if (!btn) return;

    const count = getLikesCount(terenId);
    const countText = btn.querySelector('.like-count-text');
    const label = btn.closest('.teren-likes').querySelector('.teren-likes-count');

    if (countText) countText.textContent = count;
    if (label) label.textContent = count === 1 ? 'interesat' : 'interesați';
}

// ══════════════════════════════════════════
//  VIEW INTERESTED USERS / GROUPS
// ══════════════════════════════════════════

window.viewInterestedUsers = function(terenId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat pentru a vedea utilizatorii.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }
    
    // Block for professional accounts (agencies)
    if (userAccountType === 'profesional') {
        showToast('Conturile de agenție nu pot accesa lista de utilizatori.', 'info');
        return;
    }
    
    // Navigate to utilizatori page with teren filter
    window.location.href = `utilizatori.html?teren=${terenId}`;
};

window.viewInterestedGroups = function(terenId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat pentru a vedea grupurile.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }
    
    // Block for professional accounts (agencies)
    if (userAccountType === 'profesional') {
        showToast('Conturile de agenție nu pot accesa lista de grupuri.', 'info');
        return;
    }
    
    // Navigate to grupuri page with teren filter
    window.location.href = `grupuri.html?teren=${terenId}`;
};

// Keep handleAddToGroup for backwards compatibility (teren-details page uses it)
window.handleAddToGroup = function(terenId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat pentru această acțiune.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }

    currentTerenForGroup = terenId;

    // For now, show "not available yet" since Grupuri isn't built
    // When grupuri exists, we'd load user's groups here
    DOM.groupListContainer.style.display = 'none';
    DOM.groupNotAvailable.style.display = 'block';

    DOM.modalAddToGroup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

function bindModalEvents() {
    DOM.modalCloseGroup.addEventListener('click', closeGroupModal);
    DOM.modalAddToGroup.addEventListener('click', (e) => {
        if (e.target === DOM.modalAddToGroup) closeGroupModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGroupModal();
    });
}

function closeGroupModal() {
    DOM.modalAddToGroup.style.display = 'none';
    document.body.style.overflow = '';
    currentTerenForGroup = null;
}

// ══════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════

function showLoading(show) {
    DOM.loadingState.style.display = show ? 'block' : 'none';
    if (show) {
        DOM.terenuriGrid.innerHTML = '';
        DOM.emptyState.style.display = 'none';
    }
}

function showToast(message, type = 'info') {
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="${iconMap[type]}"></i> ${escapeHtml(message)}`;
    DOM.toastContainer.appendChild(toast);

    // Auto remove after 3.5s
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('ro-RO').format(num);
}

function formatPrice(num) {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(num);
}
