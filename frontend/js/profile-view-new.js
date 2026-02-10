// Profile View Page - New Version
// ApartamenTUal Platform

let profileData = null;
let isOwnProfile = false;
let currentUser = null;

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for supabase to be initialized by app.js
    await waitForSupabase();
    await initProfilePage();
});

// Wait for supabase client to be available
function waitForSupabase() {
    return new Promise((resolve) => {
        if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
            resolve();
            return;
        }
        const interval = setInterval(() => {
            if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
                clearInterval(interval);
                resolve();
            }
        }, 50);
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(interval);
            resolve();
        }, 5000);
    });
}

async function initProfilePage() {
    try {
        // Verify supabase is available
        if (typeof supabase === 'undefined' || !supabase || !supabase.auth) {
            showError('Eroare la inițializarea aplicației. Reîncărcați pagina.');
            return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        let profileId = urlParams.get('id');
        
        // Get current user (may be null if not logged in)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            currentUser = user;
        } catch (authError) {
            console.warn('Auth check failed (user may not be logged in):', authError);
            currentUser = null;
        }
        
        // If no ID in URL, use current user's ID (viewing own profile)
        if (!profileId) {
            if (currentUser) {
                profileId = currentUser.id;
                // Update URL without reload
                window.history.replaceState({}, '', `profile-view-new.html?id=${profileId}`);
            } else {
                showError('Trebuie să fii autentificat pentru a vedea profilul');
                return;
            }
        }
        
        isOwnProfile = currentUser && currentUser.id === profileId;
        
        await loadProfile(profileId);
        
    } catch (error) {
        console.error('Init error:', error);
        showError('A apărut o eroare la încărcarea paginii');
    }
}

// =====================================================
// DATA LOADING
// =====================================================

async function loadProfile(profileId) {
    try {
        // First get the profile without the join
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', profileId)
            .single();
        
        if (profileError) throw profileError;
        if (!profile) {
            showError('Profilul nu a fost găsit');
            return;
        }
        
        // If profile has a preferred city, fetch it separately
        if (profile.preferred_city_id) {
            const { data: city } = await supabase
                .from('cities')
                .select('id, name')
                .eq('id', profile.preferred_city_id)
                .single();
            profile.preferred_city = city;
        } else {
            profile.preferred_city = null;
        }
        
        profileData = profile;
        
        if (profile.account_type === 'activ') {
            await loadActiveUserData(profileId);
        } else {
            await loadProfessionalUserData(profileId);
        }
        
        renderProfile();
        
    } catch (error) {
        console.error('Load profile error:', error);
        showError('Nu am putut încărca profilul: ' + error.message);
    }
}

async function loadActiveUserData(profileId) {
    try {
        // Load user tags
        const { data: userTags } = await supabase
            .from('user_tags')
            .select('tag_id, tags(id, name, category)')
            .eq('user_id', profileId);
        
        profileData.tags = userTags?.map(ut => ut.tags) || [];
        
        // Load preferred zones
        const { data: userZones } = await supabase
            .from('user_preferred_zones')
            .select('zone_id, zones(id, name, city_id)')
            .eq('user_id', profileId);
        
        profileData.zones = userZones?.map(uz => uz.zones) || [];
        
        // Load user's groups
        const { data: memberships, error: groupsError } = await supabase
            .from('grup_membri')
            .select('grup_id, status')
            .eq('user_id', profileId)
            .eq('status', 'activ');
        
        if (groupsError) {
            console.error('Error loading groups:', groupsError);
            profileData.groups = [];
        } else if (memberships && memberships.length > 0) {
            // Load group details separately
            const groupIds = memberships.map(m => m.grup_id);
            const { data: groups } = await supabase
                .from('grupuri')
                .select('id, nume, descriere, oras, status, admin_id')
                .in('id', groupIds);
            
            profileData.groups = memberships.map(m => ({
                ...m,
                grupuri: groups?.find(g => g.id === m.grup_id) || null
            })).filter(m => m.grupuri);
        } else {
            profileData.groups = [];
        }
        
        // Load favorite terrains (from terenuri_likes)
        const { data: likes } = await supabase
            .from('terenuri_likes')
            .select('teren_id, terenuri(id, titlu, oras, cartier, suprafata, pret_total, image_url, status)')
            .eq('user_id', profileId);
        
        // Filter only approved terrains
        profileData.favoriteTerrains = likes
            ?.filter(l => l.terenuri && l.terenuri.status === 'approved')
            ?.map(l => l.terenuri) || [];
        
    } catch (error) {
        console.error('Load active user data error:', error);
    }
}

