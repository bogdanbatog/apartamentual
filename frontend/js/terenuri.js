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
    resultsHint:      document.querySelector('.results-hint'),
    loadingState:     document.getElementById('loadingState'),
    emptyState:       document.getElementById('emptyState'),
    emptyStateTitle:  document.getElementById('emptyStateTitle'),
    emptyStateText:   document.getElementById('emptyStateText'),
    // Bifa „doar zonele mele"
    zoneMineWrap:     document.getElementById('zoneMineWrap'),
    zoneMineGuest:    document.getElementById('zoneMineGuest'),
    btnZoneMineLogin: document.getElementById('btnZoneMineLogin'),
    filterZoneleMele: document.getElementById('filterZoneleMele'),
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

// Textul implicit al stării goale, citit din pagină ca să nu fie scris în două
// locuri: bifa „zonele mele" îl schimbă și trebuie să-l poată pune la loc.
const EMPTY_STATE_IMPLICIT = {
    titlu: DOM.emptyStateTitle ? DOM.emptyStateTitle.textContent : '',
    text:  DOM.emptyStateText  ? DOM.emptyStateText.textContent  : '',
};

// Prețul analizei preliminare, scris o singură dată pentru toate cardurile.
// ⚠️ Mai e scris de mână în panoul din capul paginii (terenuri.html) și în
// restul frontendului: analize.html, analiza-simplificata.html,
// comanda-analiza.html, servicii.html. La expirarea prețului de lansare se
// schimbă în toate.
const PRET_ANALIZA = '99 RON';

// ── STATE ─────────────────────────────────
let currentUser = null;
let allTerenuri = [];
let userLikes = new Set();        // set of teren IDs the user liked
let myZoneKeys = new Set();       // zonele bifate în profil, ca „oraș|cartier" normalizat
let likesCountMap = {};           // { teren_id: count }
let currentTerenForGroup = null;  // teren ID when opening "add to group" modal

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Nav-ul (avatar, dropdown profil, logout, mobil) e gestionat integral de
    // nav.js. Nu mai atașăm handlere aici — duplicarea făcea dublu-toggle pe
    // dropdown și butonul „Profilul meu" nu se mai deschidea.
    plieazaPasiiPeTelefon();
    populateOrasFilter();
    bindFilterEvents();
    bindModalEvents();
    await checkAuth();
    setupZoneMineFilter();   // după checkAuth: are nevoie de zonele omului
    await loadTerenuri();
});

// ══════════════════════════════════════════
//  PANOUL DE ANALIZĂ
// ══════════════════════════════════════════

