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
    btnLoginNav: document.getElementById('btn-login-nav'),
    // Bifele de potrivire
    potriviriWrap: document.getElementById('potriviri-wrap'),
    wrapZoneComune: document.getElementById('wrap-zone-comune'),
    wrapIntereseComune: document.getElementById('wrap-interese-comune'),
    filterZoneComune: document.getElementById('filter-zone-comune'),
    filterIntereseComune: document.getElementById('filter-interese-comune'),
    filterNoi: document.getElementById('filter-noi'),
    linkProfilPotriviri: document.getElementById('link-profil-potriviri')
};

// ── „ÎNSCRIȘI RECENT" ──
// ⚠️ ACELAȘI NUMĂR CU `ZILE_FLUX` DIN `frontend/index.html`. Rândul de flux de
// pe homepage („12 utilizatori noi au zone comune cu tine") numără pe fereastra
// de acolo și trimite aici cu bifele puse. Dacă ferestrele se despart, omul dă
// clic pe 12 și găsește alt număr, fără nicio eroare pe ecran care să explice.
const ZILE_NOI = 14;

function esteNou(u) {
    if (!u.created_at) return false;
    return (Date.now() - new Date(u.created_at).getTime()) <= ZILE_NOI * 86400000;
}

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
    // ⚠️ După `checkAuth`, fiindcă se uită la zonele și interesele omului ca să
    // decidă ce bife are rost să arate, și ÎNAINTE de `loadUsers`, care se
    // termină cu `applyFilters` — altfel prima listă s-ar desena nefiltrată și
    // ar sări sub ochii omului o clipă mai târziu.
    setupBifePotrivire();
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

// ── MATCHING (folosit la sortare cand esti logat) ──
// Cate dintre zonele mele preferate are in comun acest utilizator
function zoneMatchCount(u) {
    if (!currentUser) return 0;
    return (u.zones || []).filter(z => myZones.some(mz => mz.id === z.id)).length;
}
// Cate interese (tag-uri) am in comun cu acest utilizator
function tagMatchCount(u) {
    if (!currentUser) return 0;
    return (u.tags || []).filter(t => myTags.some(mt => mt.id === t.id)).length;
}

// ── BIFELE DE POTRIVIRE ──
// Trei bife peste ceva ce se calculeaza oricum (`zoneMatchCount`, `tagMatchCount`
// si `created_at`), deci nicio interogare noua. Se poarta ca bifa „doar zonele
// mele" de pe /terenuri: starea lor se scrie in URL, ca linkul sa poata fi
// copiat mai departe.
//
// PRIMELE DOUA VIN PUSE din fluxul de pe homepage (?zone_comune=1&noi=1), fiindca
// randul de acolo promite un numar anume de oameni si numarul trebuie sa se
// potriveasca. A TREIA nu se prebifeaza NICIODATA dintr-un link: e o largire pe
// care o cere omul, nu una pe care i-o facem noi.
//
// ⚠️ Bifele pe zone si pe interese cer cont SI date in profil: fara zone bifate,
//    „zone comune cu mine" n-ar avea ce filtra si ar intoarce mereu lista goala.
//    Bifa „inscrisi recent" nu cere nimic, deci o vede si nelogatul.
function setupBifePotrivire() {
    if (!DOM.potriviriWrap) return;

    const params = new URLSearchParams(window.location.search);
    const areZone = currentUser && myZones.length > 0;
    const areInterese = currentUser && myTags.length > 0;

    if (areZone) {
        DOM.wrapZoneComune.style.display = 'inline-flex';
        DOM.filterZoneComune.checked = params.get('zone_comune') === '1';
    }
    if (areInterese) {
        DOM.wrapIntereseComune.style.display = 'inline-flex';
        // Fara `params`: bifa asta nu se pune din link, doar cu mana.
        DOM.filterIntereseComune.checked = false;
    }
    if (areZone || areInterese) {
        DOM.linkProfilPotriviri.style.display = 'inline-flex';
    }
    DOM.filterNoi.checked = params.get('noi') === '1';

    DOM.potriviriWrap.style.display = 'flex';
}

