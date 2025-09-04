let allTerenuri = [];
let filteredTerenuri = [];

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const terrainListEl = document.getElementById('terrain-list');
const noResultsEl = document.getElementById('no-results');
const retryBtn = document.getElementById('retry-btn');
const locationFilter = document.getElementById('location-filter');
const statusFilter = document.getElementById('status-filter');
const analysisFilter = document.getElementById('analysis-filter');

// Status mapping for display
const statusMapping = {
    'active': { text: 'Disponibil', class: 'bg-green-100 text-green-800' },
    'under_review': { text: 'În analiză', class: 'bg-yellow-100 text-yellow-800' },
    'reserved': { text: 'Rezervat', class: 'bg-blue-100 text-blue-800' },
    'sold': { text: 'Vândut', class: 'bg-gray-100 text-gray-800' },
    'inactive': { text: 'Inactiv', class: 'bg-red-100 text-red-800' }
};

// Analysis status mapping
const analysisMapping = {
    'completed': { text: 'da', class: 'bg-green-100 text-green-800' },
    'in_progress': { text: 'în curs', class: 'bg-yellow-100 text-yellow-800' },
    'pending': { text: 'nu', class: 'bg-red-100 text-red-800' },
    'rejected': { text: 'respinsă', class: 'bg-red-100 text-red-800' }
};

// Fetch terenuri from Supabase
async function fetchTerenuri() {
    try {
        showLoading();
        
        const { data, error } = await supabase
            .from('terenuri')
            .select('*')
            .eq('status', 'active')
            .order('data_adaugat', { ascending: false });

        if (error) {
            throw error;
        }

        allTerenuri = data || [];
        filteredTerenuri = [...allTerenuri];
        
        populateFilters();
        renderTerenuri();
        hideLoading();
        
    } catch (error) {
        console.error('Error fetching terenuri:', error);
        showError();
    }
}