async function loadProfessionalUserData(profileId) {
    try {
        const { data: terrains } = await supabase
            .from('terenuri')
            .select('id, titlu, oras, zona, suprafata_mp, pret_total, status')
            .eq('posted_by', profileId)
            .order('created_at', { ascending: false });
        
        profileData.postedTerrains = terrains || [];
        
    } catch (error) {
        console.error('Load professional user data error:', error);
    }
}

// =====================================================
// RENDERING
// =====================================================

async function renderProfile() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('profile-content').classList.remove('hidden');
    
    renderBasicInfo();
    
    if (profileData.account_type === 'activ') {
        document.getElementById('active-user-content').classList.remove('hidden');
        await renderActiveUserContent();
    } else {
        document.getElementById('professional-user-content').classList.remove('hidden');
        renderProfessionalContent();
    }
    
    if (isOwnProfile) {
        document.getElementById('edit-button-container').classList.remove('hidden');
        document.getElementById('edit-profile-btn').href = 'profile-edit-new.html?id=' + profileData.user_id;
        document.getElementById('progress-section').classList.remove('hidden');
        renderProgressBar();
    }
}

function renderBasicInfo() {
    // Avatar
    const avatar = document.getElementById('profile-avatar');
    const name = profileData.account_type === 'activ' 
        ? (profileData.pseudonym || 'Utilizator')
        : (profileData.agency_name || 'Agenție');
    avatar.textContent = name.charAt(0).toUpperCase();
    avatar.className = profileData.account_type === 'activ'
        ? 'w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold'
        : 'w-24 h-24 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-3xl font-bold';
    
    // Name
    document.getElementById('profile-name').textContent = name;
    
    // Account type badge
    const typeBadge = document.getElementById('account-type-badge');
    if (profileData.account_type === 'activ') {
        typeBadge.textContent = 'Utilizator Activ';
        typeBadge.className = 'px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm';
    } else {
        typeBadge.textContent = 'Agenție Imobiliară';
        typeBadge.className = 'px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm';
    }
    
    // Account status (for pending agencies)
    if (profileData.account_status === 'pending') {
        const statusBadge = document.getElementById('account-status-badge');
        statusBadge.textContent = 'În așteptare aprobare';
        statusBadge.className = 'px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm';
        statusBadge.classList.remove('hidden');
    }
    
    // Profession (for active users)
    const professionEl = document.getElementById('profile-profession');
    if (profileData.account_type === 'activ' && profileData.profession) {
        professionEl.textContent = profileData.profession;
    } else {
        professionEl.classList.add('hidden');
    }
    
    // City
    const cityEl = document.getElementById('profile-city');
    if (profileData.preferred_city) {
        cityEl.querySelector('span:last-child').textContent = profileData.preferred_city.name;
    } else {
        cityEl.classList.add('hidden');
    }
    
    // Joined date
    const joinedEl = document.getElementById('profile-joined');
    if (profileData.created_at) {
        const date = new Date(profileData.created_at);
        joinedEl.querySelector('span:last-child').textContent = 'Membru din ' + date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
    }
    
    // Email (if public)
    const emailEl = document.getElementById('profile-email');
    if (profileData.email && (profileData.account_type === 'profesional' || profileData.is_email_public)) {
        emailEl.querySelector('span:last-child').textContent = profileData.email;
        emailEl.classList.remove('hidden');
    }
    
    // Age (if public)
    const ageEl = document.getElementById('profile-age');
    if (profileData.is_age_public && profileData.age) {
        ageEl.querySelector('span:last-child').textContent = profileData.age + ' ani';
        ageEl.classList.remove('hidden');
    }
}

