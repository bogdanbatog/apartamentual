// ═══════════════════════════════════════════════════════════
// GRUPURI.JS - Logica pentru pagina de grupuri
// ═══════════════════════════════════════════════════════════

// ── SUPABASE CLIENT ──
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── DOM ELEMENTS ──
const DOM = {
    // Filters
    filterOras: document.getElementById('filterOras'),
    filterStatus: document.getElementById('filterStatus'),
    filterSort: document.getElementById('filterSort'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    // Teren filter banner
    terenFilterBanner: document.getElementById('terenFilterBanner'),
    terenFilterName: document.getElementById('terenFilterName'),
    btnClearTerenFilter: document.getElementById('btnClearTerenFilter'),
    // My groups
    myGroupsSection: document.getElementById('myGroupsSection'),
    myGroupsGrid: document.getElementById('myGroupsGrid'),
    // Main content
    contentTitle: document.getElementById('contentTitle'),
    grupuriCount: document.getElementById('grupuriCount'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    grupuriGrid: document.getElementById('grupuriGrid'),
    // Nav
    navUser: document.getElementById('navUser'),
    btnLoginNav: document.getElementById('btnLoginNav'),
    btnUserAvatar: document.getElementById('btnUserAvatar'),
    userDropdown: document.getElementById('userDropdown'),
    btnLogout: document.getElementById('btnLogout'),
    navMobileToggle: document.getElementById('navMobileToggle'),
    // Toast
    toastContainer: document.getElementById('toastContainer'),
};

// ── STATE ──
let currentUser = null;
let userAccountType = null;
let allGrupuri = [];
let myGrupuri = new Set(); // IDs of groups user is member of
let filterTerenId = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    // Check URL params for teren filter
    const urlParams = new URLSearchParams(window.location.search);
    filterTerenId = urlParams.get('teren');
    
    initNav();
    populateOrasFilter();
    bindFilterEvents();
    await checkAuth();
    await loadGrupuri();
});

// ── NAV ──
function initNav() {
    if (DOM.btnUserAvatar) {
        DOM.btnUserAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.userDropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            DOM.userDropdown.classList.remove('show');
        });
    }
    
    if (DOM.btnLogout) {
        DOM.btnLogout.addEventListener('click', async () => {
            await sb.auth.signOut();
            window.location.reload();
        });
    }
    
    if (DOM.navMobileToggle) {
        DOM.navMobileToggle.addEventListener('click', () => {
            // Mobile menu toggle - to be implemented
        });
    }
}

// ── AUTH ──
async function checkAuth() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            currentUser = user;
            DOM.navUser.style.display = 'block';
            DOM.btnLoginNav.style.display = 'none';
            
            // Get account type
            const { data: profile } = await sb
                .from('profiles')
                .select('account_type')
                .eq('user_id', user.id)
                .single();
            
            userAccountType = profile?.account_type || 'activ';
            
            // Load user's group memberships
            await loadMyGroups();
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
    }
}

// ── LOAD MY GROUPS ──
async function loadMyGroups() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await sb
            .from('grup_membri')
            .select('grup_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'activ');
        
        if (!error && data) {
            myGrupuri = new Set(data.map(d => d.grup_id));
        }
    } catch (e) {
        console.warn('Could not load user groups:', e);
    }
}

// ── POPULATE FILTERS ──
function populateOrasFilter() {
    if (!DOM.filterOras) return;
    
    const orase = getOrase();
    orase.forEach(oras => {
        const opt = document.createElement('option');
        opt.value = oras;
        opt.textContent = oras;
        DOM.filterOras.appendChild(opt);
    });
}

// ── BIND EVENTS ──
function bindFilterEvents() {
    DOM.filterOras?.addEventListener('change', applyFilters);
    DOM.filterStatus?.addEventListener('change', applyFilters);
    DOM.filterSort?.addEventListener('change', applyFilters);
    
    DOM.btnResetFilters?.addEventListener('click', () => {
        DOM.filterOras.value = '';
        DOM.filterStatus.value = '';
        DOM.filterSort.value = 'recent';
        applyFilters();
    });
    
    DOM.btnClearTerenFilter?.addEventListener('click', () => {
        filterTerenId = null;
        DOM.terenFilterBanner.style.display = 'none';
        // Update URL
        const url = new URL(window.location);
        url.searchParams.delete('teren');
        window.history.replaceState({}, '', url);
        applyFilters();
    });
}

