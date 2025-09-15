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

// Simple markdown renderer
function renderMarkdown(text) {
    if (!text) return '';
    
    return text
        // Headers (process in order from most specific to least)
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold (must come before italic)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic (simplified regex for better compatibility)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>');
}

// Extract teren ID from URL query parameter
function getTerenIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Get image URL from storage
function getImageUrl(teren) {
    // First, try the new image_url field (Supabase Storage)
    if (teren.image_url) {
        return teren.image_url;
    }

    return null;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Image modal functions
function openImageModal() {
    const imageSrc = document.getElementById('teren-image').src;
    if (imageSrc) {
        document.getElementById('modal-image').src = imageSrc;
        document.getElementById('image-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
}

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

// Fetch teren details
async function fetchTerenDetails() {
    const terenId = getTerenIdFromUrl();
    
    if (!terenId) {
        showNotFound();
        return;
    }

    try {
        showLoading();
        
        // Fetch both teren details and user profile in parallel
        const [terenResult, userProfile] = await Promise.all([
            supabase
                .from('terenuri')
                .select('*')
                .eq('id', terenId)
                .single(),
            fetchUserProfile()
        ]);

        const { data: terenData, error: terenError } = terenResult;

        if (terenError) {
            throw terenError;
        }

        if (!terenData) {
            showNotFound();
            return;
        }

        displayTerenDetails(terenData, userProfile);
        hideLoading();
        
    } catch (error) {
        console.error("Error fetching teren details:", error);
        const errorMessage = error.message || "A apărut o eroare la încărcarea detaliilor terenului.";
        showError(errorMessage);
    }
}

// Display teren details
function displayTerenDetails(teren, userProfile) {
    // Update page title
    document.title = `${teren.titlu} - ApartamenTUal`;
    
    // Check if teren is disabled (soft deleted)
    const isDisabled = teren.deleted_at !== null;
    
    // Add disabled indicator to the page
    if (isDisabled) {
        // Add disabled badge to the top of the page
        const backButton = document.querySelector('.mb-6');
        if (backButton && !document.getElementById('disabled-indicator')) {
            const disabledIndicator = document.createElement('div');
            disabledIndicator.id = 'disabled-indicator';
            disabledIndicator.className = 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg';
            disabledIndicator.innerHTML = `
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Acest teren este dezactivat</span>
                </div>
            `;
            backButton.insertAdjacentElement('afterend', disabledIndicator);
        }
        
        // Apply visual styling to the main content
        const mainContent = document.querySelector('.grid.lg\\:grid-cols-2');
        if (mainContent) {
            mainContent.classList.add('opacity-75');
        }
    }
    
    // Basic information
    document.getElementById('teren-title').textContent = teren.titlu || 'Teren fără titlu';
    document.getElementById('teren-description').textContent = teren.descriere || 'Fără descriere disponibilă';
    
    // Status - show disabled status if applicable
    let status = statusMapping[teren.status] || { text: teren.status, class: 'bg-gray-100 text-gray-800' };
    if (isDisabled) {
        status = { text: 'Dezactivat', class: 'bg-red-100 text-red-800' };
    }
    const statusEl = document.getElementById('teren-status');
    statusEl.textContent = status.text;
    statusEl.className = `badge ${status.class}`;
    
    // Basic details
    document.getElementById('teren-suprafata').textContent = teren.suprafata ? `${teren.suprafata} mp` : 'N/A';
    document.getElementById('teren-zona').textContent = teren.zona || 'N/A';
    document.getElementById('teren-pret').textContent = teren.pret_pe_mp ? `${teren.pret_pe_mp} €/mp` : 'N/A';
    
    const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max 
        ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}` 
        : 'N/A';
    document.getElementById('teren-apartamente').textContent = apartamenteRange;
    
    document.getElementById('teren-data-adaugat').textContent = formatDate(teren.data_adaugat);
    
    // Analysis badges
    const analizaGenerala = analysisMapping[teren.analiza_generala_status] || { text: teren.analiza_generala_status, class: 'bg-gray-100 text-gray-800' };
    const analizaSpecifica = analysisMapping[teren.analiza_specifica_status] || { text: teren.analiza_specifica_status, class: 'bg-gray-100 text-gray-800' };
    
    const generalBadge = document.getElementById('analiza-generala-badge');
    generalBadge.textContent = `Analiză generală: ${analizaGenerala.text}`;
    generalBadge.className = `badge ${analizaGenerala.class}`;
    
    const specificBadge = document.getElementById('analiza-specifica-badge');
    specificBadge.textContent = `Analiză specifică: ${analizaSpecifica.text}`;
    specificBadge.className = `badge ${analizaSpecifica.class}`;
    
    // Determine if user can see action buttons
    const actionButtons = document.getElementById('action-buttons');
    const hasPendingAnalysis = teren.analiza_generala_status === 'pending' || teren.analiza_specifica_status === 'pending';
    const canModify = userProfile && (
        (userProfile.user_id === teren.user_id && !teren.deleted_at) || 
        userProfile.is_super_admin
    );
    const canToggleStatus = userProfile && userProfile.is_super_admin;
    
    // Show action buttons if user has pending analysis OR can modify/delete
    if (hasPendingAnalysis || canModify || canToggleStatus) {
        actionButtons.classList.remove('hidden');
        
        // Update button visibility
        updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, teren);
    } else {
        actionButtons.classList.add('hidden');
    }
    
    // Image handling with support for both Storage URLs and legacy blob data
    const imageContainer = document.getElementById('teren-image-container');
    const noImageDiv = document.getElementById('no-image');
    const imageEl = document.getElementById('teren-image');
    
    const imageUrl = getImageUrl(teren);
    
    if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = `Imagine teren - ${teren.titlu}`;
        
        // Apply disabled styling to image if teren is disabled
        if (isDisabled) {
            imageEl.classList.add('opacity-50');
        } else {
            imageEl.classList.remove('opacity-50');
        }
        
        imageEl.onerror = function() {
            console.error('Failed to load image from URL:', imageUrl);
            imageContainer.classList.add('hidden');
            noImageDiv.classList.remove('hidden');
        };
        imageContainer.classList.remove('hidden');
        noImageDiv.classList.add('hidden');
    } else {
        imageContainer.classList.add('hidden');
        noImageDiv.classList.remove('hidden');
    }
    
    // Analysis details - only show if status is completed
    const generalSection = document.getElementById('general-analysis-section');
    const specificSection = document.getElementById('specific-analysis-section');
    
    // Show general analysis only if status is completed and text exists
    if (teren.analiza_generala_status === 'completed' && teren.analiza_generala_text) {
        // Render markdown content
        try {
            const generalElement = document.getElementById('general-analysis-text');
            const renderedHtml = renderMarkdown(teren.analiza_generala_text);
            generalElement.innerHTML = renderedHtml;
        } catch (error) {
            console.error('Error rendering general analysis markdown:', error);
            // Fallback to plain text if markdown rendering fails
            document.getElementById('general-analysis-text').textContent = teren.analiza_generala_text;
        }
        generalSection.classList.remove('hidden');
    } else {
        generalSection.classList.add('hidden');
    }
    
    // Show specific analysis only if status is completed and text exists
    if (teren.analiza_specifica_status === 'completed' && teren.analiza_specifica_text) {
        // Render markdown content
        try {
            const specificElement = document.getElementById('specific-analysis-text');
            const renderedHtml = renderMarkdown(teren.analiza_specifica_text);
            specificElement.innerHTML = renderedHtml;
        } catch (error) {
            console.error('Error rendering specific analysis markdown:', error);
            // Fallback to plain text if markdown rendering fails
            document.getElementById('specific-analysis-text').textContent = teren.analiza_specifica_text;
        }
        specificSection.classList.remove('hidden');
    } else {
        specificSection.classList.add('hidden');
    }
    
    // Show the details
    document.getElementById('teren-details').classList.remove('hidden');
}

// Update action buttons visibility and content
function updateActionButtons(hasPendingAnalysis, canModify, canToggleStatus, teren) {
    const actionButtons = document.getElementById('action-buttons');
    
    // Clear existing buttons
    actionButtons.innerHTML = '';
    
    // Add "Cere o analiză" button if there are pending analyses
    if (hasPendingAnalysis) {
        const cereAnalizaBtn = document.createElement('a');
        cereAnalizaBtn.href = '/terenuri-analize.html';
        cereAnalizaBtn.innerHTML = '<button class="primary">Cere o analiză</button>';
        actionButtons.appendChild(cereAnalizaBtn);
    }
    
    // Add "Modifica" button if user can modify
    if (canModify) {
        const modificaBtn = document.createElement('button');
        modificaBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        modificaBtn.textContent = 'Modifică';
        modificaBtn.onclick = () => editTeren(teren.id);
        actionButtons.appendChild(modificaBtn);
    }
    
    // Add "Dezactivează/Activează" button if user is super admin
    if (canToggleStatus) {
        const toggleBtn = document.createElement('button');
        const isDeleted = teren.deleted_at !== null;
        toggleBtn.className = isDeleted 
            ? 'bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors'
            : 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors';
        toggleBtn.textContent = isDeleted ? 'Activează' : 'Dezactivează';
        toggleBtn.onclick = () => toggleTerenStatus(teren.id, isDeleted);
        actionButtons.appendChild(toggleBtn);
    }
}

// Edit teren function
function editTeren(terenId) {
    // Redirect to edit page or open edit modal
    window.location.href = `/terenuri-propune.html?edit=${terenId}`;
}

// Toggle teren status (activate/deactivate)
async function toggleTerenStatus(terenId, isCurrentlyDeleted) {
    try {
        console.log('Starting toggleTerenStatus:', { terenId, isCurrentlyDeleted });
        
        // First, check if user is super admin
        const userProfile = await fetchUserProfile();
        console.log('User profile:', userProfile);
        console.log('Is super admin:', userProfile?.is_super_admin);
        
        if (!userProfile?.is_super_admin) {
            throw new Error('Nu aveți permisiuni de administrator pentru această operație');
        }
        
        const newStatus = isCurrentlyDeleted ? null : new Date().toISOString();
        console.log('New status:', newStatus);
        
        const { data, error } = await supabase
            .from('terenuri')
            .update({ deleted_at: newStatus })
            .eq('id', terenId)
            .select();
        
        console.log('Supabase response:', { data, error });
        
        if (error) {
            console.error('Supabase error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }
        
        console.log('Update successful, data:', data);
        
        // Show success message and reload page
        const message = isCurrentlyDeleted ? 'Terenul a fost activat cu succes!' : 'Terenul a fost dezactivat cu succes!';
        alert(message);
        window.location.reload();
        
    } catch (error) {
        console.error('Error toggling teren status:', error);
        alert('A apărut o eroare la modificarea statusului terenului: ' + error.message);
    }
}

// Show/hide loading state
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('teren-details').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message = "A apărut o eroare la încărcarea detaliilor terenului.") {
    hideLoading();
    document.getElementById("error").classList.remove("hidden");
    document.getElementById("not-found").classList.add("hidden");
    document.getElementById("teren-details").classList.add("hidden");
    document.getElementById("error-message").textContent = message;
}

function showNotFound() {
    hideLoading();
    document.getElementById("not-found").classList.remove("hidden");
    document.getElementById("error").classList.add("hidden");
    document.getElementById("teren-details").classList.add("hidden");
}

// Add retry button event listener
document.addEventListener("DOMContentLoaded", function() {
    const retryBtn = document.getElementById("retry-btn");
    if (retryBtn) {
        retryBtn.addEventListener("click", fetchTerenDetails);
    }
});


// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Supabase to be initialized
    if (typeof supabase !== 'undefined') {
        fetchTerenDetails();
    } else {
        // Wait a bit for app.js to initialize
        setTimeout(fetchTerenDetails, 100);
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
});
