// Terrain form handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('terrain-form');
    const submitBtn = document.getElementById('submit-btn');
    const loadingEl = document.getElementById('form-loading');
    const errorEl = document.getElementById('form-error');
    const successEl = document.getElementById('form-success');
    const errorMessage = document.getElementById('error-message');

    if (!form) return;

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
                throw new Error('Pentru a adauga un teren trebuie sa fiti autentificat');
            }

            console.log('Authenticated user:', user.id); // Debug: check user ID

            const formData = new FormData(form);
            
            // Validate form data
            const validationErrors = validateForm(formData);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '));
            }

            // Process image file if uploaded
            let imageUrl = null;
            const pozaFile = formData.get('poza');
            if (pozaFile && pozaFile.size > 0) {
                imageUrl = await uploadImageToStorage(pozaFile, user.id);
            }

            // Prepare data for database insertion
            const terenData = {
                created_by_user_id: user.id,
                titlu: formData.get('titlu').trim(),
                descriere: formData.get('descriere')?.trim() || null,
                zona: formData.get('zona').trim(),
                suprafata: parseInt(formData.get('suprafata')),
                pret_pe_mp: formData.get('pret_pe_mp') ? parseFloat(formData.get('pret_pe_mp')) : null,
                nr_apartamente_min: formData.get('nr_apartamente_min') ? parseInt(formData.get('nr_apartamente_min')) : null,
                nr_apartamente_max: formData.get('nr_apartamente_max') ? parseInt(formData.get('nr_apartamente_max')) : null,
                image_url: imageUrl,
                status: 'active',
                analiza_generala_status: 'pending',
                analiza_specifica_status: 'pending'
            };

            console.log('Terrain data to insert:', terenData); // Debug: check data being inserted

            // Insert into Supabase
            const { data, error } = await supabase
                .from('terenuri')
                .insert([terenData])
                .select();

            if (error) {
                console.error('Supabase error:', error);
                throw new Error('Eroare la salvarea terenului: ' + error.message);
            }

            showSuccess();
            
            // Reset form after successful submission
            form.reset();

            // Redirect to terrain list after 2 seconds
            setTimeout(() => {
                window.location.href = '/terenuri.html';
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
});