// ── LOAD GRUPURI ──
async function loadGrupuri() {
    showLoading();
    
    try {
        let query = sb
            .from('grupuri')
            .select(`
                *,
                membri:grup_membri(count)
            `)
            .neq('status', 'arhivat');
        
        // If filtering by teren
        if (filterTerenId) {
            // First get grup IDs that liked this teren
            const { data: likesData } = await sb
                .from('terenuri_likes_grupuri')
                .select('grup_id')
                .eq('teren_id', filterTerenId);
            
            if (likesData && likesData.length > 0) {
                const grupIds = likesData.map(l => l.grup_id);
                query = query.in('id', grupIds);
            } else {
                // No groups liked this teren
                allGrupuri = [];
                renderGrupuri([]);
                await loadTerenName();
                return;
            }
            
            await loadTerenName();
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        allGrupuri = data || [];
        applyFilters();
        
    } catch (e) {
        console.error('Error loading grupuri:', e);
        showToast('Eroare la încărcarea grupurilor.', 'error');
        hideLoading();
    }
}

// ── LOAD TEREN NAME (for filter banner) ──
async function loadTerenName() {
    if (!filterTerenId) return;
    
    try {
        const { data } = await sb
            .from('terenuri')
            .select('titlu')
            .eq('id', filterTerenId)
            .single();
        
        if (data) {
            DOM.terenFilterName.textContent = data.titlu;
            DOM.terenFilterBanner.style.display = 'block';
        }
    } catch (e) {
        console.warn('Could not load teren name:', e);
    }
}

// ── APPLY FILTERS ──
function applyFilters() {
    let filtered = [...allGrupuri];
    
    // Filter by oras
    const oras = DOM.filterOras?.value;
    if (oras) {
        filtered = filtered.filter(g => g.oras === oras);
    }
    
    // Filter by status
    const status = DOM.filterStatus?.value;
    if (status) {
        filtered = filtered.filter(g => g.status === status);
    }
    
    // Sort
    const sort = DOM.filterSort?.value || 'recent';
    switch (sort) {
        case 'recent':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'activitate':
            filtered.sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));
            break;
        case 'membri':
            filtered.sort((a, b) => (b.membri?.[0]?.count || 0) - (a.membri?.[0]?.count || 0));
            break;
    }
    
    // Prioritize by status (deschis > cu_aprobare)
    if (sort === 'recent' || sort === 'activitate') {
        const statusOrder = { deschis: 0, cu_aprobare: 1, activ: 0, explorare: 1, inchis: 1 };
        filtered.sort((a, b) => {
            const orderDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
            if (orderDiff !== 0) return orderDiff;
            return 0; // Keep secondary sort
        });
    }
    
    renderGrupuri(filtered);
}

// ── RENDER GRUPURI ──
function renderGrupuri(grupuri) {
    hideLoading();
    
    // Update count
    DOM.grupuriCount.textContent = `${grupuri.length} grupuri`;
    
    // Show/hide empty state
    if (grupuri.length === 0) {
        DOM.emptyState.style.display = 'block';
        DOM.grupuriGrid.innerHTML = '';
        DOM.myGroupsSection.style.display = 'none';
        return;
    }
    
    DOM.emptyState.style.display = 'none';
    
    // Separate my groups
    const myGroups = grupuri.filter(g => myGrupuri.has(g.id));
    const otherGroups = grupuri.filter(g => !myGrupuri.has(g.id));
    
    // Render my groups section
    if (myGroups.length > 0 && currentUser) {
        DOM.myGroupsSection.style.display = 'block';
        DOM.myGroupsGrid.innerHTML = myGroups.map(g => renderGrupCard(g, true)).join('');
    } else {
        DOM.myGroupsSection.style.display = 'none';
    }
    
    // Render other groups
    DOM.grupuriGrid.innerHTML = otherGroups.map(g => renderGrupCard(g, false)).join('');
}

