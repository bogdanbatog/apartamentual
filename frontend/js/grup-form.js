// Group Form Page JavaScript
let currentUser = null;
let isEditMode = false;
let groupId = null;
let currentGroup = null;
let descriereEditor = null;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const successEl = document.getElementById('success');
const formContentEl = document.getElementById('form-content');
const formEl = document.getElementById('group-form');
const formTitleEl = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitLoading = document.getElementById('submit-loading');
const imagePreviewEl = document.getElementById('image-preview');
const previewImgEl = document.getElementById('preview-img');
const pozaInput = document.getElementById('poza');

// Initialize the group form page
async function initGrupForm() {
    try {
        // Check if we're in edit mode
        groupId = getGroupIdFromUrl();
        isEditMode = !!groupId;
        
        // Set up event listeners
        setupGrupFormEventListeners();
        
        // Load current user first, then load group data if in edit mode
        await loadCurrentUser();
        
        if (!currentUser) {
            showError('Trebuie să fiți autentificat pentru a accesa această pagină.');
            setTimeout(() => {
                window.location.href = '/grupuri.html';
            }, 3000);
            return;
        }
        
        if (isEditMode) {
            loadGroupData();
        } else {
            showForm();
        }
        
    } catch (error) {
        showError('Error initializing group form: ' + error.message);
    }
}

// Get group ID from URL
function getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Set up event listeners (scoped for grup form page)
function setupGrupFormEventListeners() {
    // Form submission
    if (formEl) {
        formEl.addEventListener('submit', handleFormSubmit);
    }
    
    // Image preview
    if (pozaInput) {
        pozaInput.addEventListener('change', handleImagePreview);
    }
    
    // Date validation
    const startDateInput = document.getElementById('data_incepere_proiect');
    const endDateInput = document.getElementById('data_finalizare_proiect');
    
    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', validateDates);
        endDateInput.addEventListener('change', validateDates);
    }
}

