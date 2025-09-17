let allTerenuri = [];
let filteredTerenuri = [];

// Pagination constants and state
const ITEMS_PER_PAGE = 10; // Hardcoded constant for testing
let currentPage = 1;
let totalPages = 1;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const terrainListEl = document.getElementById('terrain-list');
const noResultsEl = document.getElementById('no-results');
const retryBtn = document.getElementById('retry-btn');
const locationFilter = document.getElementById('location-filter');
const statusFilter = document.getElementById('status-filter');
const analysisFilter = document.getElementById('analysis-filter');
const paginationEl = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageNumbersEl = document.getElementById('page-numbers');

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

// Fetch user profile data
async function fetchUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }

        return data;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

// Fetch terenuri from Supabase
async function fetchTerenuri() {
    try {
        showLoading();
        
        // Check if user is super admin to determine query
        const userProfile = await fetchUserProfile();
        const isSuperAdmin = userProfile?.is_super_admin;
        
        let query = supabase
            .from('terenuri')
            .select('*')
            .order('data_adaugat', { ascending: false });
            
        // If not super admin, only show active and non-deleted terenuri
        if (!isSuperAdmin) {
            query = query.eq('status', 'active').is('deleted_at', null);
        }

        const { data, error } = await query;

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

    // Check if teren is disabled (soft deleted)
    const isDisabled = teren.deleted_at !== null;
    
    // Get image URL - prefer new image_url field over legacy poza blob
    const imageUrl = teren.image_url || null;
    const imageOpacity = isDisabled ? 'opacity-50' : '';
    const imageSection = imageUrl ? 
        `<div class="mb-3">
            <img src="${imageUrl}" alt="${teren.titlu}" class="w-full h-32 object-cover rounded-lg ${imageOpacity}" onerror="this.style.display='none';">
        </div>` : '';

    // Card styling - grayed out for disabled terenuri
    const cardClass = isDisabled ? 'card card-disabled' : 'card';
    const contentOpacity = isDisabled ? 'opacity-75' : '';
    
    // Disabled label
    const disabledLabel = isDisabled ? 
        `<div class="mb-3">
            <span class="badge bg-red-100 text-red-800">Dezactivat</span>
        </div>` : '';

    return `
        <div class="${cardClass}">
            ${disabledLabel}
            ${imageSection}
            <div class="flex justify-between items-start mb-3 ${contentOpacity}">
                <h3 class="text-lg">${teren.titlu || 'Teren fără titlu'}</h3>
                <span class="badge ${status.class}">${status.text}</span>
            </div>
            <p class="subtitle mb-4 ${contentOpacity}">${teren.descriere || 'Fără descriere disponibilă'}</p>
            <div class="grid grid-cols-2 gap-2 text-sm mb-4 ${contentOpacity}">
                <div><strong>Suprafață:</strong> ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}</div>
                <div><strong>Zonă:</strong> ${teren.zona || 'N/A'}</div>
                <div><strong>Preț:</strong> ${teren.pret_pe_mp ? teren.pret_pe_mp + ' €/mp' : 'N/A'}</div>
                <div><strong>Apartamente:</strong> ${apartamenteRange}</div>
            </div>
            <div class="flex gap-2 text-xs ${contentOpacity}">
                <span class="badge ${analizaGenerala.class}">Analiză generală: ${analizaGenerala.text}</span>
                <span class="badge ${analizaSpecifica.class}">Analiză specifică: ${analizaSpecifica.text}</span>
            </div>
            <div class="mt-4 ${contentOpacity}">
                <a href="/teren-details.html?id=${teren.id}" class="text-blue-600 hover:underline">Vezi detalii →</a>
            </div>
        </div>
    `;
}

// Render terrain cards with pagination
function renderTerenuri() {
    if (filteredTerenuri.length === 0) {
        terrainListEl.classList.add('hidden');
        paginationEl.classList.add('hidden');
        noResultsEl.classList.remove('hidden');
        return;
    }

    noResultsEl.classList.add('hidden');
    terrainListEl.classList.remove('hidden');
    
    // Calculate pagination
    totalPages = Math.ceil(filteredTerenuri.length / ITEMS_PER_PAGE);
    currentPage = Math.min(currentPage, totalPages); // Ensure current page doesn't exceed total pages
    
    // Get items for current page
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageItems = filteredTerenuri.slice(startIndex, endIndex);
    
    // Render current page items
    terrainListEl.innerHTML = currentPageItems.map(createTerrainCard).join('');
    
    // Update pagination controls
    updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
    if (totalPages <= 1) {
        paginationEl.classList.add('hidden');
        return;
    }
    
    paginationEl.classList.remove('hidden');
    
    // Update prev/next buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    
    // Update page numbers
    pageNumbersEl.innerHTML = '';
    
    // Show up to 5 page numbers around current page
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = `px-3 py-2 border rounded-md ${
            i === currentPage 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'border-gray-300 hover:bg-gray-50'
        }`;
        pageBtn.addEventListener('click', () => goToPage(i));
        pageNumbersEl.appendChild(pageBtn);
    }
}

// Navigate to specific page
function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTerenuri();
    }
}

// Navigate to previous page
function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTerenuri();
    }
}

// Navigate to next page
function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderTerenuri();
    }
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

    // Reset to first page when filtering
    currentPage = 1;
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

async function handlePropuneTerenClick(event) {
    event.preventDefault();
    
    const isAuthenticated = await isUserAuthenticated();
    
    if (isAuthenticated) {
        // User is authenticated, redirect to the propose terrain page
        window.location.href = '/terenuri-propune.html';
    } else {
        // User is not authenticated, show auth modal with custom message
        openAuthModalWithMessage('Va rugam sa va inregistrati sau sa intrati in contul dvs. pentru a adauga un teren.');
    }
}

// Event listeners
locationFilter.addEventListener('change', filterTerenuri);
statusFilter.addEventListener('change', filterTerenuri);
analysisFilter.addEventListener('change', filterTerenuri);
retryBtn.addEventListener('click', fetchTerenuri);
prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);

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
