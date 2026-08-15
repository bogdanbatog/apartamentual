// Statusurile reale din tabela `terenuri`, cu etichetele din admin
// (`admin-terenuri.html`): pending / approved / rejected.
//
// ⚠️ Reparat pe 15 august 2026. Lista de mai jos avea valori care nu există în
// bază („active", „under_review", „reserved", „sold", „inactive"), iar codul
// scria pe ecran valoarea brută când nu găsea potrivire. Practic, pe FIECARE
// pagină de teren public scria „approved", în engleză.
//
// „approved" nu se mai arată deloc: toate terenurile din listă sunt aprobate,
// deci un semn care spune același lucru peste tot nu spune nimic. Rămân doar
// stările care chiar înseamnă ceva pentru cine se uită: în așteptare, respins,
// dezactivat.
const statusMapping = {
    'pending':  { text: 'În așteptarea aprobării', class: 'bg-yellow-100 text-yellow-800' },
    'approved': null,
    'rejected': { text: 'Respins', class: 'bg-red-100 text-red-800' }
};

// Global state for group likes
let userGroups = [];
let terenGroupLikes = [];
let currentTerenId = null;
// Profilul celui logat, sau null. Îl ține minte fiindcă `renderGroupLikesSection`
// se apelează și după o apăsare pe „Adaugă", nu doar la încărcarea paginii, și
// trebuie să știe dacă omul e logat ca să aleagă starea potrivită a cardului.
let currentUserProfile = null;

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

// Poza principală: tăiată (`cover`) doar dacă e mai lată decât înaltă. La una
// în portret sau aproape pătrată, rama de 16/10 ar lăsa o fâșie din mijloc, iar
// dintr-o captură de ecran de telefon fâșia aia e adesea bandă neagră. Acelea se
// arată întregi, pe fundal crem.
//
// ⚠️ Se apelează după ce poza s-a încărcat: înainte de asta, naturalWidth e 0.
function potrivesteRama(imageEl) {
    if (!imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) return;
    const raport = imageEl.naturalWidth / imageEl.naturalHeight;
    imageEl.classList.toggle('is-inalta', raport < 1.3);
}

