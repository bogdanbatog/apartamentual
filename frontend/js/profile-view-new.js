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
            .select('id, titlu, oras, cartier, zona, suprafata, pret_total, image_url, status')
            .eq('created_by_user_id', profileId)
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
    
    // Show invite button when viewing another active user's profile (and I'm logged in and active)
    if (!isOwnProfile && currentUser && profileData.account_type === 'activ') {
        loadMyGroupsForInvite();
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
    // Dynamic section titles based on own vs other profile
    const firstName = (profileData.pseudonym || 'Utilizator').split(' ')[0];
    
    const terrainsTitle = document.getElementById('terrains-section-title');
    const terrainsEmpty = document.getElementById('terrains-empty-text');
    const groupsTitle = document.getElementById('groups-section-title');
    const groupsEmpty = document.getElementById('groups-empty-text');
    
    if (!isOwnProfile) {
        if (terrainsTitle) terrainsTitle.textContent = `Terenurile preferate ale lui ${firstName}`;
        if (terrainsEmpty) terrainsEmpty.textContent = `${firstName} nu are terenuri favorite încă.`;
        if (groupsTitle) groupsTitle.textContent = `Grupurile lui ${firstName}`;
        if (groupsEmpty) groupsEmpty.textContent = `${firstName} nu face parte din niciun grup încă.`;
    }
    
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
        
        let zoneMatchCount = 0;
        zonesEl.innerHTML = profileData.zones.map(zone => {
            const isMatch = !isOwnProfile && myZoneIds.includes(zone.id);
            if (isMatch) zoneMatchCount++;
            return isMatch
                ? `<span class="px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full text-sm">✓ ${zone.name}</span>`
                : `<span class="px-3 py-1 bg-gray-100 rounded-full text-sm">${zone.name}</span>`;
        }).join('');
        
        // Show zone matching info for other profiles
        if (!isOwnProfile && currentUser) {
            if (zoneMatchCount >= 4) {
                zonesEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        ⭐ <strong>Compatibilitate ridicată!</strong> Ai ${zoneMatchCount} zone comune cu acest utilizator.
                    </div>
                `);
            } else if (zoneMatchCount > 0) {
                zonesEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        ✓ Ai ${zoneMatchCount} ${zoneMatchCount === 1 ? 'zonă comună' : 'zone comune'} cu acest utilizator.
                    </div>
                `);
            } else {
                zonesEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                        Nu ai nicio zonă comună cu acest utilizator.
                    </div>
                `);
            }
        }
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
        if (!isOwnProfile && currentUser) {
            if (matchCount >= 4) {
                tagsEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        ⭐ <strong>Compatibilitate ridicată!</strong> Ai ${matchCount} interese comune cu acest utilizator.
                    </div>
                `);
            } else if (matchCount > 0) {
                tagsEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        ✓ Ai ${matchCount} ${matchCount === 1 ? 'interes comun' : 'interese comune'} cu acest utilizator.
                    </div>
                `);
            } else {
                tagsEl.insertAdjacentHTML('afterend', `
                    <div class="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                        Nu ai niciun interes comun cu acest utilizator.
                    </div>
                `);
            }
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
    
    // Personal Notes (only visible to profile owner)
    if (isOwnProfile) {
        const notesSection = document.getElementById('notes-section');
        const notesEl = document.getElementById('user-notes');
        if (notesSection && notesEl) {
            if (profileData.notes) {
                notesEl.textContent = profileData.notes;
            } else {
                notesEl.textContent = 'Nu ai adăugat notițe încă. Mergi la „Editează profil" pentru a adăuga.';
                notesEl.style.color = '#9ca3af';
                notesEl.style.fontStyle = 'italic';
            }
            notesSection.classList.remove('hidden');
        }
    }
    
    // Favorite Terrains
    await renderFavoriteTerrains();
    
    // Groups
    renderUserGroups();
}

async function renderFavoriteTerrains() {
    const container = document.getElementById('favorite-terrains');
    
    if (!profileData.favoriteTerrains || profileData.favoriteTerrains.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Nu ai terenuri favorite încă.</p>';
        return;
    }

    // Load notes for all favorite terrains (only for own profile)
    let notesMap = {};
    if (isOwnProfile && currentUser) {
        try {
            const terenIds = profileData.favoriteTerrains.map(t => t.id);
            const { data, error } = await supabase
                .from('user_teren_notes')
                .select('id, teren_id, content, updated_at')
                .eq('user_id', currentUser.id)
                .in('teren_id', terenIds);
            if (!error && data) {
                data.forEach(n => { notesMap[n.teren_id] = n; });
            }
        } catch (e) {
            console.error('Load notes error:', e);
        }
    }
    
    container.innerHTML = profileData.favoriteTerrains.map(terrain => {
        const location = [terrain.oras, terrain.cartier].filter(Boolean).join(', ') || 'Locație nespecificată';
        const price = terrain.pret_total ? Number(terrain.pret_total).toLocaleString('ro-RO') + ' €' : '-';
        const surface = terrain.suprafata ? terrain.suprafata + ' mp' : '-';
        const note = notesMap[terrain.id] || null;
        const hasNote = note && note.content;
        
        let noteHtml = '';
        if (isOwnProfile) {
            noteHtml = `
                <div class="teren-note-section" data-teren="${terrain.id}" data-note-id="${hasNote ? note.id : ''}">
                    <div class="teren-note-wrapper">
                        <div class="teren-note-header">
                            <span class="teren-note-label">
                                <i class="fas fa-sticky-note"></i> Nota mea
                            </span>
                            ${hasNote ? '<span class="teren-note-time">' + _noteTimeAgo(note.updated_at) + '</span>' : ''}
                        </div>
                        <div class="teren-note-display ${hasNote ? '' : 'tn-hidden'}" id="note-display-${terrain.id}">
                            <p class="teren-note-text">${hasNote ? _noteEscape(note.content) : ''}</p>
                            <div class="teren-note-actions">
                                <button class="note-btn-edit" onclick="_noteEdit('${terrain.id}')" title="Editeaza">
                                    <i class="fas fa-pen"></i>
                                </button>
                                <button class="note-btn-delete" onclick="_noteDelete('${terrain.id}')" title="Sterge nota">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="teren-note-editor ${hasNote ? 'tn-hidden' : ''}" id="note-editor-${terrain.id}">
                            <textarea id="note-input-${terrain.id}" placeholder="Adauga o nota privata despre acest teren..." maxlength="5000" rows="2">${hasNote ? _noteEscape(note.content) : ''}</textarea>
                            <div class="teren-note-editor-actions">
                                ${hasNote ? '<button class="note-btn-cancel" onclick="_noteCancel(\'' + terrain.id + '\')">Anuleaza</button>' : ''}
                                <button class="note-btn-save" onclick="_noteSave('${terrain.id}')">
                                    <i class="fas fa-check"></i> Salveaza
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="teren-fav-card">
                <a href="teren-details.html?id=${terrain.id}" class="flex items-center gap-4 p-4 border rounded-lg hover:border-gray-400 hover:shadow-sm transition" style="border-bottom-left-radius:${isOwnProfile ? '0' : ''};border-bottom-right-radius:${isOwnProfile ? '0' : ''}">
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
                <div class="teren-fav-actions">
                    <a href="teren-details.html?id=${terrain.id}#analiza" class="btn-cere-analiza-sm">
                        <i class="fas fa-chart-bar"></i> Cere o analiză
                    </a>
                </div>
                ${noteHtml}
            </div>
        `;
    }).join('');
}

// ── NOTES FUNCTIONS ──

function _noteEscape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _noteTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const mins = Math.floor((now - date) / 60000);
    if (mins < 1) return 'acum';
    if (mins < 60) return 'acum ' + mins + ' min';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return 'acum ' + hrs + 'h';
    const days = Math.floor(hrs / 24);
    if (days < 30) return 'acum ' + days + 'z';
    return 'acum ' + Math.floor(days / 30) + ' luni';
}

window._noteEdit = function(terenId) {
    const display = document.getElementById('note-display-' + terenId);
    const editor = document.getElementById('note-editor-' + terenId);
    if (display) display.classList.add('tn-hidden');
    if (editor) {
        editor.classList.remove('tn-hidden');
        const ta = document.getElementById('note-input-' + terenId);
        if (ta) ta.focus();
    }
};

window._noteCancel = function(terenId) {
    const display = document.getElementById('note-display-' + terenId);
    const editor = document.getElementById('note-editor-' + terenId);
    if (display) display.classList.remove('tn-hidden');
    if (editor) editor.classList.add('tn-hidden');
};

window._noteSave = async function(terenId) {
    const ta = document.getElementById('note-input-' + terenId);
    if (!ta) return;
    const content = ta.value.trim();
    if (!content || !currentUser) return;

    ta.disabled = true;
    const section = document.querySelector('.teren-note-section[data-teren="' + terenId + '"]');
    const existingId = section ? section.getAttribute('data-note-id') : '';

    try {
        let result;
        if (existingId) {
            result = await supabase
                .from('user_teren_notes')
                .update({ content: content, updated_at: new Date().toISOString() })
                .eq('id', existingId)
                .select()
                .single();
        } else {
            result = await supabase
                .from('user_teren_notes')
                .insert({ user_id: currentUser.id, teren_id: terenId, content: content })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        // Re-render all favorite terrains to reflect changes
        await renderFavoriteTerrains();

    } catch (e) {
        console.error('Save note error:', e);
        alert('Eroare la salvarea notei.');
    } finally {
        ta.disabled = false;
    }
};

window._noteDelete = async function(terenId) {
    const section = document.querySelector('.teren-note-section[data-teren="' + terenId + '"]');
    const noteId = section ? section.getAttribute('data-note-id') : '';
    if (!noteId) return;
    if (!confirm('Stergi nota?')) return;

    try {
        const { error } = await supabase
            .from('user_teren_notes')
            .delete()
            .eq('id', noteId);

        if (error) throw error;
        await renderFavoriteTerrains();

    } catch (e) {
        console.error('Delete note error:', e);
        alert('Eroare la stergerea notei.');
    }
};

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
            'deschis': 'bg-green-100 text-green-800',
            'cu_aprobare': 'bg-yellow-100 text-yellow-800',
            // Legacy
            'activ': 'bg-green-100 text-green-800',
            'explorare': 'bg-yellow-100 text-yellow-800',
            'inchis': 'bg-yellow-100 text-yellow-800'
        };
        const statusLabel = {
            'deschis': 'Deschis',
            'cu_aprobare': 'Cu aprobare',
            // Legacy
            'activ': 'Deschis',
            'explorare': 'Cu aprobare',
            'inchis': 'Cu aprobare'
        };
        const groupStatus = group.status || 'deschis';
        
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
    
    terrainsContainer.innerHTML = profileData.postedTerrains.map(terrain => {
        const statusColors = {
            'approved': 'bg-green-100 text-green-800',
            'pending': 'bg-yellow-100 text-yellow-800',
            'rejected': 'bg-red-100 text-red-800'
        };
        const statusLabels = {
            'approved': 'Aprobat',
            'pending': 'În așteptare',
            'rejected': 'Respins'
        };
        const sc = statusColors[terrain.status] || 'bg-gray-100 text-gray-600';
        const sl = statusLabels[terrain.status] || terrain.status;
        return `
        <a href="teren-details.html?id=${terrain.id}" class="block p-4 border rounded-lg hover:border-gray-400 transition">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium">${terrain.titlu}</p>
                    <p class="text-sm text-gray-500">${terrain.oras || '-'}${terrain.cartier ? ', ' + terrain.cartier : ''} • ${terrain.suprafata || '-'} mp</p>
                </div>
                <span class="px-2 py-0.5 ${sc} rounded text-xs">${sl}</span>
            </div>
        </a>
    `}).join('');
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

// =====================================================
// INLINE NOTES EDITING
// =====================================================

function toggleNotesEdit() {
    const viewMode = document.getElementById('notes-view-mode');
    const editMode = document.getElementById('notes-edit-mode');
    const editBtn = document.getElementById('notes-edit-btn');
    const textarea = document.getElementById('notes-textarea');
    
    viewMode.classList.add('hidden');
    editMode.classList.remove('hidden');
    editBtn.classList.add('hidden');
    
    // Populate textarea with current notes
    textarea.value = profileData.notes || '';
    textarea.focus();
}

function cancelNotesEdit() {
    const viewMode = document.getElementById('notes-view-mode');
    const editMode = document.getElementById('notes-edit-mode');
    const editBtn = document.getElementById('notes-edit-btn');
    
    editMode.classList.add('hidden');
    viewMode.classList.remove('hidden');
    editBtn.classList.remove('hidden');
}

async function saveNotes() {
    const textarea = document.getElementById('notes-textarea');
    const newNotes = textarea.value.trim() || null;
    const statusEl = document.getElementById('notes-save-status');
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ notes: newNotes })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Update local data
        profileData.notes = newNotes;
        
        // Update view
        const notesEl = document.getElementById('user-notes');
        if (newNotes) {
            notesEl.textContent = newNotes;
            notesEl.style.color = '';
            notesEl.style.fontStyle = '';
        } else {
            notesEl.textContent = 'Nu ai adăugat notițe încă.';
            notesEl.style.color = '#9ca3af';
            notesEl.style.fontStyle = 'italic';
        }
        
        // Switch back to view mode
        cancelNotesEdit();
        
        // Show save confirmation
        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 2000);
        
    } catch (e) {
        console.error('Error saving notes:', e);
        alert('Eroare la salvarea notițelor: ' + e.message);
    }
}

// =====================================================
// INVITE TO GROUP (from profile page)
// =====================================================

let myGroupsForInvite = [];

async function loadMyGroupsForInvite() {
    try {
        // Check my own account type first
        const { data: myProfile } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('user_id', currentUser.id)
            .single();
        
        if (!myProfile || myProfile.account_type !== 'activ') return;
        
        // Get ALL groups where I'm an active member (not just admin)
        const { data: memberships } = await supabase
            .from('grup_membri')
            .select('grup_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'activ');
        
        if (memberships && memberships.length > 0) {
            const groupIds = memberships.map(m => m.grup_id);
            const { data: groups } = await supabase
                .from('grupuri')
                .select('id, nume')
                .in('id', groupIds)
                .neq('status', 'arhivat');
            
            myGroupsForInvite = groups || [];
        } else {
            myGroupsForInvite = [];
        }
        
        // Always show the invite buttons container
        const container = document.getElementById('invite-to-group-container');
        if (container) {
            container.classList.remove('hidden');
            container.style.display = 'flex';
        }
        
        // Show "Invită pe grupurile tale" button only if user has groups
        const existingContainer = document.getElementById('invite-existing-group-container');
        if (existingContainer && myGroupsForInvite.length > 0) {
            existingContainer.classList.remove('hidden');
            existingContainer.style.display = 'flex';
        }
    } catch (e) {
        console.error('Error loading groups for invite:', e);
    }
}

window.handleInviteToGroup = async function() {
    // "Creează un grup și invită" always goes to create
    window.location.href = 'grup-nou.html';
}

window.toggleExistingGroupDropdown = function() {
    const dropdown = document.getElementById('group-select-dropdown');
    const list = document.getElementById('group-select-list');
    
    if (!dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        return;
    }
    
    list.innerHTML = myGroupsForInvite.map((g, i) => `
        <button class="group-invite-btn" data-index="${i}"
                style="display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; 
                       border: none; background: none; border-radius: 6px; cursor: pointer; 
                       font-size: 0.875rem; color: #1e293b; transition: background 0.15s;"
                onmouseover="this.style.background='#f1f5f9'" 
                onmouseout="this.style.background='none'">
            ${escapeHtml(g.nume)}
        </button>
    `).join('');
    
    // Attach click handlers
    list.querySelectorAll('.group-invite-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            const g = myGroupsForInvite[idx];
            if (g) sendProfileInvite(g.id, g.nume);
        });
    });
    
    dropdown.classList.remove('hidden');
}

window.sendProfileInvite = async function(groupId, groupName) {
    const targetUserId = profileData.user_id;
    const targetName = profileData.pseudonym || 'Utilizator';
    const targetEmail = profileData.email;
    
    try {
        // Check if already a member
        const { data: existingMember } = await supabase
            .from('grup_membri')
            .select('id')
            .eq('grup_id', groupId)
            .eq('user_id', targetUserId)
            .maybeSingle();
        
        if (existingMember) {
            showToast(`${targetName} este deja în grupul „${groupName}".`, 'error');
            return;
        }
        
        // Check if already invited
        if (targetEmail) {
            const { data: existingInvite } = await supabase
                .from('grup_invitations')
                .select('id, status')
                .eq('grup_id', groupId)
                .eq('invited_email', targetEmail.toLowerCase())
                .in('status', ['pending', 'accepted'])
                .maybeSingle();
            
            if (existingInvite) {
                showToast(existingInvite.status === 'accepted' 
                    ? `${targetName} a acceptat deja invitația.` 
                    : `${targetName} a fost deja invitat.`, 'error');
                return;
            }
        }
        
        if (targetEmail) {
            // Create invitation with token
            const { data: newInvite, error: insertError } = await supabase
                .from('grup_invitations')
                .insert({
                    grup_id: groupId,
                    invited_email: targetEmail.toLowerCase(),
                    invited_by: currentUser.id
                })
                .select('token')
                .single();
            
            if (insertError) throw insertError;
            
            // Build invite link
            const inviteLink = `${window.location.origin}/accept-invite.html?token=${newInvite.token}&grup=${encodeURIComponent(groupName)}`;
            
            // Get inviter name
            const { data: myProf } = await supabase.from('profiles').select('pseudonym').eq('user_id', currentUser.id).single();
            const myName = myProf?.pseudonym || 'Un membru';
            
            // 1. Send email to the invited person
            if (typeof notifyAdmins === 'function') {
                notifyAdmins('invitation_sent', {
                    group_name: groupName,
                    group_id: groupId,
                    invite_link: inviteLink,
                    invited_by: myName,
                    admin_email: targetEmail
                });
            }
            
            // 2. Notify group admin that a member invited someone
            const { data: groupData } = await supabase.from('grupuri').select('admin_id').eq('id', groupId).single();
            if (groupData && groupData.admin_id) {
                const { data: adminProf } = await supabase.from('profiles').select('email').eq('user_id', groupData.admin_id).single();
                if (adminProf && adminProf.email && typeof notifyAdmins === 'function') {
                    notifyAdmins('member_invited_someone', {
                        group_name: groupName,
                        group_id: groupId,
                        invited_name: targetName,
                        invited_by: myName,
                        admin_email: adminProf.email
                    });
                }
            }
        } else {
            // No email — create pending member, notify admin
            const { error: joinError } = await supabase
                .from('grup_membri')
                .insert({
                    grup_id: groupId,
                    user_id: targetUserId,
                    status: 'pending',
                    rol: 'membru'
                });
            
            if (joinError) {
                if (joinError.code === '23505') {
                    showToast(`${targetName} are deja o cerere pentru „${groupName}".`, 'error');
                } else {
                    throw joinError;
                }
                return;
            }
            
            // Notify group admin
            const { data: groupData } = await supabase.from('grupuri').select('admin_id').eq('id', groupId).single();
            if (groupData && groupData.admin_id) {
                const { data: adminProf } = await supabase.from('profiles').select('email').eq('user_id', groupData.admin_id).single();
                const { data: myProf } = await supabase.from('profiles').select('pseudonym').eq('user_id', currentUser.id).single();
                if (adminProf && adminProf.email && typeof notifyAdmins === 'function') {
                    notifyAdmins('member_invited_someone', {
                        group_name: groupName,
                        group_id: groupId,
                        invited_name: targetName,
                        invited_by: myProf?.pseudonym || 'Un membru',
                        admin_email: adminProf.email
                    });
                }
            }
        }
        
        showToast(`Invitație trimisă lui ${targetName} pe „${groupName}".`, 'success');
        
        // Hide dropdown
        const dropdown = document.getElementById('group-select-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
    } catch (e) {
        console.error('Error sending invite from profile:', e);
        showToast('Eroare la trimiterea invitației.', 'error');
    }
}

function showToast(msg, type) {
    // Check if showToast already exists globally (from nav.js)
    if (window._originalShowToast) { window._originalShowToast(msg, type); return; }
    
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);padding:0.75rem 1.5rem;border-radius:8px;color:white;font-size:0.875rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    toast.style.background = type === 'error' ? '#dc2626' : '#059669';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
// Preserve original if exists
if (typeof window.showToast === 'function') window._originalShowToast = window.showToast;
