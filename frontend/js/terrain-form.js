// Terrain form handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('terrain-form');
    const submitBtn = document.getElementById('submit-btn');
    const loadingEl = document.getElementById('form-loading');
    const errorEl = document.getElementById('form-error');
    const successEl = document.getElementById('form-success');
    const errorMessage = document.getElementById('error-message');

    if (!form) return;

    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const editTerenId = urlParams.get('edit');
    const isEditMode = !!editTerenId;
    let currentTerrain = null;
    let isSuperAdmin = false;
    let analizaGeneralaEditor = null;
    let analizaSpecificaEditor = null;

    // Check if user is super admin and show/hide analysis section
    async function checkSuperAdminAndToggleAnalysisSection() {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                return;
            }

            const { data: profile } = await supabase
                .from('profiles_visible')
                .select('is_super_admin')
                .eq('user_id', user.id)
                .single();

            isSuperAdmin = profile?.is_super_admin || false;
            
            const analysisSection = document.getElementById('analysis-section');
            if (analysisSection) {
                if (isSuperAdmin) {
                    analysisSection.classList.remove('hidden');
                } else {
                    analysisSection.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error checking super admin status:', error);
        }
    }

    // Initialize TinyMDE editors
    function initializeTinyMDE() {
        try {
            // Initialize analiza_generala editor
            if (document.getElementById('analiza_generala_editor')) {
                analizaGeneralaEditor = new TinyMDE.Editor({
                    element: 'analiza_generala_editor',
                    placeholder: 'Rezultatele și observațiile din analiza generală...',
                    initialValue: '',
                    defaultValue: ''
                });
                
                // Clear any default content after initialization
                if (analizaGeneralaEditor) {
                    setTimeout(() => {
                        if (analizaGeneralaEditor.getContent() && analizaGeneralaEditor.getContent().includes('# Hello TinyMDE!')) {
                            analizaGeneralaEditor.setContent('');
                        }
                    }, 100);
                }
            }

            // Initialize analiza_specifica editor
            if (document.getElementById('analiza_specifica_editor')) {
                analizaSpecificaEditor = new TinyMDE.Editor({
                    element: 'analiza_specifica_editor',
                    placeholder: 'Rezultatele și observațiile din analiza specifică...',
                    initialValue: '',
                    defaultValue: ''
                });
                
                // Clear any default content after initialization
                if (analizaSpecificaEditor) {
                    setTimeout(() => {
                        if (analizaSpecificaEditor.getContent() && analizaSpecificaEditor.getContent().includes('# Hello TinyMDE!')) {
                            analizaSpecificaEditor.setContent('');
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Error initializing TinyMDE editors:', error);
        }
    }

    // Load terrain data for editing
    async function loadTerrainData(terenId) {
        try {
            showLoading();
            
            // Check authentication first
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                throw new Error('Pentru a edita un teren trebuie sa fiti autentificat');
            }

            // Load terrain data
            const { data: teren, error } = await supabase
                .from('terenuri')
                .select('*')
                .eq('id', terenId)
                .single();

            if (error) {
                console.error('Error loading terrain:', error);
                throw new Error('Nu s-a putut incarca terenul pentru editare');
            }

            if (!teren) {
                throw new Error('Terenul nu a fost gasit');
            }

            // Check if user can edit this terrain
            const { data: profile } = await supabase
                .from('profiles_visible')
                .select('*')
                .eq('user_id', user.id)
                .single();

            const canEdit = profile && (
                (profile.user_id === teren.created_by_user_id) || 
                profile.is_super_admin
            );

            if (!canEdit) {
                throw new Error('Nu aveti permisiunea sa editati acest teren');
            }

            currentTerrain = teren;
            populateForm(teren);
            updateUIForEditMode();
            hideLoading();

        } catch (error) {
            console.error('Error loading terrain for edit:', error);
            showError(error.message || 'Eroare la incarcarea terenului pentru editare');
        }
    }

    // Populate form with terrain data
    function populateForm(teren) {
        document.getElementById('titlu').value = teren.titlu || '';
        document.getElementById('descriere').value = teren.descriere || '';
        document.getElementById('zona').value = teren.zona || '';
        document.getElementById('suprafata').value = teren.suprafata || '';
        document.getElementById('pret_pe_mp').value = teren.pret_pe_mp || '';
        document.getElementById('nr_apartamente_min').value = teren.nr_apartamente_min || '';
        document.getElementById('nr_apartamente_max').value = teren.nr_apartamente_max || '';
        
        // Populate analysis fields if user is super admin
        if (isSuperAdmin) {
            document.getElementById('analiza_generala_status').value = teren.analiza_generala_status || 'pending';
            document.getElementById('analiza_specifica_status').value = teren.analiza_specifica_status || 'pending';
            
            // Set content in TinyMDE editors
            if (analizaGeneralaEditor) {
                analizaGeneralaEditor.setContent(teren.analiza_generala_text || '');
            }
            if (analizaSpecificaEditor) {
                analizaSpecificaEditor.setContent(teren.analiza_specifica_text || '');
            }
        }
        
        // Show current image if exists
        if (teren.image_url) {
            showCurrentImage(teren.image_url);
        }
    }

    // Show current image in edit mode
    function showCurrentImage(imageUrl) {
        const pozaField = document.getElementById('poza');
        if (pozaField && pozaField.parentNode) {
            // Create current image display
            const currentImageDiv = document.createElement('div');
            currentImageDiv.id = 'current-image-display';
            currentImageDiv.className = 'mt-2 p-3 bg-gray-50 rounded-md border';
            currentImageDiv.innerHTML = `
                <p class="text-sm font-medium text-gray-700 mb-2">Imagine actuală:</p>
                <img src="${imageUrl}" alt="Imagine curentă" class="w-32 h-32 object-cover rounded-md" onerror="this.parentElement.style.display='none';">
                <p class="text-xs text-gray-500 mt-1">Încărcați o imagine nouă pentru a o înlocui sau lăsați câmpul gol pentru a păstra imaginea actuală</p>
            `;
            
            // Insert after the file input
            pozaField.parentNode.insertBefore(currentImageDiv, pozaField.nextSibling);
        }
    }

    // Update UI for edit mode
    function updateUIForEditMode() {
        // Update page title
        document.title = 'Editează teren - ApartamenTUal';
        
        // Update main heading
        const mainHeading = document.querySelector('h1');
        if (mainHeading) {
            mainHeading.textContent = 'Editează terenul';
        }

        // Update subtitle
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) {
            subtitle.textContent = 'Modifică informațiile despre teren';
        }

        // Update submit button text
        submitBtn.textContent = 'Salvează modificările';

        // Update loading text
        const loadingText = document.querySelector('#form-loading p');
        if (loadingText) {
            loadingText.textContent = 'Se salvează modificările...';
        }

        // Update success message
        const successText = document.querySelector('#form-success p');
        if (successText) {
            successText.textContent = 'Terenul a fost modificat cu succes!';
        }
    }

    // Form validation
    function validateForm(formData) {
        const errors = [];

        if (!formData.get('titlu')?.trim()) {
            errors.push('Titlul este obligatoriu');
        }

        if (!formData.get('zona')?.trim()) {
            errors.push('Zona este obligatorie');
        }

        if (!formData.get('suprafata') || parseInt(formData.get('suprafata')) <= 0) {
            errors.push('Suprafata trebuie sa fie mai mare decat 0');
        }

        const nrApartMin = parseInt(formData.get('nr_apartamente_min'));
        const nrApartMax = parseInt(formData.get('nr_apartamente_max'));
        
        if (nrApartMin && nrApartMax && nrApartMin > nrApartMax) {
            errors.push('Numarul minim de apartamente nu poate fi mai mare decat numarul maxim');
        }

        const pretPerMp = parseFloat(formData.get('pret_pe_mp'));
        if (pretPerMp && pretPerMp < 0) {
            errors.push('Pretul per mp nu poate fi negativ');
        }

        return errors;
    }

    // Upload image to Supabase Storage
    async function uploadImageToStorage(file, userId) {
        if (!file) {
            return null;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Imaginea este prea mare. Marimea maxima permisa este 5MB.');
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            throw new Error('Fisierul selectat nu este o imagine valida.');
        }

        try {
            // Generate unique filename with user ID as folder
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('terrain-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Storage upload error:', error);
                throw new Error('Eroare la uploadul imaginii: ' + error.message);
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('terrain-images')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        }
    }

    // Show/hide states
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
    }

    function showSuccess() {
        hideLoading();
        successEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
    }

    // Handle form submission
    async function handleFormSubmit(event) {
        event.preventDefault();

        try {
            showLoading();

            // Check authentication
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                const actionText = isEditMode ? 'edita' : 'adauga';
                throw new Error(`Pentru a ${actionText} un teren trebuie sa fiti autentificat`);
            }

            console.log('Authenticated user:', user.id); // Debug: check user ID

            const formData = new FormData(form);
            
            // Validate form data
            const validationErrors = validateForm(formData);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '));
            }

            // Process image file if uploaded
            let imageUrl = isEditMode && currentTerrain ? currentTerrain.image_url : null;
            const pozaFile = formData.get('poza');
            if (pozaFile && pozaFile.size > 0) {
                imageUrl = await uploadImageToStorage(pozaFile, user.id);
            }

            // Prepare data for database operation
            const terenData = {
                titlu: formData.get('titlu').trim(),
                descriere: formData.get('descriere')?.trim() || null,
                zona: formData.get('zona').trim(),
                suprafata: parseInt(formData.get('suprafata')),
                pret_pe_mp: formData.get('pret_pe_mp') ? parseFloat(formData.get('pret_pe_mp')) : null,
                nr_apartamente_min: formData.get('nr_apartamente_min') ? parseInt(formData.get('nr_apartamente_min')) : null,
                nr_apartamente_max: formData.get('nr_apartamente_max') ? parseInt(formData.get('nr_apartamente_max')) : null,
                image_url: imageUrl
            };

            // Add analysis fields if user is super admin
            if (isSuperAdmin) {
                terenData.analiza_generala_status = formData.get('analiza_generala_status') || 'pending';
                terenData.analiza_specifica_status = formData.get('analiza_specifica_status') || 'pending';
                
                // Get content from TinyMDE editors
                if (analizaGeneralaEditor) {
                    terenData.analiza_generala_text = analizaGeneralaEditor.getContent()?.trim() || null;
                } else {
                    terenData.analiza_generala_text = formData.get('analiza_generala_text')?.trim() || null;
                }
                
                if (analizaSpecificaEditor) {
                    terenData.analiza_specifica_text = analizaSpecificaEditor.getContent()?.trim() || null;
                } else {
                    terenData.analiza_specifica_text = formData.get('analiza_specifica_text')?.trim() || null;
                }
            }

            // Add creation-specific fields for new terrains
            if (!isEditMode) {
                terenData.created_by_user_id = user.id;
                terenData.status = 'active';
                terenData.analiza_generala_status = 'pending';
                terenData.analiza_specifica_status = 'pending';
            }

            console.log('Terrain data to save:', terenData); // Debug: check data being saved

            let result;
            if (isEditMode) {
                // Update existing terrain
                result = await supabase
                    .from('terenuri')
                    .update(terenData)
                    .eq('id', editTerenId)
                    .select();
            } else {
                // Insert new terrain
                result = await supabase
                    .from('terenuri')
                    .insert([terenData])
                    .select();
            }

            if (result.error) {
                console.error('Supabase error:', result.error);
                const actionText = isEditMode ? 'modificarea' : 'salvarea';
                throw new Error(`Eroare la ${actionText} terenului: ` + result.error.message);
            }

            showSuccess();
            
            if (!isEditMode) {
                // Reset form after successful creation
                form.reset();
            }

            // Redirect after 2 seconds
            setTimeout(() => {
                if (isEditMode) {
                    // Redirect back to terrain details
                    window.location.href = `/teren-details.html?id=${editTerenId}`;
                } else {
                    // Redirect to terrain list
                    window.location.href = '/terenuri.html';
                }
            }, 2000);

        } catch (error) {
            console.error('Form submission error:', error);
            showError(error.message || 'A aparut o eroare neprevazuta. Te rugam sa incerci din nou.');
        }
    }

    // Add form submit event listener
    form.addEventListener('submit', handleFormSubmit);

    // Add input validation for apartment numbers
    const nrApartMinInput = document.getElementById('nr_apartamente_min');
    const nrApartMaxInput = document.getElementById('nr_apartamente_max');

    if (nrApartMinInput && nrApartMaxInput) {
        function validateApartmentNumbers() {
            const min = parseInt(nrApartMinInput.value);
            const max = parseInt(nrApartMaxInput.value);

            if (min && max && min > max) {
                nrApartMaxInput.setCustomValidity('Numarul maxim trebuie sa fie mai mare sau egal cu numarul minim');
            } else {
                nrApartMaxInput.setCustomValidity('');
            }
        }

        nrApartMinInput.addEventListener('input', validateApartmentNumbers);
        nrApartMaxInput.addEventListener('input', validateApartmentNumbers);
    }

    // Initialize super admin check and edit mode if needed
    checkSuperAdminAndToggleAnalysisSection();
    
    // Initialize TinyMDE editors after a short delay to ensure DOM is ready
    setTimeout(() => {
        initializeTinyMDE();
    }, 100);
    
    if (isEditMode) {
        loadTerrainData(editTerenId);
    }
});