// Populate filter dropdowns with unique values from data
function populateFilters() {
    // Get unique locations
    const locations = [...new Set(allTerenuri.map(t => t.zona).filter(Boolean))];
    locationFilter.innerHTML = '<option value="">Toate locațiile</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// Create terrain card HTML
function createTerrainCard(teren) {
    const status = statusMapping[teren.status] || { text: teren.status, class: 'bg-gray-100 text-gray-800' };
    const analizaGenerala = analysisMapping[teren.analiza_generala_status] || { text: teren.analiza_generala_status, class: 'bg-gray-100 text-gray-800' };
    const analizaSpecifica = analysisMapping[teren.analiza_specifica_status] || { text: teren.analiza_specifica_status, class: 'bg-gray-100 text-gray-800' };
    
    const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max 
        ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}` 
        : 'N/A';

    // Get image URL - prefer new image_url field over legacy poza blob
    const imageUrl = teren.image_url || null;
    const imageSection = imageUrl ? 
        `<div class="mb-3">
            <img src="${imageUrl}" alt="${teren.titlu}" class="w-full h-32 object-cover rounded-lg" onerror="this.style.display='none';">
        </div>` : '';

    return `
        <div class="card">
            ${imageSection}
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg">${teren.titlu || 'Teren fără titlu'}</h3>
                <span class="badge ${status.class}">${status.text}</span>
            </div>
            <p class="subtitle mb-4">${teren.descriere || 'Fără descriere disponibilă'}</p>
            <div class="grid grid-cols-2 gap-2 text-sm mb-4">
                <div><strong>Suprafață:</strong> ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}</div>
                <div><strong>Zonă:</strong> ${teren.zona || 'N/A'}</div>
                <div><strong>Preț:</strong> ${teren.pret_pe_mp ? teren.pret_pe_mp + ' €/mp' : 'N/A'}</div>
                <div><strong>Apartamente:</strong> ${apartamenteRange}</div>
            </div>
            <div class="flex gap-2 text-xs">
                <span class="badge ${analizaGenerala.class}">Analiză generală: ${analizaGenerala.text}</span>
                <span class="badge ${analizaSpecifica.class}">Analiză specifică: ${analizaSpecifica.text}</span>
            </div>
            <div class="mt-4">
                <a href="/teren-details.html?id=${teren.id}" class="text-blue-600 hover:underline">Vezi detalii →</a>
            </div>
        </div>
    `;
}

// Render terrain cards
function renderTerenuri() {
    if (filteredTerenuri.length === 0) {
        terrainListEl.classList.add('hidden');
        noResultsEl.classList.remove('hidden');
        return;
    }

    noResultsEl.classList.add('hidden');
    terrainListEl.classList.remove('hidden');
    
    terrainListEl.innerHTML = filteredTerenuri.map(createTerrainCard).join('');
}

// Filter terenuri based on selected filters
function filterTerenuri() {
    const locationValue = locationFilter.value;
    const statusValue = statusFilter.value;
    const analysisValue = analysisFilter.value;

    filteredTerenuri = allTerenuri.filter(teren => {
        const matchesLocation = !locationValue || teren.zona === locationValue;
        const matchesStatus = !statusValue || teren.status === statusValue;
        
        let matchesAnalysis = true;
        if (analysisValue) {
            if (analysisValue === 'completed') {
                matchesAnalysis = teren.analiza_generala_status === 'completed' && teren.analiza_specifica_status === 'completed';
            } else if (analysisValue === 'in_progress') {
                matchesAnalysis = teren.analiza_generala_status === 'in_progress' || teren.analiza_specifica_status === 'in_progress';
            } else if (analysisValue === 'pending') {
                matchesAnalysis = teren.analiza_generala_status === 'pending' && teren.analiza_specifica_status === 'pending';
            }
        }

        return matchesLocation && matchesStatus && matchesAnalysis;
    });

    renderTerenuri();
}

// Show/hide loading state
function showLoading() {
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    terrainListEl.classList.add('hidden');
    noResultsEl.classList.add('hidden');
}

function hideLoading() {
    loadingEl.classList.add('hidden');
}

function showError() {
    hideLoading();
    errorEl.classList.remove('hidden');
    terrainListEl.classList.add('hidden');
    noResultsEl.classList.add('hidden');
}

// Authentication functions
async function checkUserAuthentication() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user !== null;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

function showAuthModalWithMessage(message) {
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');
    
    if (authModal && loginForm) {
        // Add custom message before the login form
        let customMessage = document.getElementById('custom-auth-message');
        if (!customMessage) {
            customMessage = document.createElement('div');
            customMessage.id = 'custom-auth-message';
            customMessage.className = 'mb-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm';
            loginForm.parentNode.insertBefore(customMessage, loginForm);
        }
        customMessage.textContent = message;
        customMessage.classList.remove('hidden');
        
        authModal.classList.remove('hidden');
    }
}

async function handlePropuneTerenClick(event) {
    event.preventDefault();
    
    const isAuthenticated = await checkUserAuthentication();
    
    if (isAuthenticated) {
        // User is authenticated, redirect to the propose terrain page
        window.location.href = '/terenuri-propune.html';
    } else {
        // User is not authenticated, show auth modal with custom message
        showAuthModalWithMessage('Va rugam sa va inregistrati sau sa intrati in contul dvs. pentru a adauga un teren.');
    }
}

// Event listeners
locationFilter.addEventListener('change', filterTerenuri);
statusFilter.addEventListener('change', filterTerenuri);
analysisFilter.addEventListener('change', filterTerenuri);
retryBtn.addEventListener('click', fetchTerenuri);

// Set up authentication checks for "Propune teren" buttons
function setupPropuneTerenButtons() {
    // Find all "Propune teren" buttons and links
    const propuneTerenLinks = document.querySelectorAll('a[href="/terenuri-propune.html"]');
    
    propuneTerenLinks.forEach(link => {
        link.addEventListener('click', handlePropuneTerenClick);
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    fetchTerenuri();
    setupPropuneTerenButtons();
});