async function renderActiveUserContent() {
    // Apartment preferences
    const roomsEl = document.getElementById('pref-rooms');
    roomsEl.textContent = profileData.preferred_rooms ? profileData.preferred_rooms + ' camere' : '-';
    
    const areaEl = document.getElementById('pref-area');
    areaEl.textContent = profileData.preferred_area_sqm ? profileData.preferred_area_sqm + ' mp' : '-';
    
    // Zones
    const zonesEl = document.getElementById('pref-zones');
    if (profileData.zones && profileData.zones.length > 0) {
        // Load current user's zones for matching
        let myZoneIds = [];
        if (!isOwnProfile && currentUser) {
            try {
                const { data: myZones } = await supabase
                    .from('user_preferred_zones')
                    .select('zone_id')
                    .eq('user_id', currentUser.id);
                myZoneIds = (myZones || []).map(z => z.zone_id);
            } catch(e) {}
        }
        
        zonesEl.innerHTML = profileData.zones.map(zone => {
            const isMatch = !isOwnProfile && myZoneIds.includes(zone.id);
            return isMatch
                ? `<span class="px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full text-sm">✓ ${zone.name}</span>`
                : `<span class="px-3 py-1 bg-gray-100 rounded-full text-sm">${zone.name}</span>`;
        }).join('');
    } else {
        zonesEl.innerHTML = '<span class="text-gray-400">-</span>';
    }
    
    // Tags
    const tagsEl = document.getElementById('user-tags');
    if (profileData.tags && profileData.tags.length > 0) {
        // Load current user's tags for matching
        let myTagIds = [];
        if (!isOwnProfile && currentUser) {
            try {
                const { data: myTags } = await supabase
                    .from('user_tags')
                    .select('tag_id')
                    .eq('user_id', currentUser.id);
                myTagIds = (myTags || []).map(t => t.tag_id);
            } catch(e) {}
        }
        
        let matchCount = 0;
        tagsEl.innerHTML = profileData.tags.map(tag => {
            const isMatch = !isOwnProfile && myTagIds.includes(tag.id);
            if (isMatch) matchCount++;
            return isMatch
                ? `<span class="px-3 py-1.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full text-sm">✓ ${tag.name}</span>`
                : `<span class="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm">${tag.name}</span>`;
        }).join('');
        
        // Show matching info for other profiles
        if (!isOwnProfile && matchCount >= 4) {
            tagsEl.insertAdjacentHTML('afterend', `
                <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    ⭐ <strong>Compatibilitate ridicată!</strong> Ai ${matchCount} interese comune cu acest utilizator.
                </div>
            `);
        } else if (!isOwnProfile && matchCount > 0) {
            tagsEl.insertAdjacentHTML('afterend', `
                <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    ✓ Ai ${matchCount} ${matchCount === 1 ? 'interes comun' : 'interese comune'} cu acest utilizator.
                </div>
            `);
        }
    } else {
        tagsEl.innerHTML = '<span class="text-gray-400">Niciun tag selectat</span>';
    }
    
    // Description
    const descSection = document.getElementById('description-section');
    const descEl = document.getElementById('user-description');
    if (profileData.description) {
        descEl.textContent = profileData.description;
        descSection.classList.remove('hidden');
    }
    
    // Favorite Terrains
    renderFavoriteTerrains();
    
    // Groups
    renderUserGroups();
}

