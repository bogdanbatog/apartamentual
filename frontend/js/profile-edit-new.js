// Profile Edit Page - New Version
// ApartamenTUal Platform

let profileData = null;
let currentUser = null;
let cities = [];
let zones = [];
let tags = [];
let selectedTags = [];
let selectedZones = [];

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initEditPage();
});

async function initEditPage() {
    try {
        // Check authentication.
        // ATENȚIE: aici aterizează omul după ce dă click pe „confirmă emailul"
        // (register.js trimite linkul spre /profile-edit-new.html?welcome=1).
        // Înainte, dacă nu exista sesiune, pagina făcea redirect MUT către
        // homepage — omul rămânea cu profilul gol fără să înțeleagă de ce.
        // Acum așteptăm sesiunea și, dacă tot nu vine, explicăm ce s-a întâmplat.
        const user = await resolveUserOnArrival();

        if (!user) {
            renderArrivalProblem();
            return;
        }

        currentUser = user;
        
        // Get profile ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        const isWelcome = urlParams.get('welcome') === '1';
        
        // Verify user is editing their own profile (skip in welcome flow)
        if (!isWelcome && profileId && profileId !== user.id) {
            window.location.href = '/profile-view-new.html?id=' + user.id;
            return;
        }
        
        // Setup back link
        document.getElementById('back-link').href = '/profile-view-new.html?id=' + user.id;
        document.getElementById('cancel-btn').href = '/profile-view-new.html?id=' + user.id;
        const cancelBtnPro = document.getElementById('cancel-btn-pro');
        if (cancelBtnPro) cancelBtnPro.href = '/profile-view-new.html?id=' + user.id;
        
        // Load data
        await loadCities();
        await loadTags();
        await loadProfile(user.id);
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Init error:', error);
        alert('A apărut o eroare la încărcarea paginii');
    }
}

// =====================================================
// ATERIZARE DIN LINKUL DE CONFIRMARE A EMAILULUI
// =====================================================
// Linkul din emailul de confirmare aduce tokenul în hash-ul URL-ului, iar
// SDK-ul Supabase îl consumă ASINCRON. Un getUser() apelat imediat poate
// întoarce null chiar și pentru un link perfect valid. În plus, linkul poate
// fi deja consumat (scanere de email / al doilea click) sau expirat — caz în
// care Supabase ne trimite înapoi cu #error=... în URL.

// Are URL-ul un „bagaj" de autentificare (token sau eroare) de la Supabase?
function hasAuthPayloadInUrl() {
    const blob = (window.location.hash || '') + (window.location.search || '');
    return /access_token=|refresh_token=|error_code=|[?&#]error=|[?&]code=/.test(blob);
}

// Citește eroarea pe care o pune Supabase în URL când linkul nu mai e valid.
function getAuthErrorFromUrl() {
    const fromHash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const fromQuery = new URLSearchParams(window.location.search || '');
    const code = fromHash.get('error_code') || fromQuery.get('error_code');
    const err = fromHash.get('error') || fromQuery.get('error');
    if (!code && !err) return null;
    return { error: err, code: code };
}

// Întoarce utilizatorul dacă există sesiune. Dacă venim dintr-un link de email,
// mai așteptăm până la 2 secunde evenimentul de autentificare, în loc să
// decidem din prima că omul nu e logat.
async function resolveUserOnArrival() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;

    // getUser() întreabă serverul. La un semnal prost poate întoarce null deși
    // omul E logat — verificăm și sesiunea locală înainte să-l declarăm nelogat,
    // ca să nu-i cerem degeaba autentificare cuiva care are deja cont deschis.
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) return session.user;

    const isWelcome = new URLSearchParams(window.location.search).get('welcome') === '1';
    if (!isWelcome && !hasAuthPayloadInUrl()) return null;   // navigare normală, fără sesiune
    if (getAuthErrorFromUrl()) return null;                   // Supabase ne-a spus deja că linkul e mort

    return await new Promise((resolve) => {
        let settled = false;
        let subscription = null;
        let timer = null;
        const finish = (u) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { if (subscription) subscription.unsubscribe(); } catch (e) {}
            resolve(u || null);
        };

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) finish(session.user);
        });
        subscription = data && data.subscription;

        // Plasă de siguranță: dacă evenimentul nu vine, mai verificăm o dată.
        timer = setTimeout(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                finish(session && session.user);
            } catch (e) {
                finish(null);
            }
        }, 2000);
    });
}