// Pașii 3 și 4 sunt scriși `<details open>` în HTML, deci fără JavaScript
// panoul rămâne desfășurat, ca înainte. Aici îi închidem doar pe ecran mic,
// unde panoul ajungea la 576px și împingea primul teren dincolo de 1100px.
//
// ⚠️ Se ascultă `matchMedia`, NU `resize`. Pe telefon, ascunderea barei de
// adresă a browserului declanșează un `resize`, iar cu el am fi închis pașii
// exact în timp ce omul îi citea. `matchMedia` se aude o singură dată, când
// se trece pragul de 768px, adică la rotirea telefonului.
function plieazaPasiiPeTelefon() {
    const ecranMic = window.matchMedia('(max-width: 768px)');

    const aplica = () => {
        document.querySelectorAll('.analiza-fold').forEach(pas => {
            pas.open = !ecranMic.matches;
        });
    };

    aplica();
    ecranMic.addEventListener('change', aplica);
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
let userAccountType = null; // 'activ' or 'profesional'

async function checkAuth() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            currentUser = user;
            // Afișarea nav-ului (avatar vs. login) e gestionată de nav.js.

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

            // Zonele bifate în profil, pentru bifa „doar zonele mele".
            // Se cer pentru orice tip de cont: dacă omul n-are nicio zonă,
            // mulțimea rămâne goală și bifa nu se mai arată deloc.
            await loadMyZoneKeys(user.id);
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
//  ZONELE MELE (bifa de pe bara de filtre)
// ══════════════════════════════════════════

// Terenurile țin cartierul ca TEXT (`terenuri.cartier` + `terenuri.oras`), iar
// omul își bifează zonele ca legătură către tabela `zones` (`zones.city_id` →
// `cities`). Nu există cheie străină între ele, deci potrivirea se face pe text.
// ⚠️ Normalizarea de aici e aceeași cu a emailului săptămânal
// (`db_schema/digest-terenuri/2c-functie-cu-lista-terenuri.sql`, care face
// `lower(btrim(...))` pe ambele capete): fără scoaterea diacriticelor, fără
// strângerea spațiilor din interior. Dacă se schimbă una, se schimbă amândouă,
// altfel pagina și emailul încep să arate liste diferite.
function normalizeazaText(valoare) {
    return String(valoare == null ? '' : valoare).trim().toLowerCase();
}

function cheieZona(oras, cartier) {
    return normalizeazaText(oras) + '|' + normalizeazaText(cartier);
}

async function loadMyZoneKeys(userId) {
    try {
        const { data: zoneRows, error } = await sb
            .from('user_preferred_zones')
            .select('zone_id, zones(id, name, city_id)')
            .eq('user_id', userId);

        if (error || !zoneRows) return;

        const zone = zoneRows.map(r => r.zones).filter(Boolean);
        const cityIds = [...new Set(zone.map(z => z.city_id).filter(Boolean))];
        if (cityIds.length === 0) return;

        // Numele orașului stă în altă tabelă, iar terenul îl ține ca text.
        // Fără el, „Centru" din Cluj s-ar potrivi cu „Centru" din Brașov.
        const { data: orase } = await sb
            .from('cities')
            .select('id, name')
            .in('id', cityIds);

        const numeOras = {};
        (orase || []).forEach(c => { numeOras[c.id] = c.name; });

        myZoneKeys = new Set(
            zone
                .filter(z => numeOras[z.city_id])
                .map(z => cheieZona(numeOras[z.city_id], z.name))
        );
    } catch (e) {
        console.warn('Could not load preferred zones:', e);
    }
}

function esteInZoneleMele(teren) {
    return myZoneKeys.has(cheieZona(teren.oras, teren.cartier));
}

function setupZoneMineFilter() {
    if (!DOM.filterZoneleMele) return;

    // Linkul din emailul săptămânal poate cere filtrul gata pus: ?zonele_mele=1
    const cerutDinUrl = new URLSearchParams(window.location.search).get('zonele_mele') === '1';

    if (myZoneKeys.size === 0) {
        // Fără cont, sau cu cont dar fără nicio zonă bifată: bifa n-ar avea ce
        // filtra, deci nu se arată. Rândul explicativ apare numai celui venit pe
        // un link cu filtrul cerut, ca să înțeleagă de ce nu vede ce i s-a promis.
        if (cerutDinUrl && DOM.zoneMineGuest) {
            if (currentUser) {
                DOM.zoneMineGuest.querySelector('span').textContent =
                    'Nu ai nicio zonă bifată în profil, așa că nu putem filtra după zonele tale.';
                DOM.btnZoneMineLogin.innerHTML = '<i class="fas fa-sliders-h"></i> Bifează-ți zonele';
                DOM.btnZoneMineLogin.addEventListener('click', () => {
                    window.location.href = 'profile-edit-new.html';
                });
            } else {
                DOM.btnZoneMineLogin.addEventListener('click', () => {
                    // După autentificare, login-modal.js reîncarcă pagina cu
                    // același URL, deci ?zonele_mele=1 se păstrează și bifa apare.
                    if (typeof window.openLoginModal === 'function') window.openLoginModal();
                    else window.location.href = 'register.html';
                });
            }
            DOM.zoneMineGuest.style.display = 'flex';
        }
        return;
    }

    DOM.zoneMineWrap.style.display = 'flex';
    DOM.filterZoneleMele.checked = cerutDinUrl;

    DOM.filterZoneleMele.addEventListener('change', () => {
        scrieZoneleMeleInUrl(DOM.filterZoneleMele.checked);
        applyFilters();
    });
}

// URL-ul rămâne cinstit: bifa pusă din pagină se vede în adresă, deci linkul
// se poate copia mai departe. `replaceState`, nu `pushState`: altfel fiecare
// bifare ar adăuga un pas la butonul „înapoi" al browserului.
function scrieZoneleMeleInUrl(activ) {
    try {
        const url = new URL(window.location.href);
        if (activ) url.searchParams.set('zonele_mele', '1');
        else url.searchParams.delete('zonele_mele');
        window.history.replaceState({}, '', url);
    } catch (e) {
        // Un URL pe care browserul nu-l poate rescrie nu e motiv să pice filtrul.
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

    // Ordinea vine din `orase-cartiere.js`: cartierele orașului alfabetic, iar
    // comunele periurbane într-un grup separat la final („Ilfov"). Înainte,
    // bucla de aici mergea pe ordinea brută din fișier — geografică, dinspre
    // nord în sensul acelor de ceasornic — deci o zonă nu se putea găsi nici
    // după literă, nici scanând lista.
    appendCartiereOptions(DOM.filterCartier, oras);
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
        if (DOM.filterZoneleMele) DOM.filterZoneleMele.checked = false;
        scrieZoneleMeleInUrl(false);
        applyFilters();
    });
}

