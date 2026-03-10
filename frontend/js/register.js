// Register page functionality
// ApartamenTUal Platform

let selectedAccountType = null;
let cities = [];
let zones = [];
let tags = [];
let selectedTags = [];
let selectedZones = [];
let currentUserId = null;

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    await checkExistingSession();
    
    // Load data
    await loadCities();
    await loadTags();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup city change handler
    document.getElementById('preferred_city')?.addEventListener('change', handleCityChange);
});

async function checkExistingSession() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Check for redirect URL (e.g. from invitation link)
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect');
            if (redirectUrl) {
                window.location.href = decodeURIComponent(redirectUrl);
            } else {
                window.location.href = '/profile-view-new.html?id=' + user.id;
            }
        }
    } catch (error) {
        console.error('Error checking session:', error);
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
        
        // Populate city dropdown
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
        renderTags();
    } catch (error) {
        console.error('Error loading tags:', error);
    }
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
    
    // Group tags by category
    const groupedTags = tags.reduce((acc, tag) => {
        if (!acc[tag.category]) acc[tag.category] = [];
        acc[tag.category].push(tag);
        return acc;
    }, {});
    
    const categoryNames = {
        'apartament': 'Despre Apartament',
        'imobil': 'Despre Imobil',
        'comunitate': 'Despre Comunitate'
    };
    
    container.innerHTML = Object.entries(groupedTags).map(([category, categoryTags]) => `
        <div>
            <p class="text-sm font-medium text-gray-600 mb-2">${categoryNames[category] || category}</p>
            <div class="flex flex-wrap gap-2">
                ${categoryTags.map(tag => `
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
        </div>
    `).join('');
    
    updateTagsCounter();
}

function updateTagsCounter() {
    const counter = document.getElementById('tags-counter');
    if (counter) {
        counter.textContent = `${selectedTags.length} din 15 selectate`;
        counter.className = selectedTags.length >= 15 ? 'text-sm text-orange-600 font-medium' : 'text-sm text-gray-500';
    }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

function selectAccountType(type) {
    selectedAccountType = type;
    goToStep(2);
    
    // Update badge
    const badge = document.getElementById('account-type-badge');
    if (badge) {
        badge.textContent = type === 'activ' ? '👤 Utilizator Activ' : '🏢 Agenție Imobiliară';
        badge.className = type === 'activ' 
            ? 'inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm'
            : 'inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm';
    }
}

function goToStep(step) {
    // Hide all steps
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    
    // Show requested step
    document.getElementById('step' + step).classList.remove('hidden');
    
    // Update indicators
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById('step' + i + '-indicator');
        if (indicator) {
            if (i < step) {
                indicator.classList.remove('opacity-40');
                indicator.querySelector('div').className = 'w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium';
            } else if (i === step) {
                indicator.classList.remove('opacity-40');
                indicator.querySelector('div').className = 'w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium';
            } else {
                indicator.classList.add('opacity-40');
                indicator.querySelector('div').className = 'w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-medium';
            }
        }
    }
    
    // Show appropriate profile form
    if (step === 3) {
        if (selectedAccountType === 'activ') {
            document.getElementById('profile-form-activ').classList.remove('hidden');
            document.getElementById('profile-form-profesional').classList.add('hidden');
        } else {
            document.getElementById('profile-form-activ').classList.add('hidden');
            document.getElementById('profile-form-profesional').classList.remove('hidden');
        }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCityChange(event) {
    const cityId = parseInt(event.target.value);
    selectedZones = []; // Reset selected zones
    
    // Get city name to check if it's București
    const citySelect = document.getElementById('preferred_city');
    const selectedOption = citySelect.options[citySelect.selectedIndex];
    const cityName = selectedOption ? selectedOption.text : '';
    
    // Hide both containers initially
    const zonesContainer = document.getElementById('zones-container');
    const mapContainer = document.getElementById('map-container');
    const selectedZonesList = document.getElementById('selected-zones-list');
    
    if (zonesContainer) zonesContainer.classList.add('hidden');
    if (mapContainer) mapContainer.classList.add('hidden');
    if (selectedZonesList) selectedZonesList.innerHTML = '';
    
    if (cityId) {
        if (cityName.toLowerCase().includes('bucurești') || cityName.toLowerCase().includes('bucharest')) {
            // Show interactive map for București
            if (mapContainer) {
                mapContainer.classList.remove('hidden');
                initBucurestiMap();
            }
        } else {
            // Show regular zones for other cities
            if (zonesContainer) zonesContainer.classList.remove('hidden');
            loadZonesForCity(cityId);
        }
    } else {
        // No city selected - show placeholder
        if (zonesContainer) {
            zonesContainer.classList.remove('hidden');
            zonesContainer.innerHTML = '<p class="text-sm text-gray-500">Selectează mai întâi un oraș</p>';
        }
    }
}
// Initialize București interactive map
let bucurestiMapInstance = null;

function initBucurestiMap() {
    // Destroy existing map if any
    if (bucurestiMapInstance) {
        bucurestiMapInstance.destroy();
    }
    
    // Create new map instance
    bucurestiMapInstance = new BucurestiMap('bucuresti-map', {
        maxSelections: 10,
        onSelectionChange: (selected) => {
            // Update selectedZones with the IDs from the map
            selectedZones = selected.map(n => n.id);
            
            // Update the visual list of selected zones
            updateSelectedZonesList(selected);
        }
    });
    
    // Make it accessible globally for the clear button
    window.bucurestiMap = bucurestiMapInstance;
}

function updateSelectedZonesList(selected) {
    const container = document.getElementById('selected-zones-list');
    if (!container) return;
    
    if (selected.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = selected.map(zone => `
        <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            ${zone.name}
            <button type="button" onclick="removeZoneFromMap(${zone.id})" class="hover:text-blue-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </span>
    `).join('');
}

function removeZoneFromMap(zoneId) {
    if (bucurestiMapInstance) {
        bucurestiMapInstance.selectedNeighborhoods.delete(zoneId);
        bucurestiMapInstance.geojsonLayer.eachLayer(layer => {
            if (layer.feature.properties.id === zoneId) {
                layer.setStyle(bucurestiMapInstance.getFeatureStyle(layer.feature, false));
            }
        });
        bucurestiMapInstance.updateSelectionInfo();
        
        // Update selectedZones
        const selected = bucurestiMapInstance.getSelectedNeighborhoods();
        selectedZones = selected.map(n => n.id);
        updateSelectedZonesList(selected);
    }
}
function toggleZone(zoneId) {
    const index = selectedZones.indexOf(zoneId);
    if (index > -1) {
        selectedZones.splice(index, 1);
    } else {
        selectedZones.push(zoneId);
    }
}

function toggleTag(tagId) {
    const index = selectedTags.indexOf(tagId);
    
    if (index > -1) {
        // Remove tag
        selectedTags.splice(index, 1);
    } else {
        // Add tag (if under limit)
        if (selectedTags.length >= 15) {
            alert('Poți selecta maxim 15 tag-uri');
            return;
        }
        selectedTags.push(tagId);
    }
    
    // Update UI
    const button = document.querySelector(`[data-tag-id="${tagId}"]`);
    if (button) {
        if (selectedTags.includes(tagId)) {
            button.className = 'tag-button px-3 py-1.5 rounded-full text-sm border transition bg-gray-900 text-white border-gray-900';
        } else {
            button.className = 'tag-button px-3 py-1.5 rounded-full text-sm border transition bg-white text-gray-700 border-gray-300 hover:border-gray-500';
        }
    }
    
    updateTagsCounter();
}

function openLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// =====================================================
// FORM HANDLERS
// =====================================================

function setupFormHandlers() {
    // Auth form (step 2)
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
    
    // Active user profile form
    const profileFormActiv = document.getElementById('profile-form-activ');
    if (profileFormActiv) {
        profileFormActiv.addEventListener('submit', handleActivProfileSubmit);
    }
    
    // Professional user profile form
    const profileFormPro = document.getElementById('profile-form-profesional');
    if (profileFormPro) {
        profileFormPro.addEventListener('submit', handleProfessionalProfileSubmit);
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const errorDiv = document.getElementById('auth-error');
    
    // Validate passwords match
    if (password !== passwordConfirm) {
        showError(errorDiv, 'Parolele nu coincid');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        showError(errorDiv, 'Parola trebuie să aibă minim 6 caractere');
        return;
    }
    
    // Validate terms acceptance
    const termsCheckbox = document.getElementById('acceptTerms');
    const termsError = document.getElementById('termsError');
    if (termsCheckbox && !termsCheckbox.checked) {
        if (termsError) termsError.classList.remove('hidden');
        termsCheckbox.focus();
        return;
    }
    if (termsError) termsError.classList.add('hidden');
    
    try {
        // Check if there's a redirect URL (e.g. from invitation)
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');
        
        // Build email redirect - if coming from invitation, redirect confirmation to invite link
        const emailRedirectTo = redirectUrl 
            ? decodeURIComponent(redirectUrl)
            : window.location.origin;
        
        // Create account
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    account_type: selectedAccountType
                },
                emailRedirectTo: emailRedirectTo
            }
        });
        
        if (error) {
            if (error.message.includes('already registered')) {
                showError(errorDiv, 'Acest email este deja înregistrat. Încearcă să te autentifici.');
            } else {
                showError(errorDiv, error.message);
            }
            return;
        }
        
        if (data.user) {
            currentUserId = data.user.id;
            
            // Update profile with account type - USING user_id NOT id
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    account_type: selectedAccountType,
                    account_status: selectedAccountType === 'profesional' ? 'pending' : 'active'
                })
                .eq('user_id', data.user.id);
            
            if (updateError) {
                console.error('Error updating profile:', updateError);
            }
            
            // Move to step 3
            goToStep(3);
            
            // Notify admins (non-blocking)
            notifyAdmins('new_user', { email: email, user_id: data.user.id });
        }
        
    } catch (error) {
        showError(errorDiv, 'A apărut o eroare. Te rugăm să încerci din nou.');
        console.error('Auth error:', error);
    }
}

async function handleActivProfileSubmit(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('profile-error');
    
    // Validate pseudonym (required)
    const pseudonym = document.getElementById('pseudonym').value.trim();
    if (!pseudonym) {
        showError(errorDiv, 'Te rugăm să completezi un nume sau pseudonim');
        return;
    }
    
    // Validate required fields
    if (selectedZones.length === 0) {
        showError(errorDiv, 'Te rugăm să selectezi cel puțin o zonă preferată');
        return;
    }
    
    if (selectedTags.length === 0) {
        showError(errorDiv, 'Te rugăm să selectezi cel puțin un tag de interes');
        return;
    }
    
    try {
        // Get form data
        const formData = {
            pseudonym: pseudonym,
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
        
        // Update profile - USING user_id NOT id
        const { error: profileError } = await supabase
            .from('profiles')
            .update(formData)
            .eq('user_id', currentUserId);
        
        if (profileError) throw profileError;
        
        // Insert user tags
        const tagInserts = selectedTags.map(tagId => ({
            user_id: currentUserId,
            tag_id: tagId
        }));
        
        const { error: tagsError } = await supabase
            .from('user_tags')
            .insert(tagInserts);
        
        if (tagsError) throw tagsError;
        
        // Insert preferred zones
        const zoneInserts = selectedZones.map(zoneId => ({
            user_id: currentUserId,
            zone_id: zoneId
        }));
        
        const { error: zonesError } = await supabase
            .from('user_preferred_zones')
            .insert(zoneInserts);
        
        if (zonesError) throw zonesError;
        
        // Show success
        showSuccess('activ');
        
    } catch (error) {
        showError(errorDiv, 'A apărut o eroare la salvarea profilului: ' + error.message);
        console.error('Profile save error:', error);
    }
}

async function handleProfessionalProfileSubmit(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('profile-error-pro');
    
    try {
        // Get form data
        const formData = {
            agency_name: document.getElementById('agency_name').value,
            agency_website: document.getElementById('agency_website').value,
            agency_description: document.getElementById('agency_description').value || null,
            account_status: 'pending'
        };
        
        // Update profile - USING user_id NOT id
        const { error: profileError } = await supabase
            .from('profiles')
            .update(formData)
            .eq('user_id', currentUserId);
        
        if (profileError) throw profileError;
        
        // Create approval request
        const { error: approvalError } = await supabase
            .from('agency_approvals')
            .insert({
                user_id: currentUserId,
                status: 'pending'
            });
        
        if (approvalError && !approvalError.message.includes('duplicate')) {
            throw approvalError;
        }
        
        // Show success
        showSuccess('profesional');
        
    } catch (error) {
        showError(errorDiv, 'A apărut o eroare la salvarea profilului: ' + error.message);
        console.error('Profile save error:', error);
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

function showSuccess(accountType) {
    // Hide step 3
    document.getElementById('step3').classList.add('hidden');
    
    // Check for redirect URL (e.g. from invitation link)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect');
    
    // Show success message
    const successDiv = document.getElementById('success-message');
    const titleEl = document.getElementById('success-title');
    const textEl = document.getElementById('success-text');
    
    if (accountType === 'activ') {
        titleEl.textContent = 'Bine ai venit!';
        if (redirectUrl) {
            const decodedUrl = decodeURIComponent(redirectUrl);
            textEl.innerHTML = 'Contul tău a fost creat cu succes!<br><br>📧 <strong>Verifică-ți emailul</strong> pentru a confirma contul.<br>După confirmare, apasă butonul de mai jos.';
            // Update the success link to point to redirect
            const successLink = document.getElementById('success-link');
            if (successLink) {
                successLink.href = decodedUrl;
                successLink.textContent = '✓ Am confirmat — acceptă invitația';
            }
        } else {
            textEl.textContent = 'Contul tău a fost creat cu succes. Verifică-ți emailul pentru confirmare, apoi poți explora grupurile și terenurile disponibile.';
        }
    } else {
        titleEl.textContent = 'Cerere trimisă!';
        textEl.innerHTML = 'Cererea ta de înregistrare a fost trimisă.<br>Vei primi un email când contul tău este aprobat de administratori.';
    }
    
    successDiv.classList.remove('hidden');
    
    // Update step indicators
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById('step' + i + '-indicator');
        if (indicator) {
            indicator.classList.remove('opacity-40');
            indicator.querySelector('div').className = 'w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium';
        }
    }
}
