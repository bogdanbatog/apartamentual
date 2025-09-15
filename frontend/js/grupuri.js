let allGrupuri = [];
let filteredGrupuri = [];

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const grupuriListEl = document.getElementById('grupuri-list');
const noResultsEl = document.getElementById('no-results');
const retryBtn = document.getElementById('retry-btn');
const locationFilter = document.getElementById('location-filter');
const statusFilter = document.getElementById('status-filter');
const typeFilter = document.getElementById('type-filter');

// Status mapping for display
const statusMapping = {
    'active': { text: 'În formare', class: 'bg-green-100 text-green-800' },
    'inactive': { text: 'Inactiv', class: 'bg-gray-100 text-gray-800' },
    'full': { text: 'Complet', class: 'bg-blue-100 text-blue-800' },
    'completed': { text: 'Finalizat', class: 'bg-purple-100 text-purple-800' },
    'cancelled': { text: 'Anulat', class: 'bg-red-100 text-red-800' }
};

// Type mapping for display
const typeMapping = {
    'Apartamente': { text: 'Apartamente', class: 'bg-blue-100 text-blue-800' },
    'Case': { text: 'Case', class: 'bg-green-100 text-green-800' },
    'Mixt': { text: 'Mixt', class: 'bg-purple-100 text-purple-800' }
};

// Initialize the groups page
function initGrupuri() {
    try {
        // Set up event listeners
        setupEventListeners();
        
        // Load groups data
        loadGrupuri();
        
    } catch (error) {
        showError('Error initializing groups page: ' + error.message);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Filter event listeners
    if (locationFilter) {
        locationFilter.addEventListener('change', applyFilters);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }
    
    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', loadGrupuri);
    }
}

