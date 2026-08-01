// Terrain form v2 - cu orașe/cartiere, preț total, link sursă, status pending
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('terrain-form');
    const formContainer = document.getElementById('form-container');
    const authRequired = document.getElementById('auth-required');
    const submitBtn = document.getElementById('submit-btn');
    const loadingEl = document.getElementById('form-loading');
    const errorEl = document.getElementById('form-error');
    const successEl = document.getElementById('form-success');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    if (!form) return;

    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const editTerenId = urlParams.get('edit');
    const isEditMode = !!editTerenId;
    let currentTerrain = null;
    let isSuperAdmin = false;

    // === DROPDOWN-URI ORAȘ / CARTIER ===
    const orasSelect = document.getElementById('oras');
    const cartierSelect = document.getElementById('cartier');

    // Populează dropdown-ul de orașe
    if (orasSelect && typeof populateOrasSelect === 'function') {
        populateOrasSelect(orasSelect);
    }

    // Când se schimbă orașul, populează cartierele
    if (orasSelect && cartierSelect) {
        orasSelect.addEventListener('change', function() {
            const selectedOras = this.value;
            if (selectedOras) {
                cartierSelect.disabled = false;
                populateCartierSelect(cartierSelect, selectedOras);
            } else {
                cartierSelect.disabled = true;
                cartierSelect.innerHTML = '<option value="">Alege mai întâi orașul</option>';
            }
        });
    }

    // === CALCUL AUTOMAT PREȚ/MP ===
    const suprafataInput = document.getElementById('suprafata');
    const pretTotalInput = document.getElementById('pret_total');
    const pretMpDisplay = document.getElementById('pret-mp-display');
    const pretMpCalculat = document.getElementById('pret-mp-calculat');

    function calculeazaPretMp() {
        const suprafata = parseFloat(suprafataInput?.value);
        const pretTotal = parseFloat(pretTotalInput?.value);

        if (suprafata > 0 && pretTotal > 0) {
            const pretMp = (pretTotal / suprafata).toFixed(2);
            pretMpCalculat.textContent = pretMp;
            pretMpDisplay.classList.remove('hidden');
        } else {
            pretMpDisplay.classList.add('hidden');
        }
    }

    if (suprafataInput) suprafataInput.addEventListener('input', calculeazaPretMp);
    if (pretTotalInput) pretTotalInput.addEventListener('input', calculeazaPretMp);

    // === GESTIONARE IMAGINI (multi-photo) ===
    // Array-ul imageItems conține obiecte de 2 tipuri:
    //   { kind: 'existing', url: 'https://...' }  → imagine deja salvată în DB
    //   { kind: 'new', file: File, previewUrl: 'blob:...' }  → fișier nou selectat
    // Ordinea în array = ordinea care se va salva în image_urls.
    const MAX_IMAGES = 6;
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    let imageItems = [];
    
    const pozaInput = document.getElementById('poza');
    const previewsContainer = document.getElementById('image-previews');
    const counterEl = document.getElementById('image-counter');

    function renderImagePreviews() {
        if (!previewsContainer) return;
        previewsContainer.innerHTML = '';
        
        if (imageItems.length === 0) {
            previewsContainer.classList.add('hidden');
            if (counterEl) counterEl.classList.add('hidden');
            return;
        }
        
        previewsContainer.classList.remove('hidden');
        
        imageItems.forEach((item, index) => {
            const src = item.kind === 'existing' ? item.url : item.previewUrl;
            const card = document.createElement('div');
            card.className = 'relative group';
            card.innerHTML = `
                <img src="${src}" alt="Imagine ${index + 1}" class="w-full h-32 object-cover rounded-md border">
                ${index === 0 ? '<span class="absolute top-1 left-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded">Principală</span>' : ''}
                <button type="button" data-index="${index}" class="remove-image-btn absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-md" title="Șterge">×</button>
            `;
            previewsContainer.appendChild(card);
        });
        
        // Attach remove handlers
        previewsContainer.querySelectorAll('.remove-image-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                const removed = imageItems[idx];
                if (removed && removed.kind === 'new' && removed.previewUrl) {
                    URL.revokeObjectURL(removed.previewUrl);
                }
                imageItems.splice(idx, 1);
                renderImagePreviews();
            });
        });
        
        if (counterEl) {
            counterEl.textContent = `${imageItems.length} / ${MAX_IMAGES} imagini`;
            counterEl.classList.remove('hidden');
        }
    }

    function addFilesToBasket(fileList) {
        const errors = [];
        for (const file of fileList) {
            if (imageItems.length >= MAX_IMAGES) {
                errors.push(`Maxim ${MAX_IMAGES} imagini permise. "${file.name}" nu a fost adăugat.`);
                break;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                errors.push(`"${file.name}" are un format neacceptat.`);
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                errors.push(`"${file.name}" depășește 5MB.`);
                continue;
            }
            imageItems.push({
                kind: 'new',
                file: file,
                previewUrl: URL.createObjectURL(file)
            });
        }
        renderImagePreviews();
        if (errors.length > 0) {
            alert(errors.join('\n'));
        }
    }

    if (pozaInput) {
        pozaInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                addFilesToBasket(this.files);
                // Reset input so selecting the same file again still fires change
                this.value = '';
            }
        });
    }

    // === VERIFICARE AUTENTIFICARE ===
    async function checkAuthAndSetup() {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                // Nu e autentificat
                formContainer.classList.add('hidden');
                authRequired.classList.remove('hidden');
                
                // Buton de login
                const loginBtn = document.getElementById('auth-required-login');
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        if (window.openLoginModal) window.openLoginModal();
                        else window.location.href = '/register.html';
                    });
                }
                return;
            }

            // E autentificat - verifică dacă e agenție pending
            try {
                const { data: profCheck } = await supabase
                    .from('profiles')
                    .select('account_type, account_status')
                    .eq('user_id', user.id)
                    .single();
                
                if (profCheck && profCheck.account_type === 'profesional' && profCheck.account_status === 'pending') {
                    // Agenție pending - blochează propunerea
                    formContainer.classList.add('hidden');
                    authRequired.classList.add('hidden');
                    
                    // Afișează mesaj de blocare
                    const main = document.querySelector('main') || document.body;
                    const blockDiv = document.createElement('div');
                    blockDiv.className = 'card text-center py-12';
                    blockDiv.innerHTML = `
                        <div style="width: 80px; height: 80px; margin: 0 auto 1.5rem; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <svg width="40" height="40" fill="none" stroke="#f97316" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <h2 class="text-xl font-bold mb-3">Cont în așteptare aprobare</h2>
                        <p class="text-gray-600 mb-2" style="max-width: 500px; margin-left: auto; margin-right: auto;">
                            Contul tău de agenție este în curs de verificare de către un administrator. 
                            Vei putea propune terenuri imediat ce contul va fi aprobat.
                        </p>
                        <p class="text-sm text-gray-500 mt-4">
                            Vei primi un email de confirmare când contul tău va fi activat.
                        </p>
                        <a href="/index.html" class="mt-6 inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                            ← Înapoi la pagina principală
                        </a>
                    `;
                    main.appendChild(blockDiv);
                    return;
                }
            } catch(e) { console.warn('Status check failed:', e); }
            
            // E autentificat - arată formularul
            formContainer.classList.remove('hidden');
            authRequired.classList.add('hidden');

            // Verifică dacă e super admin
            const { data: profile } = await supabase
                .from('profiles_visible')
                .select('is_super_admin')
                .eq('user_id', user.id)
                .single();

            isSuperAdmin = profile?.is_super_admin || false;

            // Arată secțiunile de admin
            if (isSuperAdmin) {
                const analysisSection = document.getElementById('analysis-section');
                if (analysisSection) analysisSection.classList.remove('hidden');
            }

            // Dacă e edit mode, încarcă datele
            if (isEditMode) {
                await loadTerrainData(editTerenId, user.id);
            }

        } catch (error) {
            console.error('Error checking auth:', error);
        }
    }

    // === ÎNCĂRCARE DATE PENTRU EDITARE ===
    async function loadTerrainData(terenId, userId) {
        try {
            showLoading();

            const { data: teren, error } = await supabase
                .from('terenuri')
                .select('*')
                .eq('id', terenId)
                .single();

            if (error || !teren) {
                throw new Error('Terenul nu a fost găsit');
            }

            // Verifică permisiuni
            const { data: profile } = await supabase
                .from('profiles_visible')
                .select('*')
                .eq('user_id', userId)
                .single();

            const canEdit = profile && (
                profile.user_id === teren.created_by_user_id || 
                profile.is_super_admin
            );

            if (!canEdit) {
                throw new Error('Nu ai permisiunea să editezi acest teren');
            }

            currentTerrain = teren;
            populateForm(teren);
            updateUIForEditMode();
            hideLoading();

        } catch (error) {
            console.error('Error loading terrain:', error);
            showError(error.message);
        }
    }

    // === POPULARE FORMULAR (edit mode) ===
    function populateForm(teren) {
        document.getElementById('titlu').value = teren.titlu || '';
        document.getElementById('descriere').value = teren.descriere || '';
        document.getElementById('link_sursa').value = teren.link_sursa || '';
        document.getElementById('suprafata').value = teren.suprafata || '';
        document.getElementById('pret_total').value = teren.pret_total || '';

        // Oraș + cartier
        if (teren.oras && orasSelect) {
            orasSelect.value = teren.oras;
            // Trigger change pentru a popula cartierele
            orasSelect.dispatchEvent(new Event('change'));
            // Setează cartierul după ce se populează lista
            setTimeout(() => {
                if (teren.cartier && cartierSelect) {
                    cartierSelect.value = teren.cartier;
                }
            }, 50);
        }
        // Fallback: dacă nu are oras/cartier dar are zona veche
        if (!teren.oras && teren.zona) {
            // Încearcă să detecteze orașul din zona veche
            const zonaLower = (teren.zona || '').toLowerCase();
            if (zonaLower.includes('bucurești') || zonaLower.includes('sector')) {
                orasSelect.value = 'București';
                orasSelect.dispatchEvent(new Event('change'));
            }
        }

        // Calculează preț/mp
        calculeazaPretMp();

        // Imagini existente (la edit) — populate basket. Prefer image_urls (new),
        // fall back to image_url (legacy single photo).
        if (teren.image_urls && Array.isArray(teren.image_urls) && teren.image_urls.length > 0) {
            imageItems = teren.image_urls.map(url => ({ kind: 'existing', url: url }));
        } else if (teren.image_url) {
            imageItems = [{ kind: 'existing', url: teren.image_url }];
        } else {
            imageItems = [];
        }
        renderImagePreviews();

        // Analiza (admin)
        if (isSuperAdmin) {
            const genStatus = document.getElementById('analiza_generala_status');
            const specStatus = document.getElementById('analiza_specifica_status');
            
            if (genStatus) genStatus.value = teren.analiza_generala_status || 'pending';
            if (specStatus) specStatus.value = teren.analiza_specifica_status || 'pending';
        }
    }

    function updateUIForEditMode() {
        document.title = 'Editează teren - ApartamenTUal';
        
        const pageTitle = document.getElementById('page-title');
        const pageSubtitle = document.getElementById('page-subtitle');
        
        if (pageTitle) pageTitle.textContent = 'Editează terenul';
        if (pageSubtitle) pageSubtitle.textContent = 'Modifică informațiile despre teren.';
        if (submitBtn) submitBtn.textContent = 'Salvează modificările';

        // Poza nu mai e obligatorie la editare
        const pozaInput = document.getElementById('poza');
        if (pozaInput) pozaInput.removeAttribute('required');
    }

    // === VALIDARE ===
    function validateForm(formData) {
        const errors = [];
        
        if (!formData.get('titlu')?.trim()) errors.push('Titlul este obligatoriu');
        if (!formData.get('oras')) errors.push('Orașul este obligatoriu');
        if (!formData.get('cartier')) errors.push('Zona/cartierul este obligatorie');
        if (!formData.get('suprafata') || parseInt(formData.get('suprafata')) <= 0) {
            errors.push('Suprafața trebuie să fie mai mare decât 0');
        }

        // La creare e obligatoriu cel puțin o imagine. La edit e OK dacă păstrezi
        // cel puțin o imagine existentă sau adaugi una nouă.
        if (imageItems.length === 0) {
            errors.push('Adaugă cel puțin o imagine');
        }
        if (imageItems.length > MAX_IMAGES) {
            errors.push(`Maxim ${MAX_IMAGES} imagini permise`);
        }

        return errors;
    }

    // === UPLOAD IMAGINE ===
    // `index` + sufix aleator garantează nume unic per fișier. Fără el, mai multe
    // poze încărcate în paralel primeau același Date.now() → același nume → se
    // suprascriau (rămânea o singură imagine, repetată în image_urls).
    async function uploadImageToStorage(file, userId, index) {
        const fileExt = file.name.split('.').pop();
        const uniqueSuffix = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
        const fileName = `${userId}/${uniqueSuffix}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('terrain-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw new Error('Eroare la încărcarea imaginii: ' + error.message);
        }

        const { data: { publicUrl } } = supabase.storage
            .from('terrain-images')
            .getPublicUrl(fileName);

        return publicUrl;
    }

    // === SUBMIT FORMULAR ===
    async function handleFormSubmit(event) {
        event.preventDefault();

        try {
            showLoading();

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                throw new Error('Trebuie să fii autentificat');
            }

            const formData = new FormData(form);

            // Validare
            const validationErrors = validateForm(formData);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join('\n'));
            }

            // Upload imagini noi în paralel. Pentru fiecare item din basket:
            //   - 'existing' → păstrăm URL-ul deja salvat
            //   - 'new' → upload file, înlocuim cu URL-ul public
            // Rezultatul final respectă ordinea din basket (prima imagine = principala).
            const uploadedUrls = await Promise.all(imageItems.map(async (item, index) => {
                if (item.kind === 'existing') {
                    return item.url;
                }
                return await uploadImageToStorage(item.file, user.id, index);
            }));

            // Calcul preț/mp
            const suprafata = parseInt(formData.get('suprafata'));
            const pretTotal = formData.get('pret_total') ? parseFloat(formData.get('pret_total')) : null;
            const pretPeMp = (suprafata > 0 && pretTotal > 0) ? parseFloat((pretTotal / suprafata).toFixed(2)) : null;

            // Prepare data
            const terenData = {
                titlu: formData.get('titlu').trim(),
                descriere: formData.get('descriere')?.trim() || null,
                link_sursa: formData.get('link_sursa')?.trim() || null,
                oras: formData.get('oras'),
                cartier: formData.get('cartier'),
                zona: `${formData.get('oras')} - ${formData.get('cartier')}`, // backwards compat
                suprafata: suprafata,
                pret_total: pretTotal,
                pret_pe_mp: pretPeMp,
                image_urls: uploadedUrls,
                // Keep legacy scalar in sync with the primary image (first in array).
                // Old code paths that still read image_url will work during rollout.
                image_url: uploadedUrls[0] || null
            };

            // Câmpuri specifice la creare
            if (!isEditMode) {
                terenData.created_by_user_id = user.id;
                terenData.status = 'pending'; // Necesită aprobare admin
                terenData.analiza_generala_status = 'pending';
                terenData.analiza_specifica_status = 'pending';
            }

            // Câmpuri admin (edit mode)
            if (isSuperAdmin) {
                terenData.analiza_generala_status = formData.get('analiza_generala_status') || 'pending';
                terenData.analiza_specifica_status = formData.get('analiza_specifica_status') || 'pending';
            }

            // Save
            let result;
            if (isEditMode) {
                result = await supabase
                    .from('terenuri')
                    .update(terenData)
                    .eq('id', editTerenId)
                    .select();
            } else {
                result = await supabase
                    .from('terenuri')
                    .insert([terenData])
                    .select();
            }

            if (result.error) {
                throw new Error('Eroare la salvare: ' + result.error.message);
            }

            // Success
            if (isEditMode) {
                successMessage.textContent = 'Terenul a fost actualizat cu succes!';
            } else {
                successMessage.textContent = 'Terenul a fost trimis cu succes! Va fi vizibil după aprobare de către un administrator.';
                var newTerenId = result.data && result.data[0] ? result.data[0].id : null;
                // Notify admins about new terrain
                if (typeof notifyAdmins === 'function') {
                    notifyAdmins('terrain_proposed', {
                        id: newTerenId,
                        titlu: terenData.titlu,
                        zona: terenData.zona,
                        suprafata: terenData.suprafata,
                        descriere: terenData.descriere,
                        creator_email: user.email
                    });
                }
                // Auto-add terrain to profile for agency accounts
                try {
                    if (newTerenId) {
                        var { data: prof } = await supabase.from('profiles').select('account_type').eq('user_id', user.id).single();
                        if (prof && prof.account_type === 'profesional') {
                            await supabase.from('terenuri_likes').insert({ teren_id: newTerenId, user_id: user.id });
                        }
                    }
                } catch (autoLikeErr) {
                    console.warn('Auto-like failed:', autoLikeErr);
                }
            }
            showSuccess();

            if (!isEditMode) {
                form.reset();
                // Clear image basket and previews
                imageItems.forEach(item => {
                    if (item.kind === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                });
                imageItems = [];
                renderImagePreviews();
                pretMpDisplay?.classList.add('hidden');
                cartierSelect.disabled = true;
                cartierSelect.innerHTML = '<option value="">Alege mai întâi orașul</option>';
            }

            // Redirect
            setTimeout(() => {
                if (isEditMode) {
                    window.location.href = `/teren-details.html?id=${editTerenId}`;
                } else {
                    window.location.href = '/terenuri.html';
                }
            }, 2500);

        } catch (error) {
            console.error('Form error:', error);
            showError(error.message);
        }
    }

    // === SHOW/HIDE STATES ===
    function showLoading() {
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');
        submitBtn.disabled = true;
    }

    function hideLoading() {
        loadingEl.classList.add('hidden');
        submitBtn.disabled = false;
    }

    function showError(message) {
        hideLoading();
        errorMessage.textContent = message;
        errorEl.classList.remove('hidden');
        successEl.classList.add('hidden');
        // Scroll to error
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showSuccess() {
        hideLoading();
        successEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        submitBtn.disabled = true;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // === EVENT LISTENERS ===
    form.addEventListener('submit', handleFormSubmit);

    // === INIT ===
    checkAuthAndSetup();
});