// Setează imaginea principală afișată + evidențiază miniatura activă.
function setMainImage(index) {
    if (index < 0 || index >= terenImages.length) return;
    currentImageIndex = index;
    const imageEl = document.getElementById('teren-image');
    if (imageEl) {
        imageEl.src = terenImages[index];
        // Dacă poza e deja în memoria browserului, evenimentul `load` nu mai
        // vine, deci se măsoară pe loc. Altfel o prinde ascultătorul legat la
        // pornirea paginii.
        if (imageEl.complete) potrivesteRama(imageEl);
    }
    document.querySelectorAll('#teren-thumbnails .td-thumb').forEach((el, i) => {
        el.classList.toggle('is-on', i === index);
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
        <img src="${url}" alt="Miniatură ${i + 1}" class="td-thumb" data-index="${i}">
    `).join('');

    thumbsContainer.querySelectorAll('.td-thumb').forEach(el => {
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
            .from('profiles_visible')
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

// Cardul „Adaugă-l la unul din grupurile tale".
//
// Titlul și explicația stau în HTML, iar de aici se scrie doar partea de jos
// (#group-likes-body), care are trei stări:
//   • nelogat            → îndemn la cont
//   • logat, fără grupuri → spune că nu e în niciun grup + duce la grupuri.html
//   • logat, cu grupuri   → lista lor, cu adăugare / scoatere
// ⚠️ Înainte, cardul întreg dispărea pentru primele două cazuri, deci tocmai
// omul care n-are încă niciun grup nu afla că treaba asta se poate face.
// Cardul se ascunde de tot doar pentru conturile de agenție (vezi
// displayTerenDetails), fiindcă ele nu pot fi în grupuri.
function renderGroupLikesSection() {
    const container = document.getElementById('group-likes-section');
    const body = document.getElementById('group-likes-body');
    if (!container || !body) return;

    // Conturile de agenție nu sunt membre în grupuri, deci cardul dispare de tot.
    // ⚠️ Ascunderea stă aici, nu în displayTerenDetails: funcția asta se apelează
    // și după fiecare apăsare pe „Adaugă", iar rândul de mai jos ar readuce
    // cardul la viață dacă ascunderea ar fi scrisă în altă parte.
    if (currentUserProfile && currentUserProfile.account_type === 'profesional') {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    // Nelogat: aceeași cale ca butonul „Intră în cont" din header (nav.js).
    if (!currentUserProfile) {
        body.innerHTML = `
            <p class="td-empty">Ai nevoie de cont ca să adaugi terenul într-un grup.</p>
            <button type="button" class="td-btn td-btn--ghost" id="btn-grup-likes-login">Intră în cont</button>
        `;
        const btnLogin = document.getElementById('btn-grup-likes-login');
        if (btnLogin) {
            btnLogin.addEventListener('click', function() {
                if (typeof openLoginModal === 'function') {
                    openLoginModal();
                } else {
                    window.location.href = '/index.html?login=1';
                }
            });
        }
        return;
    }

    // Logat, dar în niciun grup.
    if (userGroups.length === 0) {
        body.innerHTML = `
            <p class="td-empty">Nu ești încă în niciun grup. Poți intra într-unul existent sau poți face tu unul, pornind chiar de la terenul acesta.</p>
            <a href="grupuri.html" class="td-btn td-btn--ghost">Vezi grupurile</a>
        `;
        return;
    }

    const groupsHtml = userGroups.map(group => {
        const isLiked = terenGroupLikes.includes(group.id);
        return `
            <div class="td-mygroup${isLiked ? ' is-liked' : ''}">
                <span>${escapeHtml(group.nume)}</span>
                <button type="button" class="td-btn td-btn--ghost td-btn--sm" onclick="toggleGroupLike('${group.id}')">
                    ${isLiked ? 'Scoate' : 'Adaugă'}
                </button>
            </div>
        `;
    }).join('');

    body.innerHTML = `<div class="td-mygroups">${groupsHtml}</div>`;
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

// Inima de sub titlu: umplută când terenul e la favoritele omului.
// Textul stă într-un <span class="btn-like-text"> scris direct în HTML, deci nu
// se mai umblă la innerHTML (varianta veche înlocuia bucăți de text cu
// `replace`, iar dacă formularea din HTML se schimba, nu se mai potrivea nimic).
function updateLikeButton(btn, isLiked) {
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');

    btn.classList.toggle('is-liked', isLiked);

    const spanText = btn.querySelector('.btn-like-text');
    if (spanText) {
        spanText.textContent = isLiked ? 'Adăugat la profilul tău' : 'Adaugă la profilul tău';
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
        currentUserProfile = userProfile;

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
        // ⚠️ Ancora e linkul „Înapoi la terenuri", luat pe ID. Înainte se lua pe
        // `.mb-6`, o clasă Tailwind care poate ajunge pe orice element din
        // pagină: prima potrivire nu mai era neapărat linkul de întoarcere.
        const backButton = document.getElementById('td-back');
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
        
        const mainContent = document.querySelector('.td-top');
        if (mainContent) {
            mainContent.classList.add('opacity-75');
        }
    }

    // Basic information
    document.getElementById('teren-title').textContent = teren.titlu || 'Teren fără titlu';

    // Status. Un status necunoscut nu se mai scrie pe ecran: ar ieși o valoare
    // tehnică, în engleză, în fața vizitatorului.
    let status = Object.prototype.hasOwnProperty.call(statusMapping, teren.status)
        ? statusMapping[teren.status]
        : null;
    if (isDisabled) {
        status = { text: 'Dezactivat', class: 'bg-red-100 text-red-800' };
    }
    const statusEl = document.getElementById('teren-status');
    if (status) {
        statusEl.textContent = status.text;
        statusEl.className = `badge ${status.class}`;
    } else {
        statusEl.textContent = '';
        statusEl.className = 'badge hidden';
    }

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
    
    // Apartamente estimate: rândul apare DOAR dacă terenul are deja o analiză.
    // Înainte, când lipsea, în locul cifrei stătea un buton mic și negru „Cere o
    // analiză", fără o vorbă despre ce e aia, cât costă sau ce primești. Acum
    // cererea analizei o face cardul mare din blocul de acțiuni, care explică.
    const apartamenteEl = document.getElementById('teren-apartamente');
    const apartamenteFact = document.getElementById('teren-apartamente-fact');
    const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max
        ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}`
        : null;
    if (apartamenteRange && apartamenteEl && apartamenteFact) {
        apartamenteEl.textContent = apartamenteRange;
        apartamenteFact.classList.remove('hidden');
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
    
    // Inima („Adaugă la profilul tău"), doar pentru cine e logat.
    // Conturile de agenție n-o văd: terenurile lor apar oricum pe profil, ca
    // anunțuri proprii, nu ca favorite.
    const userActionBtns = document.getElementById('user-action-buttons');
    const btnLikeProfil = document.getElementById('btn-like-profil');
    if (userProfile && userActionBtns && userProfile.account_type !== 'profesional') {
        userActionBtns.classList.remove('hidden');
        if (btnLikeProfil) {
            btnLikeProfil.addEventListener('click', () => toggleTerenLike(teren.id));
            checkTerenLikeState(teren.id);
        }
    }

    // Cere o analiză button — redirect to /analize.html with teren context
    const btnCereAnaliza = document.getElementById('btn-cere-analiza');
    if (btnCereAnaliza) {
        btnCereAnaliza.addEventListener('click', () => redirectToAnalize(teren));
    }

    // „Fă un grup pe acest teren" — duce terenul mai departe prin URL.
    // Grupul se creează în grup-nou.html, iar terenul intră la favoritele lui
    // (`terenuri_likes_grupuri`), aceeași listă pe care o scrie butonul
    // „Adaugă la unul din grupurile tale" de mai jos.
    const blocGrupNou = document.getElementById('grup-nou-teren');
    const btnGrupNou = document.getElementById('btn-grup-nou-teren');
    if (btnGrupNou) {
        btnGrupNou.href = `grup-nou.html?teren=${encodeURIComponent(teren.id)}`;
    }
    if (blocGrupNou) {
        // Agențiile nu pot crea grupuri (grup-nou.html le refuză oricum), iar pe
        // un teren dezactivat n-are rost să pornească cineva un grup.
        const contDeAgentie = userProfile && userProfile.account_type === 'profesional';
        if (contDeAgentie || isDisabled) {
            blocGrupNou.classList.add('hidden');
        }
    }


    // Action buttons
    const actionButtons = document.getElementById('action-buttons');
    const hasPendingAnalysis = teren.analiza_generala_status === 'pending' || teren.analiza_specifica_status === 'pending';
    const canModify = userProfile && (
        (userProfile.user_id === teren.user_id && !teren.deleted_at) || 
        userProfile.is_super_admin
    );
    const canToggleStatus = userProfile && userProfile.is_super_admin;
    
    // ⚠️ `hasPendingAnalysis` nu mai deschide singur rândul. Nu punea niciun
    // buton în el, iar acum rândul are linie despărțitoare deasupra: s-ar fi
    // văzut o dungă orizontală fără nimic sub ea.
    if (canModify || canToggleStatus) {
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

    // ⚠️ Abia acum, nu mai sus: descrierea are nevoie să fie vizibilă ca să se
    // poată măsura dacă textul e mai lung decât cele trei rânduri.
    setupDescriere(teren.descriere);
}

// Descrierea din anunțul original, la subsolul paginii.
//
// Trei lucruri deodată:
//   • fără descriere, secțiunea nu se randează deloc (înainte scria „Fără
//     descriere disponibilă", adică un titlu și o propoziție de umplutură);
//   • textul e tăiat la trei rânduri;
//   • butonul „Citește mai mult" apare DOAR dacă textul chiar e mai lung.
// ⚠️ Măsurarea se face după ce browserul a așezat textul, într-un
// requestAnimationFrame. Citit imediat după `textContent = ...`, scrollHeight ar
// da valoarea de dinainte de așezare, iar la un anunț scurt ar apărea un buton
// care nu face nimic.
function setupDescriere(descriere) {
    const sectiune = document.getElementById('teren-descriere-section');
    const p = document.getElementById('teren-description');
    const btn = document.getElementById('btn-desc-more');
    if (!sectiune || !p || !btn) return;

    // Rândurile din anunț se păstrează (CSS: `white-space: pre-line`), dar
    // rândurile GOALE dintre ele se strâng. ⚠️ Altfel un rând gol mănâncă unul
    // din cele trei rânduri ale textului tăiat, iar cele trei puncte rămân
    // singure pe el, ca și cum pagina ar fi stricată.
    const text = (descriere || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim();
    if (!text) {
        sectiune.classList.add('hidden');
        return;
    }

    sectiune.classList.remove('hidden');
    p.textContent = text;
    p.classList.add('is-clamped');

    // ⚠️ Măsurarea se face DUPĂ ce blocul cu detalii a ieșit din `hidden`.
    // Într-un element cu `display: none`, scrollHeight și clientHeight sunt
    // amândouă 0, deci „textul nu e tăiat" ieșea mereu adevărat și butonul nu
    // apărea niciodată, oricât de lung ar fi fost anunțul. De aici și retrasul
    // de mai jos: dacă la prima încercare înălțimea e încă 0, mai așteaptă un
    // cadru.
    const masoara = (incercare) => {
        if (p.clientHeight === 0 && incercare < 5) {
            requestAnimationFrame(() => masoara(incercare + 1));
            return;
        }
        const eTaiat = p.scrollHeight > p.clientHeight + 2; // 2px, pentru rotunjiri
        btn.classList.toggle('hidden', !eTaiat);
        if (!eTaiat) p.classList.remove('is-clamped');
    };
    requestAnimationFrame(() => masoara(0));

    if (!btn.dataset.legat) {
        btn.dataset.legat = '1'; // ca la o a doua încărcare să nu se lege de două ori
        btn.addEventListener('click', () => {
            const desfacut = !p.classList.toggle('is-clamped');
            btn.textContent = desfacut ? 'Citește mai puțin' : 'Citește mai mult';
            btn.setAttribute('aria-expanded', String(desfacut));
        });
    }
}

// Update action buttons
function updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, teren) {
    const actionButtons = document.getElementById('action-buttons');
    actionButtons.innerHTML = '';

    // Rândul e la subsolul paginii și îl vede foarte puțină lume (autorul
    // terenului și superadminul), deci butoanele sunt discrete, nu colorate.
    if (canModify || canToggleStatus) {
        const eticheta = document.createElement('span');
        eticheta.className = 'td-admin-label';
        eticheta.textContent = 'Administrare';
        actionButtons.appendChild(eticheta);
    }

    // Add "Modifica" button if user can modify
    if (canModify) {
        const modificaBtn = document.createElement('button');
        modificaBtn.type = 'button';
        modificaBtn.className = 'td-btn td-btn--ghost td-btn--sm';
        modificaBtn.textContent = 'Modifică';
        modificaBtn.onclick = () => editTeren(teren.id);
        actionButtons.appendChild(modificaBtn);
    }

    // Add "Dezactivează/Activează" button if user is super admin
    if (canToggleStatus) {
        const toggleBtn = document.createElement('button');
        const isDeleted = teren.deleted_at !== null;
        toggleBtn.type = 'button';
        toggleBtn.className = 'td-btn td-btn--ghost td-btn--sm';
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

    // Fiecare poză nouă pusă în ramă se măsoară din nou: în aceeași galerie pot
    // sta o fotografie orizontală și un plan cadastral vertical.
    const imageEl = document.getElementById('teren-image');
    if (imageEl) {
        imageEl.addEventListener('load', () => potrivesteRama(imageEl));
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
        
        // Cele două carduri de interes, fiecare celulă în grila de acțiuni.
        // Erau un singur bloc cu două butoane; acum sunt carduri separate, deci
        // se descoperă amândouă, nu unul singur.
        const cardUsers = document.getElementById('card-interested-users');
        const cardGroups = document.getElementById('card-interested-groups');
        const usersCountEl = document.getElementById('interested-users-count');
        const groupsCountEl = document.getElementById('interested-groups-count');

        if (cardUsers) cardUsers.classList.remove('hidden');
        if (cardGroups) cardGroups.classList.remove('hidden');
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