function updateActiveFilters() {
    const oras = DOM.filterOras.value;
    const cartier = DOM.filterCartier.value;
    const tags = [];

    if (oras) tags.push({ type: 'oras', label: oras });
    if (cartier) tags.push({ type: 'cartier', label: cartier });
    if (DOM.filterZoneleMele && DOM.filterZoneleMele.checked) {
        tags.push({ type: 'zonele_mele', label: 'Doar zonele mele' });
    }

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
    } else if (type === 'zonele_mele') {
        if (DOM.filterZoneleMele) DOM.filterZoneleMele.checked = false;
        scrieZoneleMeleInUrl(false);
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
    const doarZoneleMele = !!(DOM.filterZoneleMele && DOM.filterZoneleMele.checked);

    // Filter
    let filtered = allTerenuri.filter(t => {
        if (oras && t.oras !== oras) return false;
        if (cartier && t.cartier !== cartier) return false;
        // Se adună cu filtrele de deasupra, nu le înlocuiește: un oraș ales plus
        // bifa înseamnă „zonele mele din orașul acela".
        if (doarZoneleMele && !esteInZoneleMele(t)) return false;
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

    // Se pune la fiecare randare, nu doar când lista iese goală: altfel textul
    // despre zone ar rămâne agățat și l-ar vedea cine golește lista din alt
    // filtru, mult mai târziu, când bifa nu mai e nici măcar pusă.
    actualizeazaStareaGoala();

    // Atenționarea „dă clic pe un card" n-are ce căuta deasupra unei liste
    // goale: n-are pe ce da clic.
    if (DOM.resultsHint) {
        DOM.resultsHint.style.display = terenuri.length === 0 ? 'none' : '';
    }

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

    // Adresa spre analize.html, cu terenul dus mai departe. Aceiași doi
    // parametri ca redirectToAnalize() din teren-details.js — dacă acolo se
    // schimbă numele, se schimbă și aici, altfel formularul de comandă nu se
    // mai precompletează.
    const analizaParams = new URLSearchParams();
    if (teren.id) analizaParams.set('teren_id', teren.id);
    if (teren.titlu) analizaParams.set('teren_titlu', teren.titlu);
    const analizaQuery = analizaParams.toString();

    // Source link
    const sourceHtml = teren.link_sursa
        ? `<a href="${escapeHtml(teren.link_sursa)}" target="_blank" rel="noopener" class="teren-card-source">
             <i class="fas fa-external-link-alt"></i> Sursă
           </a>`
        : '';

    // Faptele terenului, strânse pe două rânduri în loc de patru cutii cu
    // etichete. Etichetele („SUPRAFAȚĂ", „PREȚ TOTAL") au ieșit fiindcă
    // unitatea le spune oricum: „240 mp" și „184.000 €" nu se pot confunda.
    // Cardul a scăzut cu vreo sută de puncte, ceea ce pe telefon înseamnă
    // aproape un ecran la fiecare trei terenuri.
    const fapteMari = [];
    if (teren.suprafata) {
        fapteMari.push(`<span class="teren-fact">${formatNumber(teren.suprafata)} mp</span>`);
    }
    if (teren.pret_total) {
        fapteMari.push(`<span class="teren-fact teren-fact-pret">${formatPrice(teren.pret_total)} €</span>`);
    }
    const fapteMariHtml = fapteMari.join('<span class="teren-fact-sep">·</span>');

    // Rândul mărunt: prețul pe mp, data și linkul către anunțul original.
    const fapteMici = [];
    if (pretMp !== null) fapteMici.push(`${formatNumber(pretMp)} €/mp`);
    if (dateStr) fapteMici.push(`adăugat ${dateStr}`);

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

            <!-- Inima, mutată peste poză. Înainte stătea într-un rând al ei
                 în josul cardului, împreună cu două butoane rotunde care
                 duceau la utilizatorii și grupurile interesate. Butoanele au
                 fost scoase (nu se înțelegeau pe telefon, iar aceleași două
                 drumuri există în pagina terenului), iar rândul întreg a
                 dispărut odată cu ele: încă vreo 58 de puncte pe card.
                 ⚠️ Învelișul .teren-likes trebuie păstrat: updateLikeCountDisplay
                 îl caută cu closest(). -->
            <div class="teren-likes">
                <button class="teren-likes-btn ${isLiked ? 'liked' : ''}"
                        data-teren-id="${teren.id}"
                        onclick="handleLike('${teren.id}')"
                        title="${isLiked ? 'Elimină din favorite' : 'Adaugă la profilul tău'}">
                    <i class="like-icon ${isLiked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="like-count-text">${likes}</span>
                </button>
            </div>
        </div>

        <!-- Body -->
        <div class="teren-card-body">
            <!-- Titlul e singurul link „adevărat" al cardului. Prin ::after
                 (vezi .teren-card-link din terenuri.css) el se întinde peste
                 tot cardul, deci clicul oriunde deschide terenul. Butoanele și
                 linkurile dinăuntru stau deasupra lui și își păstrează acțiunea.
                 Tot el e și ținta tastaturii: un onclick pus pe articol n-ar
                 fi fost accesibil cu Tab.
                 ⚠️ Fără apostrofuri inverse în comentariul ăsta: e înăuntrul
                 unui template string și l-ar închide la mijloc. -->
            <h3 class="teren-card-title">
                <a class="teren-card-link" href="teren-details.html?id=${teren.id}">${escapeHtml(teren.titlu || 'Teren fără titlu')}</a>
            </h3>
            <div class="teren-card-location">
                <i class="fas fa-map-marker-alt"></i>
                ${escapeHtml(location || 'Locație nespecificată')}
            </div>

            <!-- Faptele, pe două rânduri -->
            ${fapteMariHtml ? `<div class="teren-card-facts">${fapteMariHtml}</div>` : ''}
            <div class="teren-card-meta">
                <span>${fapteMici.join(' · ')}</span>
                ${sourceHtml}
            </div>
        </div>

        <!-- CTA de analiză (din machetă). Duce în același loc ca butonul
             „Cere o analiză" din pagina terenului: analize.html, cu terenul
             dus mai departe prin adresă (vezi redirectToAnalize din
             js/teren-details.js), ca formularul de comandă să vină
             precompletat. -->
        <a class="teren-card-cta" href="analize.html${analizaQuery ? '?' + analizaQuery : ''}">
            <span>Cere analiza preliminară <i class="fas fa-arrow-right"></i></span>
            <span class="teren-card-cta-pret">${PRET_ANALIZA}, TVA inclus</span>
        </a>

    </article>
    `;
}

// Când lista iese goală din cauza bifei, mesajul implicit („schimbă filtrele")
// nu ajută: omul n-a atins niciun dropdown. I se spune ce s-a întâmplat.
function actualizeazaStareaGoala() {
    if (!DOM.emptyStateTitle || !DOM.emptyStateText) return;

    if (DOM.filterZoneleMele && DOM.filterZoneleMele.checked) {
        DOM.emptyStateTitle.textContent = 'Niciun teren în zonele tale';
        DOM.emptyStateText.textContent =
            'Deocamdată nu e niciun teren în zonele bifate de tine în profil. ' +
            'Debifează filtrul ca să le vezi pe toate, sau adaugă zone noi în profil.';
    } else {
        DOM.emptyStateTitle.textContent = EMPTY_STATE_IMPLICIT.titlu;
        DOM.emptyStateText.textContent  = EMPTY_STATE_IMPLICIT.text;
    }
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

    if (countText) countText.textContent = count;

    // Eticheta „interesat / interesați" a dispărut odată cu rândul de jos al
    // cardului; a rămas doar cifra de lângă inimă. Titlul butonului spune ce
    // face apăsarea, iar numărul spune câți sunt.
    btn.title = userLikes.has(terenId) ? 'Elimină din favorite' : 'Adaugă la profilul tău';
}

// ══════════════════════════════════════════
//  VIEW INTERESTED USERS / GROUPS
// ══════════════════════════════════════════

// Cele două funcții care duceau la utilizatorii și la grupurile interesate de
// un teren (`viewInterestedUsers` / `viewInterestedGroups`) au fost scoase pe
// 14 august, odată cu butoanele rotunde de pe card. Aceleași două drumuri
// există în pagina terenului (`js/teren-details.js`, secțiunea „INTEREST
// COUNTS & NAVIGATION"), deci nu s-a pierdut nicio funcționalitate.


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
