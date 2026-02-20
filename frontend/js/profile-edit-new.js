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
        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = user;
        
        // Get profile ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        // Verify user is editing their own profile
        if (profileId !== user.id) {
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
        
        if (profile.account_type === 'activ') {
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
        
        // Show success
        successDiv.classList.remove('hidden');
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = '/profile-view-new.html?id=' + currentUser.id;
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
        const formData = {
            agency_name: document.getElementById('agency_name').value,
            agency_website: document.getElementById('agency_website').value,
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
        
        // Show success
        successDiv.classList.remove('hidden');
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Redirect
        setTimeout(() => {
            window.location.href = '/profile-view-new.html?id=' + currentUser.id;
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
