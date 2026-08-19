// ═══════════════════════════════════════════════════════════
// GRUPURI.JS - Logica pentru pagina de grupuri
// ═══════════════════════════════════════════════════════════

// ── SUPABASE CLIENT ──
// Uses global `sb` from supabase-config.js

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
let pendingGrupuri = new Set(); // IDs of groups user has pending join request
let filterTerenId = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    // Check URL params for teren filter
    const urlParams = new URLSearchParams(window.location.search);
    filterTerenId = urlParams.get('teren');
    
    // Nav-ul (avatar, dropdown profil, logout, mobil) e gestionat integral de
    // nav.js. Nu mai atașăm handlere aici — duplicarea făcea dublu-toggle pe
    // dropdown și butonul „Profilul meu" nu se mai deschidea.
    plieazaPasiiPeTelefon();
    populateOrasFilter();
    bindFilterEvents();
    await checkAuth();
    await loadGrupuri();
});

// ── PANOUL „CUM ÎNCEPI ȘI CUM COMUNICAȚI" ──
// Cei trei pași sunt scriși `<details open>` în HTML, deci fără JavaScript
// panoul rămâne desfășurat. Aici îi închidem doar pe ecran mic, unde altfel
// ar împinge primul grup mult sub linia ecranului.
//
// ⚠️ Se ascultă `matchMedia`, NU `resize`. Pe telefon, ascunderea barei de
// adresă a browserului declanșează un `resize`, iar cu el am fi închis pașii
// exact în timp ce omul îi citea. `matchMedia` se aude o singură dată, la
// trecerea pragului de 768px, adică la rotirea telefonului.
// Aceeași soluție ca pe pagina de terenuri (`terenuri.js`).
function plieazaPasiiPeTelefon() {
    const ecranMic = window.matchMedia('(max-width: 768px)');

    const aplica = () => {
        document.querySelectorAll('.grup-fold').forEach(pas => {
            pas.open = !ecranMic.matches;
        });
    };

    aplica();
    ecranMic.addEventListener('change', aplica);
}

// ── AUTH ──
let myZones = [];
let myTags = [];