// URL-ul ramane cinstit: bifa pusa din pagina se vede in adresa. `replaceState`,
// nu `pushState`, ca fiecare bifare sa nu adauge un pas la butonul „inapoi".
function scrieBifeleInUrl() {
    try {
        const url = new URL(window.location.href);
        const pune = (nume, activ) => {
            if (activ) url.searchParams.set(nume, '1');
            else url.searchParams.delete(nume);
        };
        pune('zone_comune', DOM.filterZoneComune && DOM.filterZoneComune.checked);
        pune('interese_comune', DOM.filterIntereseComune && DOM.filterIntereseComune.checked);
        pune('noi', DOM.filterNoi && DOM.filterNoi.checked);
        window.history.replaceState({}, '', url);
    } catch (e) {
        // Un URL pe care browserul nu-l poate rescrie nu e motiv sa pice filtrul.
    }
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
        
        // Exclude current user from the list
        if (currentUser) {
            allUsers = allUsers.filter(u => u.user_id !== currentUser.id);
        }

        // Ordonare:
        //  1. Utilizatorii reali intai, cei marcati ca exemplu (is_demo) mereu la sfarsit
        //  2. Printre reali:
        //     - logat: dupa matching-ul de zona cu tine (apoi interese comune), descrescator
        //     - nelogat: in ordinea inscrierii (cei mai vechi primii)
        //  3. Exemplele raman la coada, ordonate dupa aceleasi criterii intre ele
        allUsers.sort((a, b) => {
            // 1. Reali (is_demo fals) inaintea exemplelor (is_demo adevarat)
            const aDemo = a.is_demo ? 1 : 0;
            const bDemo = b.is_demo ? 1 : 0;
            if (aDemo !== bDemo) return aDemo - bDemo;

            // 2. Doar cand esti logat: matching de zona, apoi de interese
            if (currentUser) {
                const zoneDiff = zoneMatchCount(b) - zoneMatchCount(a);
                if (zoneDiff !== 0) return zoneDiff;
                const tagDiff = tagMatchCount(b) - tagMatchCount(a);
                if (tagDiff !== 0) return tagDiff;
            }

            // 3. Nelogat sau egalitate la matching: ordinea inscrierii (cei mai vechi primii)
            return new Date(a.created_at) - new Date(b.created_at);
        });
        
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
        // Aceeași ordine ca la filtrul de terenuri: cartierele alfabetic, apoi
        // comunele periurbane într-un grup separat la final („Ilfov").
        appendCartiereOptions(DOM.filterZona, oras);
    } else {
        DOM.filterZona.disabled = true;
        DOM.filterZona.innerHTML = '<option value="">Alege mai întâi orașul</option>';
    }
}