// În loc de redirect mut către homepage: explicăm ce s-a întâmplat și dăm
// omului cele două ieșiri utile — retrimiterea emailului sau autentificarea.
function renderArrivalProblem() {
    const isWelcome = new URLSearchParams(window.location.search).get('welcome') === '1';
    const authError = getAuthErrorFromUrl();
    const cameFromEmail = isWelcome || !!authError || hasAuthPayloadInUrl();

    // Semnalăm în Plausible că cineva s-a pierdut exact aici (dacă e configurat).
    try {
        if (typeof plausible === 'function') {
            plausible(cameFromEmail ? 'Confirmare link esuat' : 'Profil fara sesiune');
        }
    } catch (e) {}

    const container = document.querySelector('main .container') || document.body;
    Array.from(container.children).forEach(el => { el.style.display = 'none'; });

    const card = document.createElement('div');
    card.id = 'arrival-problem';
    card.className = 'bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm';

    if (!cameFromEmail) {
        // Cineva a deschis direct pagina de editare, fără să fie logat.
        card.innerHTML = `
            <h1 class="text-xl font-semibold mb-2">Trebuie să fii autentificat</h1>
            <p class="text-gray-600 mb-6">Ca să-ți editezi profilul, conectează-te la contul tău.</p>
            <div class="flex flex-wrap gap-3">
                <button type="button" id="arrival-login" class="bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-black transition font-medium">Autentifică-te</button>
                <a href="/index.html" class="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition">Mergi pe pagina principală</a>
            </div>`;
    } else {
        card.innerHTML = `
            <h1 class="text-xl font-semibold mb-2">Linkul de confirmare nu a mai funcționat</h1>
            <p class="text-gray-600 mb-4">
                Contul tău există, dar linkul din email fie a expirat, fie fusese deja folosit.
                Se întâmplă des: unele servicii de email deschid automat linkurile din mesaje,
                înainte să apuci tu să dai click.
            </p>
            <p class="text-gray-600 mb-6">
                Îți trimitem altul acum — apoi te întorci aici și îți completezi profilul,
                ca să te poată găsi vecinii și grupurile potrivite.
            </p>
            <label for="arrival-email" class="block text-sm font-medium text-gray-700 mb-1">Adresa ta de email</label>
            <input type="email" id="arrival-email" autocomplete="email" placeholder="nume@exemplu.ro"
                   class="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900">
            <div class="flex flex-wrap gap-3">
                <button type="button" id="arrival-resend" class="bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-black transition font-medium">Trimite-mi din nou emailul</button>
                <button type="button" id="arrival-login" class="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition">Am confirmat deja — autentifică-mă</button>
            </div>
            <p id="arrival-msg" class="hidden mt-4 text-sm"></p>`;
    }

    container.appendChild(card);

    const btnLogin = document.getElementById('arrival-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (typeof window.openLoginModal === 'function') window.openLoginModal();
            else window.location.href = '/index.html?login=1';
        });
    }

    const btnResend = document.getElementById('arrival-resend');
    if (btnResend) btnResend.addEventListener('click', resendConfirmationFromArrival);
}

async function resendConfirmationFromArrival() {
    const input = document.getElementById('arrival-email');
    const btn = document.getElementById('arrival-resend');
    const msg = document.getElementById('arrival-msg');
    const email = (input && input.value || '').trim();

    const show = (text, ok) => {
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'mt-4 text-sm ' + (ok ? 'text-green-700' : 'text-red-600');
        msg.classList.remove('hidden');
    };

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        show('Scrie adresa de email cu care ți-ai făcut contul.', false);
        return;
    }

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Se trimite...';

    try {
        await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: { emailRedirectTo: `${window.location.origin}/profile-edit-new.html?welcome=1` }
        });
        // Mesaj generic indiferent de rezultat — nu confirmăm public dacă
        // adresa există în platformă (același principiu ca la resetarea parolei).
        show('Gata. Dacă adresa are un cont neconfirmat, ți-am trimis un link nou. Verifică inbox-ul și folderele Spam/Promoții.', true);
    } catch (e) {
        console.error('Resend confirmation error:', e);
        show('Nu am putut trimite emailul acum. Încearcă din nou în câteva minute sau scrie-ne la office@ltfbstudio.ro.', false);
    } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
    }
}

// =====================================================
// DATA LOADING
// =====================================================

