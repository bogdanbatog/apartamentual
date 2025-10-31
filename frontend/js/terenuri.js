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
const paginationEl = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageNumbersEl = document.getElementById('page-numbers');

// Terrain card is provided by shared script: window.createTerrainCard

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

// createTerrainCard is defined in shared script

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

    filteredTerenuri = allTerenuri.filter(teren => {
        const matchesLocation = !locationValue || teren.zona === locationValue;

        return matchesLocation;
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


// Event listeners
locationFilter.addEventListener('change', filterTerenuri);
retryBtn.addEventListener('click', fetchTerenuri);
prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);


// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    fetchTerenuri();
});