// Load groups from database
async function loadGrupuri() {
    try {
        showLoading(true);
        hideError();
        
        const { data, error } = await supabase
            .from('grup')
            .select(`
                *,
                grup_membership!inner(
                    id,
                    status,
                    role
                )
            `)
            .eq('is_disabled', false)
            .eq('is_public', true)
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        // Process the data to include member counts
        allGrupuri = data.map(grup => {
            const approvedMembers = grup.grup_membership.filter(member => member.status === 'approved');
            return {
                ...grup,
                current_members: approvedMembers.length,
                member_count: `${approvedMembers.length}/${grup.max_members}`
            };
        });
        
        filteredGrupuri = [...allGrupuri];
        renderGrupuri();
        
    } catch (error) {
        console.error('Error loading groups:', error);
        showError('Eroare la încărcarea grupurilor: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Render groups to the page
function renderGrupuri() {
    if (!grupuriListEl) return;
    
    if (filteredGrupuri.length === 0) {
        showNoResults();
        return;
    }
    
    // Hide no results message when there are results
    hideNoResults();
    
    const html = filteredGrupuri.map(grup => createGrupCard(grup)).join('');
    grupuriListEl.innerHTML = html;
}

// Create HTML for a single group card
function createGrupCard(grup) {
    const statusInfo = statusMapping[grup.status] || { text: grup.status, class: 'bg-gray-100 text-gray-800' };
    const createdDate = new Date(grup.created_at).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    // Determine group type based on description or other criteria
    const groupType = determineGroupType(grup);
    const typeInfo = typeMapping[groupType] || { text: groupType, class: 'bg-gray-100 text-gray-800' };
    
    // Generate tags based on group characteristics
    const tags = generateGroupTags(grup);
    
    return `
        <div class="card">
            ${grup.image_url ? `
                <div class="w-full h-48 bg-gray-200 rounded-lg overflow-hidden mb-4">
                    <img src="${grup.image_url}" alt="${escapeHtml(grup.nume)}" class="w-full h-full object-cover" 
                         onerror="this.parentElement.style.display='none'">
                </div>
            ` : ''}
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg">${escapeHtml(grup.nume)}</h3>
                <span class="badge ${statusInfo.class}">${statusInfo.text}</span>
            </div>
            <p class="subtitle mb-4">${escapeHtml(grup.descriere || '')}</p>
            <div class="grid grid-cols-2 gap-2 text-sm mb-4">
                <div><strong>Locație:</strong> ${escapeHtml(grup.zona || '')}</div>
                <div><strong>Membri actuali:</strong> ${grup.member_count}</div>
                <div><strong>Tip locuințe:</strong> ${typeInfo.text}</div>
                <div><strong>Buget/mp:</strong> ${grup.buget_max_per_apartament ? grup.buget_max_per_apartament + ' €' : 'N/A'}</div>
            </div>
            <div class="flex gap-2 text-xs mb-4">
                ${tags.map(tag => `<span class="badge ${tag.class}">${tag.text}</span>`).join('')}
            </div>
            <p class="text-sm mb-4">${escapeHtml(grup.descriere || '')}</p>
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500">Creat: ${createdDate}</span>
                <a href="/grup-detail.html?grup=${grup.id}" class="text-blue-600 hover:underline">Vezi detalii →</a>
            </div>
        </div>
    `;
}

// Determine group type based on group data
function determineGroupType(grup) {
    const descriere = (grup.descriere || '').toLowerCase();
    const nume = (grup.nume || '').toLowerCase();
    
    if (descriere.includes('case') || nume.includes('case')) {
        return 'Case';
    } else if (descriere.includes('apartament') || nume.includes('apartament')) {
        return 'Apartamente';
    } else {
        return 'Mixt';
    }
}

// Generate tags based on group characteristics
function generateGroupTags(grup) {
    const tags = [];
    const descriere = (grup.descriere || '').toLowerCase();
    const nume = (grup.nume || '').toLowerCase();
    
    // Age-based tags
    if (descriere.includes('senior') || nume.includes('senior') || descriere.includes('55+')) {
        tags.push({ text: '55+', class: 'bg-orange-100 text-orange-800' });
    }
    if (descriere.includes('tineri') || descriere.includes('25-35') || nume.includes('student')) {
        tags.push({ text: '25-35 ani', class: 'bg-red-100 text-red-800' });
    }
    
    // Lifestyle tags
    if (descriere.includes('eco') || descriere.includes('sustenabil') || descriere.includes('verde')) {
        tags.push({ text: 'Eco-friendly', class: 'bg-green-100 text-green-800' });
    }
    if (descriere.includes('familie') || descriere.includes('copii')) {
        tags.push({ text: 'Familii cu copii', class: 'bg-blue-100 text-blue-800' });
    }
    if (descriere.includes('co-housing') || descriere.includes('comunitar')) {
        tags.push({ text: 'Co-housing', class: 'bg-purple-100 text-purple-800' });
    }
    if (descriere.includes('tech') || descriere.includes('modern')) {
        tags.push({ text: 'Tech-oriented', class: 'bg-purple-100 text-purple-800' });
    }
    if (descriere.includes('accesibil') || descriere.includes('senior')) {
        tags.push({ text: 'Accessible design', class: 'bg-blue-100 text-blue-800' });
    }
    
    return tags;
}

// Apply filters to groups
function applyFilters() {
    const locationValue = locationFilter ? locationFilter.value : '';
    const statusValue = statusFilter ? statusFilter.value : '';
    const typeValue = typeFilter ? typeFilter.value : '';
    
    filteredGrupuri = allGrupuri.filter(grup => {
        // Location filter
        if (locationValue && locationValue !== 'Toate locațiile') {
            const location = grup.zona || '';
            if (!location.toLowerCase().includes(locationValue.toLowerCase())) {
                return false;
            }
        }
        
        // Status filter
        if (statusValue && statusValue !== 'Toate stadiile') {
            const statusMap = {
                'În formare': 'active',
                'Opțiune teren': 'active',
                'Proiectare': 'active',
                'Construcție': 'active'
            };
            const expectedStatus = statusMap[statusValue];
            if (expectedStatus && grup.status !== expectedStatus) {
                return false;
            }
        }
        
        // Type filter
        if (typeValue && typeValue !== 'Toate tipurile') {
            const groupType = determineGroupType(grup);
            if (groupType !== typeValue) {
                return false;
            }
        }
        
        return true;
    });
    
    renderGrupuri();
}

// Show loading state
function showLoading(show) {
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    if (errorEl) {
        errorEl.textContent = message;
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

// Show no results message
function showNoResults() {
    if (noResultsEl) {
        noResultsEl.style.display = 'block';
    }
    if (grupuriListEl) {
        grupuriListEl.innerHTML = '';
    }
}

// Hide no results message
function hideNoResults() {
    if (noResultsEl) {
        noResultsEl.style.display = 'none';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for supabase to be available
    if (typeof supabase !== 'undefined') {
        initGrupuri();
    } else {
        // Wait a bit for supabase to load
        setTimeout(() => {
            if (typeof supabase !== 'undefined') {
                initGrupuri();
            } else {
                showError('Supabase nu a fost încărcat. Vă rugăm să reîncărcați pagina.');
            }
        }, 1000);
    }
});