async function checkAuth() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            currentUser = user;
            // Afișarea nav-ului (avatar vs. login) e gestionată de nav.js.

            // Get account type
            const { data: profile } = await sb
                .from('profiles')
                .select('account_type')
                .eq('user_id', user.id)
                .single();
            
            userAccountType = profile?.account_type || 'activ';
            
            // Load current user's preferred zones for matching
            const { data: userZones } = await sb
                .from('user_preferred_zones')
                .select('zone_id, zones(id, name)')
                .eq('user_id', user.id);
            myZones = (userZones || []).map(uz => uz.zones).filter(Boolean);
            
            // Load current user's tags for matching
            const { data: userTags } = await sb
                .from('user_tags')
                .select('tag_id, tags(id, name)')
                .eq('user_id', user.id);
            myTags = (userTags || []).map(ut => ut.tags).filter(Boolean);
            
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
        // Load active memberships
        const { data, error } = await sb
            .from('grup_membri')
            .select('grup_id, status')
            .eq('user_id', currentUser.id)
            .in('status', ['activ', 'pending']);
        
        if (!error && data) {
            myGrupuri = new Set(data.filter(d => d.status === 'activ').map(d => d.grup_id));
            pendingGrupuri = new Set(data.filter(d => d.status === 'pending').map(d => d.grup_id));
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
        DOM.filterStatus && (DOM.filterStatus.value = '');
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
                grup_preferred_zones(zone_id, zones(id, name)),
                grup_tags(tag_id, tags(id, name))
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
        
        // Numărul de membri activi vine de pe SERVER, din view-ul
        // `grup_membri_count` — nu se mai calculează în browser.
        //
        // De ce s-a schimbat: până pe 2 august 2026, numărul se obținea
        // citind direct `grup_membri`, ceea ce cerea ca tabela să fie
        // deschisă vizitatorilor fără cont. Efectul secundar era că
        // oricine putea descărca toate cele 34 de rânduri — cine, în ce
        // grup, cu ce status, din ce dată. View-ul expune doar
        // `grup_id` + un număr, deci vitrina publică funcționează fără
        // ca identitățile să iasă din bază.
        //
        // Logica de numărare (doar `activ`, fără conturile șterse soft)
        // a fost mutată ca atare în definiția view-ului, ca numerele să
        // rămână identice cu cele de dinainte.
        const grupuri = data || [];
        if (grupuri.length > 0) {
            const grupIds = grupuri.map(g => g.id);

            const { data: countRows } = await sb
                .from('grup_membri_count')
                .select('grup_id, membri_count')
                .in('grup_id', grupIds);

            const countByGrup = {};
            (countRows || []).forEach(row => {
                countByGrup[row.grup_id] = row.membri_count;
            });

            grupuri.forEach(g => {
                // Grupurile fără niciun membru activ nu apar în view
                // (așa lucrează GROUP BY), deci lipsa lor înseamnă 0.
                // Păstrăm forma veche (membri[0].count) ca restul
                // codului de randare să rămână neatins.
                g.membri = [{ count: countByGrup[g.id] || 0 }];
            });
        }
        
        allGrupuri = grupuri;
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
    
    // Filter by status (normalize legacy values)
    const status = DOM.filterStatus?.value;
    if (status) {
        const statusMap = { activ: 'deschis', explorare: 'cu_aprobare', inchis: 'cu_aprobare' };
        filtered = filtered.filter(g => {
            const normalized = statusMap[g.status] || g.status;
            return normalized === status;
        });
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
    
    // Render other groups (fără card de recrutare: butonul „Creează un grup" e deja
    // în antetul listei și în banda de jos, cardul dubla mesajul în grilă)
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

    const location = grup.oras ? 
        (grup.zona ? `${grup.oras}, ${grup.zona}` : grup.oras) : 
        'Locație nespecificată';
    
    const description = grup.descriere || 'Fără descriere.';
    
    // Badge "Exemplu" — pentru grupuri marcate ca exemplu (is_demo)
    const demoBadge = grup.is_demo
        ? '<span style="display:inline-flex; align-items:center; gap:4px; background:#f0ece3; color:#6f6a61; font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle; letter-spacing:0.3px;">Exemplu</span>'
        : '';
    
    // Zones and tags for public display
    const grupZones = (grup.grup_preferred_zones || []).map(gz => gz.zones).filter(Boolean);
    const grupTags = (grup.grup_tags || []).map(gt => gt.tags).filter(Boolean);
    
    // Public info: zones and tags
    let publicInfoHtml = '';
    if (grupZones.length > 0 || grupTags.length > 0) {
        const zonesHtml = grupZones.length > 0 
            ? `<span class="matching-info"><i class="fas fa-map-marker-alt"></i> ${grupZones.map(z => escapeHtml(z.name)).join(', ')}</span>` 
            : '';
        const tagsHtml = grupTags.length > 0 
            ? `<span class="matching-info"><i class="fas fa-tags"></i> ${grupTags.map(t => escapeHtml(t.name)).join(', ')}</span>` 
            : '';
        publicInfoHtml = `<div class="grup-matching-stack">${zonesHtml}${tagsHtml}</div>`;
    }
    
    // If not logged in, show simplified card
    if (!currentUser) {
        return `
            <div class="grup-card" data-grup-id="${grup.id}">
                <div class="grup-card-header">
                    <div class="grup-card-header-top">
                        <h3>${escapeHtml(grup.nume)}${demoBadge}</h3>
                    </div>
                    <div class="grup-header-meta">
                        <span class="grup-stat">
                            <i class="fas fa-users"></i>
                            ${membriCount}/${grup.max_membri}
                        </span>
                    </div>
                </div>
                <div class="grup-card-body">
                    <p class="grup-description">${escapeHtml(description)}</p>
                </div>
                <div class="grup-card-footer">
                    ${publicInfoHtml}
                    <div class="grup-card-actions">
                        <a href="register.html" class="btn-alatura">Creează cont pentru detalii</a>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Logged in: full card with join/matching
    // Determine if user can join
    const statusNorm = { activ: 'deschis', explorare: 'cu_aprobare', inchis: 'cu_aprobare', deschis: 'deschis', cu_aprobare: 'cu_aprobare' }[grup.status] || 'deschis';
    const isPending = pendingGrupuri.has(grup.id);
    const canJoin = currentUser && 
                    userAccountType === 'activ' && 
                    !isMember && 
                    !isPending &&
                    membriCount < grup.max_membri;
    const isDeschis = statusNorm === 'deschis';
    const isCuAprobare = statusNorm === 'cu_aprobare';
    
    // Matching with current user's preferred zones and tags
    let matchingHtml = '';
    if (!isMember) {
        const commonZones = grupZones.filter(gz => myZones.some(mz => mz.id === gz.id));
        const commonTags = grupTags.filter(gt => myTags.some(mt => mt.id === gt.id));
        
        const zoneClass = commonZones.length > 0 ? 'matching-yes' : 'matching-no';
        const tagClass = commonTags.length > 0 ? 'matching-yes' : 'matching-no';

        const zoneText = commonZones.length === 1 ? 'o zonă comună' : `${commonZones.length} zone comune`;
        const tagText = commonTags.length === 1 ? 'un interes comun' : `${commonTags.length} interese comune`;

        matchingHtml = `
            <div class="grup-matching-stack">
                <span class="${zoneClass}"><i class="fas fa-map-marker-alt"></i> ${zoneText}</span>
                <span class="${tagClass}"><i class="fas fa-tags"></i> ${tagText}</span>
            </div>`;
    }
    
    return `
        <div class="grup-card" data-grup-id="${grup.id}">
            <div class="grup-card-header">
                <div class="grup-card-header-top">
                    <h3>
                        <a href="grup-details.html?id=${grup.id}">${escapeHtml(grup.nume)}</a>${demoBadge}
                        ${isMember ? (currentUser && grup.admin_id === currentUser.id ? '<span class="member-badge admin-badge">Admin</span>' : '<span class="member-badge">Membru</span>') : ''}
                    </h3>
                </div>
                <div class="grup-header-meta">
                    <span class="grup-stat">
                        <i class="fas fa-users"></i>
                        ${membriCount}/${grup.max_membri}
                    </span>
                </div>
            </div>
            <div class="grup-card-body">
                <p class="grup-description">${escapeHtml(description)}</p>
            </div>
            <div class="grup-card-footer">
                ${matchingHtml}
                <div class="grup-card-actions">
                    <a href="grup-details.html?id=${grup.id}" class="btn-vezi-grup">Vezi</a>
                    ${grup.is_demo
                        ? `<a href="grup-nou.html" class="btn-alatura">Pornește un grup ca acesta</a>`
                        : `${canJoin ? `<button class="btn-alatura" onclick="requestJoinGroup('${grup.id}')">Cere alăturarea</button>` : ''}
                           ${isPending ? `<span class="btn-pending">Aprobare în așteptare</span>` : ''}`
                    }
                </div>
            </div>
        </div>
    `;
}

// ── JOIN GROUP ──
// `joinGroup()` — intrarea directă ca `activ` — a fost ștearsă. Nu era
// apelată de nicăieri (cardurile de pe /grupuri.html oferă doar „Cere
// alăturarea"), iar politica de INSERT pe `grup_membri` refuză de acum
// inserarea directă ca membru activ. Rămâne o singură cale: cererea de
// mai jos, pe care o aprobă adminul grupului.

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
        
        // Notify group admin via email
        try {
            // Get group info and admin email
            const { data: grup } = await sb
                .from('grupuri')
                .select('nume, admin_id')
                .eq('id', grupId)
                .single();
            
            if (grup && grup.admin_id) {
                // Adresa adminului NU se mai citeste din browser — trimitem
                // `admin_user_id`, iar `notify-admins` o rezolva pe server, cu
                // service role. La fel si adresa proprie: e deja in sesiune
                // (`currentUser.email`), deci nu mai are rost o interogare.
                const { data: requesterProfile } = await sb
                    .from('profiles_visible')
                    .select('pseudonym')
                    .eq('user_id', currentUser.id)
                    .single();

                await sb.functions.invoke('notify-admins', {
                    body: {
                        // Evenimentul modern: text in romana, template cu buton,
                        // si copie automata la superadmin (SUPERADMIN_CC_ALWAYS).
                        // Inainte era 'membership_request' (legacy, englezesc,
                        // fara copie la superadmin) — pagina grupului folosea deja
                        // 'join_request', deci acelasi buton dadea doua rezultate.
                        event_type: 'join_request',
                        data: {
                            // numele moderne: linkul din buton se face din group_id
                            group_id: grupId,
                            group_name: grup.nume,
                            user_id: currentUser.id,
                            user_email: currentUser.email,
                            user_name: requesterProfile?.pseudonym || 'Utilizator',
                            admin_user_id: grup.admin_id
                        }
                    }
                });
            }
        } catch (notifyErr) {
            console.warn('Could not notify group admin:', notifyErr);
            // Don't block the user — request was already saved
        }
        
        setTimeout(() => window.location.reload(), 1500);
        
    } catch (e) {
        console.error('Request join error:', e);
        // 42501 = politica de INSERT a refuzat rândul. În practică:
        // profil necompletat (pragul cerut de `profil_complet`) sau cont
        // de agenție. Mesajul generic ar lăsa omul fără nicio idee ce are
        // de făcut.
        if (e && (e.code === '42501' || String(e.message || '').indexOf('row-level security') !== -1)) {
            showToast('Ca să te poți alătura unui grup, completează-ți întâi profilul.', 'error');
            setTimeout(() => window.location.href = 'profile-edit-new.html', 2500);
            return;
        }
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