function renderFavoriteTerrains() {
    const container = document.getElementById('favorite-terrains');
    
    if (!profileData.favoriteTerrains || profileData.favoriteTerrains.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Nu ai terenuri favorite încă.</p>';
        return;
    }
    
    container.innerHTML = profileData.favoriteTerrains.map(terrain => {
        const location = [terrain.oras, terrain.cartier].filter(Boolean).join(', ') || 'Locație nespecificată';
        const price = terrain.pret_total ? Number(terrain.pret_total).toLocaleString('ro-RO') + ' €' : '-';
        const surface = terrain.suprafata ? terrain.suprafata + ' mp' : '-';
        
        return `
            <a href="teren-details.html?id=${terrain.id}" class="flex items-center gap-4 p-4 border rounded-lg hover:border-gray-400 hover:shadow-sm transition">
                <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    ${terrain.image_url 
                        ? `<img src="${terrain.image_url}" alt="${terrain.titlu}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full flex items-center justify-center text-gray-400">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                          </div>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">${terrain.titlu}</p>
                    <p class="text-sm text-gray-500">${location}</p>
                    <p class="text-sm"><span class="text-orange-600 font-medium">${price}</span> • ${surface}</p>
                </div>
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </a>
        `;
    }).join('');
}

function renderUserGroups() {
    const container = document.getElementById('user-groups');
    
    if (!profileData.groups || profileData.groups.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Nu faci parte din niciun grup încă.</p>';
        return;
    }
    
    container.innerHTML = profileData.groups.map(membership => {
        const group = membership.grupuri;
        if (!group) return '';
        
        const isAdmin = group.admin_id === profileData.user_id;
        const statusBadge = isAdmin
            ? '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">Admin</span>'
            : '';
        
        const statusColors = {
            'activ': 'bg-green-100 text-green-800',
            'explorare': 'bg-blue-100 text-blue-800',
            'inchis': 'bg-gray-100 text-gray-600'
        };
        const statusLabel = {
            'activ': 'Activ',
            'explorare': 'În explorare',
            'inchis': 'Închis'
        };
        const groupStatus = group.status || 'explorare';
        
        return `
            <a href="grup-details.html?id=${group.id}" class="block p-4 border rounded-lg hover:border-gray-400 transition">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium">${group.nume}</p>
                        <p class="text-sm text-gray-500">${group.oras || '-'}</p>
                    </div>
                    <div class="flex gap-2">
                        ${statusBadge}
                        <span class="px-2 py-0.5 ${statusColors[groupStatus]} rounded text-xs">${statusLabel[groupStatus]}</span>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

function renderProfessionalContent() {
    const agencyEmailEl = document.getElementById('agency-email');
    if (agencyEmailEl && profileData.email) {
        agencyEmailEl.textContent = profileData.email;
        agencyEmailEl.href = 'mailto:' + profileData.email;
    }
    // Website
    const websiteEl = document.getElementById('agency-website');
    if (profileData.agency_website) {
        websiteEl.href = profileData.agency_website;
        websiteEl.textContent = profileData.agency_website.replace(/^https?:\/\//, '');
    } else {
        websiteEl.textContent = '-';
        websiteEl.removeAttribute('href');
    }
    
    // Description
    const descEl = document.getElementById('agency-description');
    descEl.textContent = profileData.agency_description || '-';
    
    // Posted terrains
    const terrainsContainer = document.getElementById('agency-terrains');
    if (!profileData.postedTerrains || profileData.postedTerrains.length === 0) {
        terrainsContainer.innerHTML = '<p class="text-gray-400 text-sm">Niciun teren postat încă.</p>';
        return;
    }
    
    terrainsContainer.innerHTML = profileData.postedTerrains.map(terrain => `
        <a href="teren-details.html?id=${terrain.id}" class="block p-4 border rounded-lg hover:border-gray-400 transition">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium">${terrain.titlu}</p>
                    <p class="text-sm text-gray-500">${terrain.oras || '-'} • ${terrain.suprafata_mp || '-'} mp</p>
                </div>
                <span class="px-2 py-0.5 ${terrain.status === 'activ' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} rounded text-xs">
                    ${terrain.status === 'activ' ? 'Activ' : 'Inactiv'}
                </span>
            </div>
        </a>
    `).join('');
}

function renderProgressBar() {
    const completion = calculateCompletion();
    
    document.getElementById('progress-percentage').textContent = completion + '%';
    document.getElementById('progress-bar').style.width = completion + '%';
    
    // Color based on completion
    const bar = document.getElementById('progress-bar');
    if (completion < 50) {
        bar.className = 'bg-red-500 h-2 rounded-full transition-all duration-500';
    } else if (completion < 80) {
        bar.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-500';
    } else {
        bar.className = 'bg-green-500 h-2 rounded-full transition-all duration-500';
    }
    
    // Hint text
    const hintEl = document.getElementById('progress-hint');
    if (completion < 100) {
        const missing = getMissingFields();
        hintEl.textContent = 'Completează: ' + missing.join(', ');
    } else {
        hintEl.textContent = 'Profilul tău este complet! 🎉';
    }
}

function calculateCompletion() {
    if (profileData.account_type === 'activ') {
        const fields = [
            profileData.pseudonym,
            profileData.profession,
            profileData.phone,
            profileData.age,
            profileData.preferred_rooms,
            profileData.preferred_area_sqm,
            profileData.preferred_city_id,
            profileData.zones && profileData.zones.length > 0,
            profileData.tags && profileData.tags.length > 0,
            profileData.description
        ];
        const filled = fields.filter(f => f).length;
        return Math.round((filled / fields.length) * 100);
    } else {
        const fields = [
            profileData.agency_name,
            profileData.agency_website,
            profileData.agency_description
        ];
        const filled = fields.filter(f => f).length;
        return Math.round((filled / fields.length) * 100);
    }
}

function getMissingFields() {
    const missing = [];
    
    if (profileData.account_type === 'activ') {
        if (!profileData.pseudonym) missing.push('nume');
        if (!profileData.profession) missing.push('profesie');
        if (!profileData.phone) missing.push('telefon');
        if (!profileData.age) missing.push('vârstă');
        if (!profileData.preferred_rooms) missing.push('nr. camere');
        if (!profileData.preferred_area_sqm) missing.push('suprafață');
        if (!profileData.preferred_city_id) missing.push('oraș');
        if (!profileData.zones || profileData.zones.length === 0) missing.push('zone');
        if (!profileData.tags || profileData.tags.length === 0) missing.push('interese');
        if (!profileData.description) missing.push('descriere');
    } else {
        if (!profileData.agency_name) missing.push('nume agenție');
        if (!profileData.agency_website) missing.push('website');
        if (!profileData.agency_description) missing.push('descriere');
    }
    
    return missing;
}

// =====================================================
// ERROR HANDLING
// =====================================================

function showError(message) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
}