function applyFilters() {
    const filters = {
        oras: DOM.filterOras.value,
        zona: DOM.filterZona.value,
        interes: DOM.filterInteres.value,
        // Bifele lipsesc din DOM doar daca marcajul e mai vechi decat scriptul;
        // `?.` tine pagina intreaga in cazul acela, cu filtrele de sus lucrand.
        zoneComune: !!DOM.filterZoneComune?.checked,
        intereseComune: !!DOM.filterIntereseComune?.checked,
        noi: !!DOM.filterNoi?.checked
    };

    let filtered = [...allUsers];

    // Bifele de potrivire. Se aplica inaintea filtrelor cu meniuri fiindca taie
    // cel mai mult, dar ordinea nu schimba rezultatul, doar cate randuri trec
    // prin filtrele urmatoare.
    //
    // ⚠️ Pentru nelogat, `zoneMatchCount` si `tagMatchCount` intorc 0, deci
    //    bifele astea ar goli lista. Nu se poate ajunge acolo: bifele nu se
    //    arata nelogatului si nici nu se pun din link fara cont — dar daca
    //    vreodata se schimba asta, aici e locul unde s-ar vedea.
    if (filters.zoneComune) {
        filtered = filtered.filter(u => zoneMatchCount(u) > 0);
    }
    if (filters.intereseComune) {
        filtered = filtered.filter(u => tagMatchCount(u) > 0);
    }
    if (filters.noi) {
        filtered = filtered.filter(esteNou);
    }
    
    // Filter by city: userul are cel puțin o zonă care aparține orașului ales,
    // folosind maparea oraș→zone (ORASE_CARTIERE). Înainte se compara GREȘIT
    // numele zonei cu numele orașului prin includes(), așa că treceau doar userii
    // cu o zonă al cărei nume conținea orașul (ex. „București Noi") — restul,
    // deși evident din oraș, erau ascunși.
    if (filters.oras) {
        const zoneleOrasului = new Set(
            (typeof ORASE_CARTIERE !== 'undefined' && Array.isArray(ORASE_CARTIERE[filters.oras]))
                ? ORASE_CARTIERE[filters.oras]
                : []
        );
        filtered = filtered.filter(user =>
            user.zones.some(z => z.name && zoneleOrasului.has(z.name))
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
    // Si bifele: altfel omul venit de pe homepage cu doua filtre puse din link
    // n-are de unde sti ca lista e taiata, si crede ca atatia oameni sunt.
    if (filters.zoneComune) {
        tags.push({ type: 'zone_comune', label: 'Zone comune cu mine' });
    }
    if (filters.intereseComune) {
        tags.push({ type: 'interese_comune', label: 'Interese comune cu mine' });
    }
    if (filters.noi) {
        tags.push({ type: 'noi', label: 'Înscriși în ultimele ' + ZILE_NOI + ' zile' });
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
    } else if (type === 'zone_comune') {
        DOM.filterZoneComune.checked = false;
        scrieBifeleInUrl();
    } else if (type === 'interese_comune') {
        DOM.filterIntereseComune.checked = false;
        scrieBifeleInUrl();
    } else if (type === 'noi') {
        DOM.filterNoi.checked = false;
        scrieBifeleInUrl();
    }
    applyFilters();
};

function resetFilters() {
    DOM.filterOras.value = '';
    DOM.filterZona.value = '';
    DOM.filterInteres.value = '';
    // „Resetează" curăță tot ce taie lista, inclusiv bifele venite din link:
    // altfel omul apasă butonul, vede filtrele de sus golite și lista tot
    // scurtă, fără să înțeleagă de ce.
    if (DOM.filterZoneComune) DOM.filterZoneComune.checked = false;
    if (DOM.filterIntereseComune) DOM.filterIntereseComune.checked = false;
    if (DOM.filterNoi) DOM.filterNoi.checked = false;
    scrieBifeleInUrl();
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

// „1 utilizator găsit", „3 utilizatori găsiți", „21 de utilizatori găsiți".
//
// Înlocuiește o construcție care lipea un „i" la coadă și scotea „utilizatori
// găsiti", fără diacritic, la ORICE număr diferit de 1 — adică aproape mereu.
// Se vedea de la prima încărcare a paginii.
//
// „De" intră când ultimele două cifre NU sunt între 1 și 19: 20 de utilizatori,
// 100 de utilizatori, dar 101 utilizatori. Aceeași regulă ca în emailul
// săptămânal de terenuri, unde acordul se face în SQL.
function textRezultate(n) {
    if (n === 1) return '1 utilizator găsit';
    const ultimele = n % 100;
    const de = (n === 0 || (ultimele >= 1 && ultimele <= 19)) ? '' : ' de';
    return n + de + ' utilizatori găsiți';
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
    DOM.resultsCount.textContent = textRezultate(users.length);
    
    // Card de recrutare "Locul tău aici" — doar pentru vizitatori nelogați, ca prim card
    const recruitCard = !currentUser ? renderRecruitCard() : '';
    DOM.usersGrid.innerHTML = recruitCard + users.map(user => renderUserCard(user)).join('');
}

// Card de recrutare afișat ca prim card în grilă (doar vizitatori nelogați)
function renderRecruitCard() {
    return `
        <article class="user-card recruit-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:12px; padding:24px; border:2px dashed #c2604a; background:#faf6f2;">
            <div style="font-size:26px; color:#c2604a;"><i class="fas fa-user-plus"></i></div>
            <h3 style="margin:0; font-size:1.1rem; color:#1a1a1a;">Locul tău aici</h3>
            <p style="margin:0; font-size:0.9rem; line-height:1.5; color:#6f6a61; max-width:240px;">Creează-ți profilul și lasă vecinii potriviți să te găsească.</p>
            <a href="register.html" style="display:inline-block; background:#1a1a1a; color:#fff; padding:9px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem;">Creează cont</a>
        </article>
    `;
}

function renderUserCard(user) {
    const name = user.pseudonym || 'Utilizator';
    const initials = name.charAt(0).toUpperCase();
    const profession = user.profession || '';
    const rooms = user.preferred_rooms ? `${user.preferred_rooms} camere` : '';
    const area = user.preferred_area_sqm ? `${user.preferred_area_sqm} mp` : '';
    
    // Badge "Exemplu" — pentru utilizatori marcaţi ca exemplu (is_demo)
    const demoBadge = user.is_demo
        ? '<span style="display:inline-flex; align-items:center; gap:4px; background:#f0ece3; color:#6f6a61; font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle; letter-spacing:0.3px;">Exemplu</span>'
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

        const zoneText = commonZones.length === 1 ? 'o zonă comună' : `${commonZones.length} zone comune`;
        const tagText = commonTags.length === 1 ? 'un interes comun' : `${commonTags.length} interese comune`;

        matchingHtml = `
            <div class="user-matching-stack">
                <span class="${zoneClass}"><i class="fas fa-map-marker-alt"></i> ${zoneText}</span>
                <span class="${tagClass}"><i class="fas fa-tags"></i> ${tagText}</span>
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

    [DOM.filterZoneComune, DOM.filterIntereseComune, DOM.filterNoi].forEach(bifa => {
        bifa?.addEventListener('change', () => {
            scrieBifeleInUrl();
            applyFilters();
        });
    });
}
