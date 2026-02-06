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
    let extractedImageUrl = null; // Store extracted image URL

    // === LINK EXTRACTION ===
    const linkInput = document.getElementById('link_sursa');
    const extractBtn = document.getElementById('btn-extract-data');
    const extractIcon = document.getElementById('extract-icon');
    const extractText = document.getElementById('extract-text');
    const extractStatus = document.getElementById('extract-status');
    const extractStatusText = document.getElementById('extract-status-text');
    const extractedImagePreview = document.getElementById('extracted-image-preview');
    const extractedImg = document.getElementById('extracted-img');
    const btnRemoveExtracted = document.getElementById('btn-remove-extracted');
    const pozaLabel = document.getElementById('poza-label');
    const pozaHint = document.getElementById('poza-hint');

    // Enable/disable extract button based on link input
    if (linkInput && extractBtn) {
        linkInput.addEventListener('input', function() {
            const url = this.value.trim();
            extractBtn.disabled = !isValidUrl(url);
        });

        extractBtn.addEventListener('click', handleExtractData);
    }

    // Remove extracted image
    if (btnRemoveExtracted) {
        btnRemoveExtracted.addEventListener('click', function() {
            extractedImageUrl = null;
            extractedImagePreview.classList.add('hidden');
            document.getElementById('extracted_image_url').value = '';
            updatePozaRequirement(true); // Make poza required again
        });
    }

    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async function handleExtractData() {
        const url = linkInput.value.trim();
        if (!isValidUrl(url)) return;

        // Show loading state
        extractBtn.disabled = true;
        extractIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>';
        extractIcon.classList.add('animate-spin');
        extractText.textContent = 'Se extrage...';
        showExtractStatus('info', 'Se preiau datele din anunț...');

        try {
            // Use a CORS proxy or backend endpoint to fetch the page
            // For now, we'll use allorigins.win as a CORS proxy
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Nu am putut accesa link-ul');
            
            const data = await response.json();
            const html = data.contents;
            
            // Parse HTML to extract meta tags
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract og:image (main image)
            let imageUrl = getMetaContent(doc, 'og:image') || 
                           getMetaContent(doc, 'twitter:image') ||
                           getFirstImage(doc);
            
            // Extract title
            let title = getMetaContent(doc, 'og:title') || 
                        doc.querySelector('title')?.textContent || '';
            
            // Clean up title
            title = cleanTitle(title);
            
            // Results
            let extractedCount = 0;
            
            // Set title if found and field is empty
            const titluInput = document.getElementById('titlu');
            if (title && titluInput && !titluInput.value.trim()) {
                titluInput.value = title;
                extractedCount++;
            }
            
            // Set image if found
            if (imageUrl) {
                // Make sure image URL is absolute
                if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    imageUrl = urlObj.origin + imageUrl;
                }
                
                extractedImageUrl = imageUrl;
                document.getElementById('extracted_image_url').value = imageUrl;
                extractedImg.src = imageUrl;
                extractedImagePreview.classList.remove('hidden');
                updatePozaRequirement(false); // Make poza optional since we have extracted image
                extractedCount++;
            }
            
            // Show result
            if (extractedCount > 0) {
                const messages = [];
                if (title && titluInput && titluInput.value === title) messages.push('titlu');
                if (imageUrl) messages.push('imagine');
                showExtractStatus('success', `Am extras: ${messages.join(', ')}. Completează restul câmpurilor manual.`);
            } else {
                showExtractStatus('warning', 'Nu am găsit date de extras. Completează manual câmpurile.');
            }

        } catch (error) {
            console.error('Extract error:', error);
            showExtractStatus('error', 'Nu am putut extrage datele. Verifică link-ul sau completează manual.');
        } finally {
            // Reset button
            extractBtn.disabled = false;
            extractIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>';
            extractIcon.classList.remove('animate-spin');
            extractText.textContent = 'Extrage';
        }
    }

    function getMetaContent(doc, property) {
        const meta = doc.querySelector(`meta[property="${property}"]`) || 
                     doc.querySelector(`meta[name="${property}"]`);
        return meta?.getAttribute('content') || null;
    }

    function getFirstImage(doc) {
        // Try to find main content image
        const selectors = [
            'article img',
            '.gallery img',
            '.photos img',
            'main img',
            '#content img'
        ];
        for (const selector of selectors) {
            const img = doc.querySelector(selector);
            if (img && img.src) return img.src;
        }
        return null;
    }

    function cleanTitle(title) {
        // Remove common suffixes from real estate sites
        const removeParts = [
            ' - Imobiliare.ro',
            ' - Storia.ro',
            ' - OLX.ro',
            ' | Imobiliare.ro',
            ' | Storia.ro',
            ' | OLX.ro',
            ' - Anunturi imobiliare',
            ' de vanzare'
        ];
        for (const part of removeParts) {
            title = title.replace(new RegExp(part, 'gi'), '');
        }
        return title.trim();
    }

    function showExtractStatus(type, message) {
        extractStatus.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-red-50', 
                                        'text-blue-800', 'text-green-800', 'text-yellow-800', 'text-red-800');
        
        const colors = {
            info: ['bg-blue-50', 'text-blue-800'],
            success: ['bg-green-50', 'text-green-800'],
            warning: ['bg-yellow-50', 'text-yellow-800'],
            error: ['bg-red-50', 'text-red-800']
        };
        
        extractStatus.classList.add(...colors[type]);
        extractStatusText.textContent = message;
        
        // Auto-hide after 5 seconds for success
        if (type === 'success') {
            setTimeout(() => extractStatus.classList.add('hidden'), 5000);
        }
    }

    function updatePozaRequirement(required) {
        const pozaInput = document.getElementById('poza');
        if (required) {
            pozaLabel.innerHTML = 'Poză teren *';
            pozaHint.textContent = 'Obligatorie. Poți încărca o imagine sau extrage una din link-ul anunțului.';
            // Don't set required attribute - we handle this in validation
        } else {
            pozaLabel.innerHTML = 'Poză teren <span class="text-gray-400">(opțional - ai deja o imagine)</span>';
            pozaHint.textContent = 'Ai deja o imagine din anunț. Poți încărca alta dacă preferi.';
        }
    }

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

    // === PREVIEW IMAGINE ===
    const pozaInput = document.getElementById('poza');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');

    if (pozaInput) {
        pozaInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.classList.add('hidden');
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
                        const authModal = document.getElementById('auth-modal');
                        if (authModal) authModal.classList.remove('hidden');
                    });
                }
                return;
            }

            // E autentificat - arată formularul
            formContainer.classList.remove('hidden');
            authRequired.classList.add('hidden');

            // Verifică dacă e super admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('user_id', user.id)
                .single();

            isSuperAdmin = profile?.is_super_admin || false;

            // Arată secțiunile de admin
            if (isSuperAdmin) {
                const analysisSection = document.getElementById('analysis-section');
                if (analysisSection) analysisSection.classList.remove('hidden');
                
                if (isEditMode) {
                    const adminStatusSection = document.getElementById('admin-status-section');
                    if (adminStatusSection) adminStatusSection.classList.remove('hidden');
                }
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
                .from('profiles')
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

        // Imagine curentă
        if (teren.image_url) {
            showCurrentImage(teren.image_url);
        }

        // Analiza (admin)
        if (isSuperAdmin) {
            const genStatus = document.getElementById('analiza_generala_status');
            const specStatus = document.getElementById('analiza_specifica_status');
            const adminStatus = document.getElementById('admin-status');
            
            if (genStatus) genStatus.value = teren.analiza_generala_status || 'pending';
            if (specStatus) specStatus.value = teren.analiza_specifica_status || 'pending';
            if (adminStatus) adminStatus.value = teren.status || 'pending';
        }
    }

    function showCurrentImage(imageUrl) {
        const pozaField = document.getElementById('poza');
        if (pozaField && pozaField.parentNode) {
            const existingPreview = document.getElementById('current-image-display');
            if (existingPreview) existingPreview.remove();

            const currentImageDiv = document.createElement('div');
            currentImageDiv.id = 'current-image-display';
            currentImageDiv.className = 'mt-2 p-3 bg-gray-50 rounded-md border';
            currentImageDiv.innerHTML = `
                <p class="text-sm font-medium text-gray-700 mb-2">Imagine actuală:</p>
                <img src="${imageUrl}" alt="Imagine curentă" class="w-32 h-32 object-cover rounded-md" onerror="this.parentElement.style.display='none';">
                <p class="text-xs text-gray-500 mt-1">Încarcă o imagine nouă pentru a o înlocui, sau lasă câmpul gol pentru a păstra imaginea actuală.</p>
            `;
            pozaField.parentNode.appendChild(currentImageDiv);
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

        // Poza obligatorie la creare (nu la editare) - acceptă și imagine extrasă
        if (!isEditMode) {
            const pozaFile = formData.get('poza');
            const hasUploadedFile = pozaFile && pozaFile.size > 0;
            const hasExtractedImage = extractedImageUrl && extractedImageUrl.length > 0;
            
            if (!hasUploadedFile && !hasExtractedImage) {
                errors.push('Imaginea terenului este obligatorie (încarcă una sau extrage din link)');
            }
        }

        // Validare poză dimensiune (dacă e upload)
        const pozaFile = formData.get('poza');
        if (pozaFile && pozaFile.size > 0) {
            if (pozaFile.size > 5 * 1024 * 1024) {
                errors.push('Imaginea nu poate depăși 5MB');
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(pozaFile.type)) {
                errors.push('Formatul imaginii nu este acceptat (JPG, PNG, GIF, WebP)');
            }
        }

        return errors;
    }

    // === UPLOAD IMAGINE ===
    async function uploadImageToStorage(file, userId) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

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

            // Upload imagine sau folosește imaginea extrasă
            let imageUrl = isEditMode && currentTerrain ? currentTerrain.image_url : null;
            const pozaFile = formData.get('poza');
            
            if (pozaFile && pozaFile.size > 0) {
                // User uploaded a file - use that
                imageUrl = await uploadImageToStorage(pozaFile, user.id);
            } else if (extractedImageUrl) {
                // Use extracted image URL directly
                imageUrl = extractedImageUrl;
            }

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
                image_url: imageUrl
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
                
                if (isEditMode) {
                    const adminStatus = formData.get('admin_status');
                    if (adminStatus) terenData.status = adminStatus;
                }
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
            }
            showSuccess();

            if (!isEditMode) {
                form.reset();
                imagePreview?.classList.add('hidden');
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
