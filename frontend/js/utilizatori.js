/* ═══════════════════════════════════════════════════════════
   UTILIZATORI PAGE - ApartamenTUal
   Logic: Fetch, Filter, Display user profiles
   ═══════════════════════════════════════════════════════════ */

// ── SUPABASE CLIENT ──
// Uses global `sb` from supabase-config.js

// ── STATE ──
let currentUser = null;
let allUsers = [];
let allTags = [];
let filterTerenId = null;
let filterTerenName = null;

// ── DOM ELEMENTS ──
const DOM = {
    authOverlay: document.getElementById('auth-overlay'),
    mainContent: document.getElementById('main-content'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    usersGrid: document.getElementById('users-grid'),
    resultsCount: document.getElementById('results-count'),
    filterOras: document.getElementById('filter-oras'),
    filterZona: document.getElementById('filter-zona'),
    filterInteres: document.getElementById('filter-interes'),
    btnReset: document.getElementById('btn-reset'),
    activeFilters: document.getElementById('active-filters'),
    activeFiltersTags: document.getElementById('active-filters-tags'),
    terenFilterBanner: document.getElementById('teren-filter-banner'),
    terenFilterName: document.getElementById('teren-filter-name'),
    btnClearTerenFilter: document.getElementById('btn-clear-teren-filter'),
    navUser: document.getElementById('nav-user'),
    btnLoginNav: document.getElementById('btn-login-nav')
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    // Check URL params for teren filter
    const urlParams = new URLSearchParams(window.location.search);
    filterTerenId = urlParams.get('teren');
    
    const accountType = await checkAuth();
    
    // Block access for professional accounts (agencies)
    if (currentUser && accountType === 'profesional') {
        DOM.authOverlay.style.display = 'flex';
        DOM.mainContent.style.filter = 'blur(8px)';
        DOM.mainContent.style.pointerEvents = 'none';
        // Update overlay message for agencies
        const overlayContent = DOM.authOverlay.querySelector('.auth-overlay-content');
        if (overlayContent) {
            overlayContent.innerHTML = `
                <div class="auth-icon">
                    <i class="fas fa-building"></i>
                </div>
                <h2>Acces restricționat</h2>
                <p>Conturile de agenție imobiliară nu au acces la lista de utilizatori.</p>
                <div class="auth-buttons">
                    <a href="terenuri.html" class="btn-primary">Înapoi la terenuri</a>
                </div>
            `;
        }
        return;
    }
    
    // Hide auth overlay for both logged and anonymous users
    if (DOM.authOverlay) DOM.authOverlay.style.display = 'none';
    
    populateFilters();
    bindEvents();
    await loadTags();
    
    if (filterTerenId) {
        await loadTerenName(filterTerenId);
    }
    
    await loadUsers();
});

// ── AUTH ──
let myZones = [];
let myTags = [];

async function checkAuth() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            currentUser = user;
            if (DOM.navUser) DOM.navUser.style.display = 'block';
            if (DOM.btnLoginNav) DOM.btnLoginNav.style.display = 'none';
            
            // Get account type
            const { data: profile } = await sb
                .from('profiles')
                .select('account_type')
                .eq('user_id', user.id)
                .single();
            
            // Load current user's zones and tags for matching
            const { data: userZones } = await sb
                .from('user_preferred_zones')
                .select('zone_id, zones(id, name)')
                .eq('user_id', user.id);
            myZones = (userZones || []).map(uz => uz.zones).filter(Boolean);
            
            const { data: userTags } = await sb
                .from('user_tags')
                .select('tag_id, tags(id, name)')
                .eq('user_id', user.id);
            myTags = (userTags || []).map(ut => ut.tags).filter(Boolean);
            
            return profile?.account_type || 'activ';
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
    }
    return null;
}

// ── LOAD DATA ──
async function loadTags() {
    try {
        const { data, error } = await sb
            .from('tags')
            .select('id, name, category')
            .order('name');
        
        if (!error && data) {
            allTags = data;
            populateInteresFilter();
        }
    } catch (e) {
        console.warn('Could not load tags:', e);
    }
}