// ── RENDER GRUP CARD ──
function renderGrupCard(grup, isMember) {
    const statusLabels = {
        deschis: '🟢 Deschis',
        cu_aprobare: '🟡 Cu aprobare',
        // Legacy
        activ: '🟢 Deschis',
        explorare: '🟡 Cu aprobare',
        inchis: '🟡 Cu aprobare',
        arhivat: '⚫ Arhivat'
    };
    
    const statusClass = `status-${grup.status}`;
    const membriCount = grup.membri?.[0]?.count || 0;
    const activityBadge = getActivityBadge(grup.last_activity_at);
    
    const location = grup.oras ? 
        (grup.zona ? `${grup.oras}, ${grup.zona}` : grup.oras) : 
        'Locație nespecificată';
    
    const description = grup.descriere || 'Fără descriere.';
    
    // Determine if user can join
    const statusNorm = { activ: 'deschis', explorare: 'cu_aprobare', inchis: 'cu_aprobare', deschis: 'deschis', cu_aprobare: 'cu_aprobare' }[grup.status] || 'deschis';
    const canJoin = currentUser && 
                    userAccountType === 'activ' && 
                    !isMember && 
                    membriCount < grup.max_membri;
    const isDeschis = statusNorm === 'deschis';
    const isCuAprobare = statusNorm === 'cu_aprobare';
    
    return `
        <div class="grup-card" data-grup-id="${grup.id}">
            <div class="grup-card-header">
                <div class="grup-card-header-top">
                    <h3>
                        <a href="grup-details.html?id=${grup.id}">${escapeHtml(grup.nume)}</a>
                        ${isMember ? '<span class="member-badge">Membru</span>' : ''}
                    </h3>
                    <span class="status-badge ${statusClass}">${statusLabels[grup.status]}</span>
                </div>
                <div class="grup-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${escapeHtml(location)}
                </div>
            </div>
            <div class="grup-card-body">
                <p class="grup-description">${escapeHtml(description)}</p>
            </div>
            <div class="grup-card-footer">
                <div class="grup-stats">
                    <span class="grup-stat">
                        <i class="fas fa-users"></i>
                        ${membriCount}/${grup.max_membri}
                    </span>
                    <span class="activity-badge activity-${activityBadge.class}">
                        ${activityBadge.label}
                    </span>
                </div>
                <div class="grup-card-actions">
                    <a href="grup-details.html?id=${grup.id}" class="btn-vezi-grup">Vezi</a>
                    ${canJoin && isDeschis ? `<button class="btn-alatura" onclick="joinGroup('${grup.id}')">Alătură-te</button>` : ''}
                    ${canJoin && isCuAprobare ? `<button class="btn-alatura" onclick="requestJoinGroup('${grup.id}')">Cere alăturarea</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// ── GET ACTIVITY BADGE ──
function getActivityBadge(lastActivity) {
    if (!lastActivity) return { class: 'inactiv', label: 'Inactiv' };
    
    const now = new Date();
    const last = new Date(lastActivity);
    const daysDiff = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 14) {
        return { class: 'recent', label: 'Activ recent' };
    } else if (daysDiff < 45) {
        return { class: 'moderat', label: 'Moderat activ' };
    } else {
        return { class: 'inactiv', label: 'Inactiv' };
    }
}

// ── JOIN GROUP ──
window.joinGroup = async function(grupId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat pentru a te alătura unui grup.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }
    
    if (userAccountType === 'profesional') {
        showToast('Conturile de agenție nu pot face parte din grupuri.', 'info');
        return;
    }
    
    try {
        const { error } = await sb
            .from('grup_membri')
            .insert({
                grup_id: grupId,
                user_id: currentUser.id,
                status: 'activ'
            });
        
        if (error) throw error;
        
        myGrupuri.add(grupId);
        showToast('Te-ai alăturat grupului cu succes!', 'success');
        
        // Reload to update UI
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (e) {
        console.error('Join group error:', e);
        if (e.message?.includes('max_membri')) {
            showToast('Grupul este plin.', 'error');
        } else {
            showToast('Eroare la alăturare. Încearcă din nou.', 'error');
        }
    }
};

window.requestJoinGroup = async function(grupId) {
    if (!currentUser) {
        showToast('Trebuie să fii conectat.', 'info');
        setTimeout(() => window.location.href = 'register.html', 1500);
        return;
    }
    
    if (userAccountType === 'profesional') {
        showToast('Conturile de agenție nu pot face parte din grupuri.', 'info');
        return;
    }
    
    try {
        const { error } = await sb
            .from('grup_membri')
            .insert({
                grup_id: grupId,
                user_id: currentUser.id,
                status: 'pending'
            });
        
        if (error) throw error;
        
        showToast('Cererea ta a fost trimisă! Adminul grupului o va analiza.', 'success');
        setTimeout(() => window.location.reload(), 1500);
        
    } catch (e) {
        console.error('Request join error:', e);
        showToast('Eroare la trimiterea cererii.', 'error');
    }
};

// ── HELPERS ──
function showLoading() {
    DOM.loadingState.style.display = 'block';
    DOM.grupuriGrid.innerHTML = '';
    DOM.emptyState.style.display = 'none';
}

function hideLoading() {
    DOM.loadingState.style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3500);
}