async function loadCities() {
    try {
        const { data, error } = await supabase
            .from('cities')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        cities = data || [];
        
        const citySelect = document.getElementById('preferred_city');
        if (citySelect) {
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                citySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

async function loadZonesForCity(cityId) {
    try {
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .eq('city_id', cityId)
            .order('display_order');
        
        if (error) throw error;
        zones = data || [];
        renderZones();
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

async function loadTags() {
    try {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('category, name');
        
        if (error) throw error;
        tags = data || [];
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

async function loadProfile(userId) {
    try {
        // Load profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) throw error;
        profileData = profile;
        
        // Load user tags
        const { data: userTags } = await supabase
            .from('user_tags')
            .select('tag_id')
            .eq('user_id', userId);
        
        selectedTags = userTags?.map(ut => ut.tag_id) || [];
        
        // Load user zones
        const { data: userZones } = await supabase
            .from('user_preferred_zones')
            .select('zone_id')
            .eq('user_id', userId);
        
        selectedZones = userZones?.map(uz => uz.zone_id) || [];
        
        // Hide loading, show form
        document.getElementById('loading-state').classList.add('hidden');
        
        // Welcome flow: trust user metadata for account_type to avoid showing wrong form
        const isWelcomeFlow = new URLSearchParams(window.location.search).get('welcome') === '1';
        let effectiveType = profile.account_type;
        if (isWelcomeFlow) {
            const metaType = currentUser.user_metadata?.account_type;
            if (metaType) effectiveType = metaType;
        }
        
        if (effectiveType === 'activ') {
            document.getElementById('edit-form-activ').classList.remove('hidden');
            populateActiveForm();
        } else {
            document.getElementById('edit-form-profesional').classList.remove('hidden');
            populateProfessionalForm();
        }
        
        updateProgressBadge();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Nu am putut încărca profilul');
    }
}

// =====================================================
// FORM POPULATION
// =====================================================

function populateActiveForm() {
    // Basic info
    document.getElementById('pseudonym').value = profileData.pseudonym || '';
    document.getElementById('profession').value = profileData.profession || '';
    document.getElementById('phone').value = profileData.phone || '';
    document.getElementById('age').value = profileData.age || '';
    document.getElementById('is_email_public').checked = profileData.is_email_public || false;
    document.getElementById('is_age_public').checked = profileData.is_age_public || false;
    
    // Preferences
    document.getElementById('preferred_rooms').value = profileData.preferred_rooms || '';
    document.getElementById('preferred_area_sqm').value = profileData.preferred_area_sqm || '';
    document.getElementById('preferred_city').value = profileData.preferred_city_id || '';
    
    // Description
    document.getElementById('description').value = profileData.description || '';
    
    // Load zones if city is selected
    if (profileData.preferred_city_id) {
        loadZonesForCity(profileData.preferred_city_id);
    }
    
    // Render tags
    renderTags();
}

function populateProfessionalForm() {
    document.getElementById('agency_name').value = profileData.agency_name || '';
    document.getElementById('agency_website').value = profileData.agency_website || '';
    document.getElementById('agency_description').value = profileData.agency_description || '';
}

// =====================================================
// UI RENDERING
// =====================================================

function renderZones() {
    const container = document.getElementById('zones-container');
    if (!container) return;
    
    if (zones.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">Nu există zone pentru acest oraș</p>';
        return;
    }
    
    container.innerHTML = zones.map(zone => `
        <label class="inline-flex items-center gap-2 mr-4 mb-2 cursor-pointer">
            <input type="checkbox" 
                   class="zone-checkbox rounded border-gray-300" 
                   value="${zone.id}" 
                   ${selectedZones.includes(zone.id) ? 'checked' : ''}
                   onchange="toggleZone(${zone.id})">
            <span class="text-sm">${zone.name}</span>
        </label>
    `).join('');
}

function renderTags() {
    const container = document.getElementById('tags-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex flex-wrap gap-2">
            ${tags.map(tag => `
                <button type="button"
                        class="tag-button px-3 py-1.5 rounded-full text-sm border transition
                               ${selectedTags.includes(tag.id) 
                                   ? 'bg-gray-900 text-white border-gray-900' 
                                   : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}"
                        data-tag-id="${tag.id}"
                        onclick="toggleTag(${tag.id})">
                    ${tag.name}
                </button>
            `).join('')}
        </div>
    `;
    
    updateTagsCounter();
}

function updateTagsCounter() {
    const counter = document.getElementById('tags-counter');
    if (counter) {
        counter.textContent = `${selectedTags.length} din 15 selectate`;
        counter.className = selectedTags.length >= 15 ? 'text-sm text-orange-600 font-medium mt-3' : 'text-sm text-gray-500 mt-3';
    }
}

function updateProgressBadge() {
    const badge = document.getElementById('progress-badge');
    if (!badge) return;
    
    let completion = 0;
    
    if (profileData.account_type === 'activ') {
        const fields = [
            profileData.pseudonym,
            profileData.profession,
            profileData.phone,
            profileData.age,
            profileData.preferred_rooms,
            profileData.preferred_area_sqm,
            profileData.preferred_city_id,
            selectedZones.length > 0,
            selectedTags.length > 0,
            profileData.description
        ];
        const filled = fields.filter(f => f).length;
        completion = Math.round((filled / fields.length) * 100);
    } else {
        const fields = [
            profileData.agency_name,
            profileData.agency_website,
            profileData.agency_description
        ];
        const filled = fields.filter(f => f).length;
        completion = Math.round((filled / fields.length) * 100);
    }
    
    badge.textContent = completion + '% completat';
    
    if (completion < 50) {
        badge.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm';
    } else if (completion < 80) {
        badge.className = 'px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm';
    } else {
        badge.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm';
    }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

function setupEventListeners() {
    // City change
    const citySelect = document.getElementById('preferred_city');
    if (citySelect) {
        citySelect.addEventListener('change', (e) => {
            const cityId = parseInt(e.target.value);
            selectedZones = [];
            if (cityId) {
                loadZonesForCity(cityId);
            } else {
                zones = [];
                const container = document.getElementById('zones-container');
                if (container) {
                    container.innerHTML = '<p class="text-sm text-gray-500">Selectează mai întâi un oraș</p>';
                }
            }
        });
    }
    
    // Active form submit
    const activeForm = document.getElementById('edit-form-activ');
    if (activeForm) {
        activeForm.addEventListener('submit', handleActiveFormSubmit);
    }
    
    // Professional form submit
    const proForm = document.getElementById('edit-form-profesional');
    if (proForm) {
        proForm.addEventListener('submit', handleProfessionalFormSubmit);
    }
}

function toggleZone(zoneId) {
    const index = selectedZones.indexOf(zoneId);
    if (index > -1) {
        selectedZones.splice(index, 1);
    } else {
        selectedZones.push(zoneId);
    }
    updateProgressBadge();
}

function toggleTag(tagId) {
    const index = selectedTags.indexOf(tagId);
    
    if (index > -1) {
        selectedTags.splice(index, 1);
    } else {
        if (selectedTags.length >= 15) {
            alert('Poți selecta maxim 15 tag-uri');
            return;
        }
        selectedTags.push(tagId);
    }
    
    // Update button style
    const button = document.querySelector(`[data-tag-id="${tagId}"]`);
    if (button) {
        if (selectedTags.includes(tagId)) {
            button.className = 'tag-button px-3 py-1.5 rounded-full text-sm border transition bg-gray-900 text-white border-gray-900';
        } else {
            button.className = 'tag-button px-3 py-1.5 rounded-full text-sm border transition bg-white text-gray-700 border-gray-300 hover:border-gray-500';
        }
    }
    
    updateTagsCounter();
    updateProgressBadge();
}

// =====================================================
// FORM SUBMISSION
// =====================================================

async function handleActiveFormSubmit(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('form-error');
    const successDiv = document.getElementById('form-success');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    // Validate
    if (selectedZones.length === 0) {
        showError(errorDiv, 'Te rugăm să selectezi cel puțin o zonă preferată');
        return;
    }
    
    if (selectedTags.length === 0) {
        showError(errorDiv, 'Te rugăm să selectezi cel puțin un tag de interes');
        return;
    }
    
    try {
        // Update profile
        const formData = {
            pseudonym: document.getElementById('pseudonym').value,
            profession: document.getElementById('profession').value,
            phone: document.getElementById('phone').value,
            age: parseInt(document.getElementById('age').value),
            is_email_public: document.getElementById('is_email_public').checked,
            is_age_public: document.getElementById('is_age_public').checked,
            preferred_rooms: document.getElementById('preferred_rooms').value,
            preferred_area_sqm: parseInt(document.getElementById('preferred_area_sqm').value),
            preferred_city_id: parseInt(document.getElementById('preferred_city').value),
            description: document.getElementById('description').value || null
        };
        
        const { error: profileError } = await supabase
            .from('profiles')
            .update(formData)
            .eq('user_id', currentUser.id);
        
        if (profileError) throw profileError;
        
        // Update tags - delete existing, insert new
        await supabase.from('user_tags').delete().eq('user_id', currentUser.id);
        
        if (selectedTags.length > 0) {
            const tagInserts = selectedTags.map(tagId => ({
                user_id: currentUser.id,
                tag_id: tagId
            }));
            
            const { error: tagsError } = await supabase.from('user_tags').insert(tagInserts);
            if (tagsError) throw tagsError;
        }
        
        // Update zones - delete existing, insert new
        await supabase.from('user_preferred_zones').delete().eq('user_id', currentUser.id);
        
        if (selectedZones.length > 0) {
            const zoneInserts = selectedZones.map(zoneId => ({
                user_id: currentUser.id,
                zone_id: zoneId
            }));
            
            const { error: zonesError } = await supabase.from('user_preferred_zones').insert(zoneInserts);
            if (zonesError) throw zonesError;
        }
        
        // Update local data for progress badge
        profileData = { ...profileData, ...formData };
        updateProgressBadge();
        
        // If this save happened as part of the welcome flow (first profile
        // completion right after email confirmation), notify the superadmin.
        // We detect it from the URL `?welcome=1` parameter which the register
        // flow includes in the email confirmation link. It stays in the URL
        // throughout the edit session, so checking it here is reliable —
        // no timing dependencies, no sessionStorage flags to get out of sync.
        const isWelcomeSave = new URLSearchParams(window.location.search).get('welcome') === '1';
        if (isWelcomeSave) {
            try {
                if (typeof notifyAdmins === 'function') {
                    notifyAdmins('new_user', {
                        email: currentUser.email,
                        user_id: currentUser.id,
                        account_type: 'activ'
                    });
                }
            } catch(e) { console.warn('Active user notify failed:', e); }
        }
        
        // Show success
        successDiv.classList.remove('hidden');
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Redirect after delay - check welcome flow
        setTimeout(() => {
            const isWelcome = new URLSearchParams(window.location.search).get('welcome') === '1';
            window.location.href = isWelcome ? '/index.html' : '/profile-view-new.html?id=' + currentUser.id;
        }, 1500);
        
    } catch (error) {
        showError(errorDiv, 'A apărut o eroare: ' + error.message);
        console.error('Save error:', error);
    }
}

async function handleProfessionalFormSubmit(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('form-error-pro');
    const successDiv = document.getElementById('form-success-pro');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    try {
        let websiteValue = document.getElementById('agency_website').value.trim();
        if (websiteValue && !/^https?:\/\//i.test(websiteValue)) {
            websiteValue = 'https://' + websiteValue;
        }
        const formData = {
            agency_name: document.getElementById('agency_name').value,
            agency_website: websiteValue,
            agency_description: document.getElementById('agency_description').value || null
        };
        
        const { error } = await supabase
            .from('profiles')
            .update(formData)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Update local data
        profileData = { ...profileData, ...formData };
        updateProgressBadge();
        
        // If this save happened as part of the welcome flow (first profile
        // completion for an agency), notify the superadmin so they can review
        // and approve the agency. See the active-user branch above for the
        // rationale behind using the URL parameter instead of sessionStorage.
        const isWelcomeSaveAgency = new URLSearchParams(window.location.search).get('welcome') === '1';
        if (isWelcomeSaveAgency) {
            try {
                if (typeof notifyAdmins === 'function') {
                    notifyAdmins('new_user', {
                        email: currentUser.email,
                        user_id: currentUser.id,
                        account_type: 'profesional',
                        agency_name: formData.agency_name,
                        agency_website: formData.agency_website
                    });
                }
            } catch(e) { console.warn('Agency notify failed:', e); }
        }
        
        // Show success
        successDiv.classList.remove('hidden');
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Redirect - check welcome flow
        setTimeout(() => {
            const isWelcome = new URLSearchParams(window.location.search).get('welcome') === '1';
            window.location.href = isWelcome ? '/index.html' : '/profile-view-new.html?id=' + currentUser.id;
        }, 1500);
        
    } catch (error) {
        showError(errorDiv, 'A apărut o eroare: ' + error.message);
        console.error('Save error:', error);
    }
}

// =====================================================
// HELPERS
// =====================================================

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