async function loadTerenName(terenId) {
    try {
        const { data, error } = await sb
            .from('terenuri')
            .select('titlu')
            .eq('id', terenId)
            .single();
        
        if (!error && data) {
            filterTerenName = data.titlu;
            DOM.terenFilterBanner.style.display = 'block';
            DOM.terenFilterName.textContent = filterTerenName;
        }
    } catch (e) {
        console.warn('Could not load teren name:', e);
    }
}

async function loadUsers() {
    showLoading(true);
    
    try {
        let query = sb
            .from('profiles')
            .select(`
                user_id,
                pseudonym,
                profession,
                preferred_city_id,
                preferred_rooms,
                preferred_area_sqm,
                created_at,
                is_demo,
                user_tags(tag_id, tags(id, name)),
                user_preferred_zones(zone_id, zones(id, name))
            `)
            .eq('account_type', 'activ')
            .not('pseudonym', 'is', null)
            .or('account_status.is.null,account_status.eq.active');
        
        // If filtering by teren likes
        if (filterTerenId) {
            const { data: likeUsers } = await sb
                .from('terenuri_likes')
                .select('user_id')
                .eq('teren_id', filterTerenId);
            
            if (likeUsers && likeUsers.length > 0) {
                const userIds = likeUsers.map(l => l.user_id);
                query = query.in('user_id', userIds);
            } else {
                // No likes for this teren
                allUsers = [];
                renderUsers();
                return;
            }
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Process users data
        allUsers = (data || []).map(user => ({
            ...user,
            tags: user.user_tags?.map(ut => ut.tags).filter(Boolean) || [],
            zones: user.user_preferred_zones?.map(uz => uz.zones).filter(Boolean) || []
        }));
        
        // Calculate completeness score and sort by it (most complete first)
        allUsers.forEach(u => {
            let score = 0;
            if (u.pseudonym) score += 1;
            if (u.profesie) score += 2;
            if (u.descriere && u.descriere.length > 20) score += 3;
            if (u.zones && u.zones.length > 0) score += 3;
            if (u.tags && u.tags.length > 0) score += 3;
            if (u.preferred_city) score += 1;
            if (u.preferred_rooms) score += 1;
            if (u.preferred_surface) score += 1;
            u._completeness = score;
        });
        allUsers.sort((a, b) => b._completeness - a._completeness);
        
        // Exclude current user from the list
        if (currentUser) {
            allUsers = allUsers.filter(u => u.user_id !== currentUser.id);
        }
        
        applyFilters();
        
    } catch (e) {
        console.error('Error loading users:', e);
        showLoading(false);
    }
}

// ── FILTERS ──
function populateFilters() {
    // Populate cities
    if (typeof ORASE_CARTIERE !== 'undefined') {
        const orase = Object.keys(ORASE_CARTIERE).sort();
        DOM.filterOras.innerHTML = '<option value="">Toate orașele</option>';
        orase.forEach(oras => {
            DOM.filterOras.innerHTML += `<option value="${oras}">${oras}</option>`;
        });
    }
}

function populateInteresFilter() {
    DOM.filterInteres.innerHTML = '<option value="">Toate interesele</option>';
    allTags.forEach(tag => {
        DOM.filterInteres.innerHTML += `<option value="${tag.id}">${tag.name}</option>`;
    });
}

function populateZoneFilter(oras) {
    DOM.filterZona.innerHTML = '<option value="">Toate zonele</option>';
    
    if (oras && typeof ORASE_CARTIERE !== 'undefined' && ORASE_CARTIERE[oras]) {
        DOM.filterZona.disabled = false;
        ORASE_CARTIERE[oras].forEach(zona => {
            DOM.filterZona.innerHTML += `<option value="${zona}">${zona}</option>`;
        });
    } else {
        DOM.filterZona.disabled = true;
        DOM.filterZona.innerHTML = '<option value="">Alege mai întâi orașul</option>';
    }
}

function applyFilters() {
    const filters = {
        oras: DOM.filterOras.value,
        zona: DOM.filterZona.value,
        interes: DOM.filterInteres.value
    };
    
    let filtered = [...allUsers];
    
    // Filter by city (through zones)
    if (filters.oras) {
        filtered = filtered.filter(user => 
            user.zones.some(z => z.name && z.name.toLowerCase().includes(filters.oras.toLowerCase()))
        );
    }
    
    // Filter by zone
    if (filters.zona) {
        filtered = filtered.filter(user =>
            user.zones.some(z => z.name === filters.zona)
        );
    }
    
    // Filter by interest (tag)
    if (filters.interes) {
        filtered = filtered.filter(user =>
            user.tags.some(t => t.id === filters.interes)
        );
    }
    
    renderUsers(filtered);
    updateActiveFilters(filters);
}

function updateActiveFilters(filters) {
    const tags = [];
    
    if (filters.oras) {
        tags.push({ type: 'oras', label: filters.oras, value: filters.oras });
    }
    if (filters.zona) {
        tags.push({ type: 'zona', label: filters.zona, value: filters.zona });
    }
    if (filters.interes) {
        const tag = allTags.find(t => t.id === filters.interes);
        if (tag) {
            tags.push({ type: 'interes', label: tag.name, value: filters.interes });
        }
    }
    
    if (tags.length > 0) {
        DOM.activeFilters.style.display = 'flex';
        DOM.activeFiltersTags.innerHTML = tags.map(t => `
            <span class="filter-tag">
                ${t.label}
                <button onclick="clearFilter('${t.type}')">&times;</button>
            </span>
        `).join('');
    } else {
        DOM.activeFilters.style.display = 'none';
    }
}

window.clearFilter = function(type) {
    if (type === 'oras') {
        DOM.filterOras.value = '';
        populateZoneFilter('');
    } else if (type === 'zona') {
        DOM.filterZona.value = '';
    } else if (type === 'interes') {
        DOM.filterInteres.value = '';
    }
    applyFilters();
};

function resetFilters() {
    DOM.filterOras.value = '';
    DOM.filterZona.value = '';
    DOM.filterInteres.value = '';
    populateZoneFilter('');
    applyFilters();
}

function clearTerenFilter() {
    filterTerenId = null;
    filterTerenName = null;
    DOM.terenFilterBanner.style.display = 'none';
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.delete('teren');
    window.history.replaceState({}, '', url);
    
    loadUsers();
}

// ── RENDER ──
function showLoading(show) {
    DOM.loadingState.style.display = show ? 'block' : 'none';
    DOM.usersGrid.style.display = show ? 'none' : 'grid';
    DOM.emptyState.style.display = 'none';
}

function renderUsers(users = allUsers) {
    showLoading(false);
    
    if (users.length === 0) {
        DOM.emptyState.style.display = 'block';
        DOM.usersGrid.style.display = 'none';
        DOM.resultsCount.textContent = '0 utilizatori găsiți';
        return;
    }
    
    DOM.emptyState.style.display = 'none';
    DOM.usersGrid.style.display = 'grid';
    DOM.resultsCount.textContent = `${users.length} utilizator${users.length !== 1 ? 'i' : ''} găsit${users.length !== 1 ? 'i' : ''}`;
    
    DOM.usersGrid.innerHTML = users.map(user => renderUserCard(user)).join('');
}

function renderUserCard(user) {
    const name = user.pseudonym || 'Utilizator';
    const initials = name.charAt(0).toUpperCase();
    const profession = user.profession || '';
    const rooms = user.preferred_rooms ? `${user.preferred_rooms} camere` : '';
    const area = user.preferred_area_sqm ? `${user.preferred_area_sqm} mp` : '';
    
    // Demo badge — pentru utilizatori marcaţi ca demo
    const demoBadge = user.is_demo 
        ? '<span style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; color:#92400e; font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle; text-transform:uppercase; letter-spacing:0.5px;"><i class="fas fa-flask" style="font-size:9px;"></i>demo</span>' 
        : '';
    
    // Zones (show max 3)
    const zones = user.zones || [];
    const zonesHtml = zones.length > 0
        ? zones.slice(0, 3).map(z => `<span class="zone-tag">${escapeHtml(z.name)}</span>`).join('') +
          (zones.length > 3 ? `<span class="zone-tag more">+${zones.length - 3}</span>` : '')
        : '<span class="zone-tag" style="color: var(--slate-400);">Nicio zonă</span>';
    
    // Interests/Tags (show max 3)
    const tags = user.tags || [];
    const tagsHtml = tags.length > 0
        ? tags.slice(0, 3).map(t => `<span class="interest-tag">${escapeHtml(t.name)}</span>`).join('') +
          (tags.length > 3 ? `<span class="interest-tag more">+${tags.length - 3}</span>` : '')
        : '<span class="interest-tag" style="background: var(--slate-300);">Niciun interes</span>';
    
    // Anonymous visitor: simplified card without profile link
    if (!currentUser) {
        return `
            <article class="user-card">
                <div class="user-card-header">
                    <div class="user-avatar">${initials}</div>
                    <div class="user-basic-info">
                        <h3 class="user-name">${escapeHtml(name)}${demoBadge}</h3>
                        <div class="user-meta">
                            ${profession ? `<span><i class="fas fa-briefcase"></i> ${escapeHtml(profession)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="user-card-body">
                    <div class="user-section">
                        <div class="user-section-label">Zone preferate</div>
                        <div class="user-zones">${zonesHtml}</div>
                    </div>
                    <div class="user-section">
                        <div class="user-section-label">Interese</div>
                        <div class="user-interests">${tagsHtml}</div>
                    </div>
                </div>
                <div class="user-card-footer">
                    <a href="register.html" class="btn-view-profile">
                        Creează cont pentru detalii <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </article>
        `;
    }
    
    // Logged in: full card with matching and profile link
    // Matching with current user
    let matchingHtml = '';
    if (currentUser && user.user_id !== currentUser.id) {
        const commonZones = zones.filter(z => myZones.some(mz => mz.id === z.id));
        const commonTags = tags.filter(t => myTags.some(mt => mt.id === t.id));
        
        const zoneClass = commonZones.length > 0 ? 'matching-yes' : 'matching-no';
        const tagClass = commonTags.length > 0 ? 'matching-yes' : 'matching-no';
        
        matchingHtml = `
            <div class="user-matching-stack">
                <span class="${zoneClass}"><i class="fas fa-map-marker-alt"></i> ${commonZones.length} zone comune</span>
                <span class="${tagClass}"><i class="fas fa-tags"></i> ${commonTags.length} interese comune</span>
            </div>`;
    }
    
    return `
        <article class="user-card" onclick="viewProfile('${user.user_id}')">
            <div class="user-card-header">
                <div class="user-avatar">${initials}</div>
                <div class="user-basic-info">
                    <h3 class="user-name">${escapeHtml(name)}${demoBadge}</h3>
                    <div class="user-meta">
                        ${profession ? `<span><i class="fas fa-briefcase"></i> ${escapeHtml(profession)}</span>` : ''}
                        ${rooms || area ? `<span><i class="fas fa-home"></i> ${[rooms, area].filter(Boolean).join(', ')}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="user-card-body">
                <div class="user-section">
                    <div class="user-section-label">Zone preferate</div>
                    <div class="user-zones">${zonesHtml}</div>
                </div>
                <div class="user-section">
                    <div class="user-section-label">Interese</div>
                    <div class="user-interests">${tagsHtml}</div>
                </div>
            </div>
            <div class="user-card-footer">
                ${matchingHtml}
                <span class="btn-view-profile">
                    Vezi profil <i class="fas fa-arrow-right"></i>
                </span>
            </div>
        </article>
    `;
}

window.viewProfile = function(userId) {
    window.location.href = `profile-view-new.html?id=${userId}`;
};

// ── UTILITIES ──
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── EVENT BINDINGS ──
function bindEvents() {
    DOM.filterOras.addEventListener('change', () => {
        populateZoneFilter(DOM.filterOras.value);
        applyFilters();
    });
    
    DOM.filterZona.addEventListener('change', applyFilters);
    DOM.filterInteres.addEventListener('change', applyFilters);
    DOM.btnReset.addEventListener('click', resetFilters);
    DOM.btnClearTerenFilter?.addEventListener('click', clearTerenFilter);
}