// Initialize TinyMDE editor for group description
function initializeDescriereEditor() {
    try {
        if (document.getElementById('descriere_editor')) {
            descriereEditor = new TinyMDE.Editor({
                element: 'descriere_editor',
                placeholder: 'Descrie obiectivele și caracteristicile grupului tău...',
                initialValue: '',
                defaultValue: ''
            });
            
            // Clear any default content after initialization
            if (descriereEditor) {
                setTimeout(() => {
                    if (descriereEditor.getContent() && descriereEditor.getContent().includes('# Hello TinyMDE!')) {
                        descriereEditor.setContent('');
                    }
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error initializing TinyMDE for descriere:', error);
    }
}

// Load current user
async function loadCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (profileError) throw profileError;
            
            currentUser = {
                id: user.id,
                email: user.email,
                ...profile
            };
        } else {
            // User not logged in, redirect to groups page
            window.location.href = '/grupuri.html';
        }
    } catch (error) {
        console.error('Error loading current user:', error);
        showError('Eroare la încărcarea utilizatorului. Vă rugăm să vă autentificați din nou.');
    }
}

// Load group data for editing
async function loadGroupData() {
    try {
        showLoading(true);
        hideError();
        
        if (!currentUser || !currentUser.id) {
            showError('Utilizatorul nu este autentificat.');
            return;
        }
        
        if (!groupId) {
            showError('ID-ul grupului nu este valid.');
            return;
        }
        
        const { data: group, error } = await supabase
            .from('grup')
            .select('*')
            .eq('id', groupId)
            .eq('owner_user_id', currentUser.id) // Only allow editing own groups
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                showError('Grupul nu a fost găsit sau nu aveți permisiunea să îl editați.');
                setTimeout(() => {
                    window.location.href = '/grupuri.html';
                }, 3000);
                return;
            }
            throw error;
        }
        
        currentGroup = group;
        populateForm(group);
        showForm();
        
    } catch (error) {
        console.error('Error loading group data:', error);
        showError('Eroare la încărcarea datelor grupului: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Populate form with group data
function populateForm(group) {
    // Update form title
    formTitleEl.textContent = 'Editează grupul';
    
    // Update submit button text
    submitText.textContent = 'Salvează modificările';
    
    // Populate form fields
    document.getElementById('nume').value = group.nume || '';
    const descriereTextarea = document.getElementById('descriere');
    if (descriereEditor) {
        descriereEditor.setContent(group.descriere || '');
        if (descriereTextarea) descriereTextarea.value = group.descriere || '';
    } else if (descriereTextarea) {
        descriereTextarea.value = group.descriere || '';
    }
    document.getElementById('zona').value = group.zona || '';
    document.getElementById('max_members').value = group.max_members || '';
    document.getElementById('nr_apartamente_dorite').value = group.nr_apartamente_dorite || '';
    document.getElementById('buget_max_per_apartament').value = group.buget_max_per_apartament || '';
    
    // Format dates for input
    if (group.data_incepere_proiect) {
        const startDate = new Date(group.data_incepere_proiect);
        document.getElementById('data_incepere_proiect').value = startDate.toISOString().split('T')[0];
    }
    
    if (group.data_finalizare_proiect) {
        const endDate = new Date(group.data_finalizare_proiect);
        document.getElementById('data_finalizare_proiect').value = endDate.toISOString().split('T')[0];
    }
    
    // Checkboxes
    document.getElementById('is_public').checked = group.is_public || false;
    document.getElementById('is_disabled').checked = group.is_disabled || false;
    
    // Show existing image if available
    if (group.image_url) {
        previewImgEl.src = group.image_url;
        imagePreviewEl.classList.remove('hidden');
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('Trebuie să fiți autentificat pentru a crea sau edita un grup.');
        return;
    }
    
    // Validate form
    if (!validateForm()) {
        return;
    }
    
    try {
        showSubmitLoading(true);
        hideError();
        hideSuccess();
        
        // Get form data
        const formData = new FormData(formEl);
        const groupData = {
            nume: formData.get('nume'),
            descriere: (descriereEditor ? descriereEditor.getContent() : formData.get('descriere')),
            zona: formData.get('zona'),
            max_members: parseInt(formData.get('max_members')),
            nr_apartamente_dorite: formData.get('nr_apartamente_dorite') ? parseInt(formData.get('nr_apartamente_dorite')) : null,
            buget_max_per_apartament: formData.get('buget_max_per_apartament') ? parseInt(formData.get('buget_max_per_apartament')) : null,
            data_incepere_proiect: formData.get('data_incepere_proiect') || null,
            data_finalizare_proiect: formData.get('data_finalizare_proiect') || null,
            is_public: formData.get('is_public') === 'on',
            is_disabled: formData.get('is_disabled') === 'on',
            status: 'active'
        };
        
        // Handle image upload
        const imageFile = formData.get('poza');
        if (imageFile && imageFile.size > 0) {
            try {
                const imageUrl = await uploadImageToStorage(imageFile, currentUser.id);
                groupData.image_url = imageUrl;
            } catch (error) {
                showError(error.message);
                return;
            }
        } else if (isEditMode && currentGroup && currentGroup.image_url) {
            // Keep existing image if no new one uploaded
            groupData.image_url = currentGroup.image_url;
        }
        
        // Set owner for new groups
        if (!isEditMode) {
            groupData.owner_user_id = currentUser.id;
        }
        
        let result;
        if (isEditMode) {
            // Update existing group
            const { data, error } = await supabase
                .from('grup')
                .update(groupData)
                .eq('id', groupId)
                .eq('owner_user_id', currentUser.id)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            // Create new group
            const { data, error } = await supabase
                .from('grup')
                .insert(groupData)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            
            // Add creator as group member with admin role
            const { error: membershipError } = await supabase
                .from('grup_membership')
                .insert({
                    grup_id: result.id,
                    user_id: currentUser.id,
                    status: 'approved',
                    role: 'admin'
                });
            
            if (membershipError) {
                console.error('Error adding creator as group member:', membershipError);
                // Don't throw error here, group was created successfully
            }
        }
        
        // Show success message
        const successMessage = isEditMode 
            ? 'Grupul a fost actualizat cu succes!'
            : 'Grupul a fost creat cu succes!';
        showSuccess(successMessage);
        
        // Redirect to group detail page after a short delay
        setTimeout(() => {
            window.location.href = `/grup-detail.html?grup=${result.id}`;
        }, 2000);
        
    } catch (error) {
        console.error('Error saving group:', error);
        showError('Eroare la salvarea grupului: ' + error.message);
    } finally {
        showSubmitLoading(false);
    }
}

// Upload image to Supabase Storage
async function uploadImageToStorage(file, userId) {
    if (!file) {
        return null;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Imaginea este prea mare. Dimensiunea maximă permisă este 5MB.');
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        throw new Error('Fișierul selectat nu este o imagine validă.');
    }

    try {
        // Generate unique filename with user ID as folder
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('group-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Storage upload error:', error);
            if (error.message.includes('Bucket not found')) {
                throw new Error('Bucket-ul pentru imagini nu a fost configurat. Contactați administratorul.');
            }
            throw new Error('Eroare la uploadul imaginii: ' + error.message);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('group-images')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

// Handle image preview
function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImgEl.src = e.target.result;
            imagePreviewEl.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        imagePreviewEl.classList.add('hidden');
    }
}

// Validate dates
function validateDates() {
    const startDate = document.getElementById('data_incepere_proiect').value;
    const endDate = document.getElementById('data_finalizare_proiect').value;
    
    if (startDate && endDate && startDate > endDate) {
        showError('Data începerii proiectului trebuie să fie înainte de data finalizării.');
        return false;
    }
    
    hideError();
    return true;
}

// Validate form before submission
function validateForm() {
    const nume = document.getElementById('nume').value.trim();
    const descriere = (descriereEditor ? descriereEditor.getContent() : document.getElementById('descriere').value).trim();
    const zona = document.getElementById('zona').value;
    const maxMembers = parseInt(document.getElementById('max_members').value);
    
    if (!nume) {
        showError('Numele grupului este obligatoriu.');
        return false;
    }
    
    if (!descriere) {
        showError('Descrierea grupului este obligatorie.');
        return false;
    }
    
    if (!zona) {
        showError('Zona este obligatorie.');
        return false;
    }
    
    if (!maxMembers || maxMembers < 2) {
        showError('Numărul maxim de membri trebuie să fie cel puțin 2.');
        return false;
    }
    
    if (!validateDates()) {
        return false;
    }
    
    return true;
}

// Show form
function showForm() {
    if (formContentEl) {
        formContentEl.style.display = 'block';
    }
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// Show loading state
function showLoading(show) {
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show submit loading state
function showSubmitLoading(show) {
    if (submitBtn) {
        submitBtn.disabled = show;
    }
    if (submitText) {
        submitText.style.display = show ? 'none' : 'inline';
    }
    if (submitLoading) {
        submitLoading.classList.toggle('hidden', !show);
    }
}

// Show error message
function showError(message) {
    if (errorEl) {
        const errorMessageEl = document.getElementById('error-message');
        if (errorMessageEl) {
            errorMessageEl.textContent = message;
        }
        errorEl.style.display = 'block';
    }
    console.error(message);
}

// Hide error message
function hideError() {
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

// Show success message
function showSuccess(message) {
    if (successEl) {
        const successMessageEl = document.getElementById('success-message');
        if (successMessageEl) {
            successMessageEl.textContent = message;
        }
        successEl.style.display = 'block';
    }
}

// Hide success message
function hideSuccess() {
    if (successEl) {
        successEl.style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for supabase to be available
    if (typeof supabase !== 'undefined') {
        initializeDescriereEditor();
        await initGrupForm();
    } else {
        // Wait a bit for supabase to load
        setTimeout(async () => {
            if (typeof supabase !== 'undefined') {
                initializeDescriereEditor();
                await initGrupForm();
            } else {
                showError('Supabase nu a fost încărcat. Vă rugăm să reîncărcați pagina.');
            }
        }, 1000);
    }
});
