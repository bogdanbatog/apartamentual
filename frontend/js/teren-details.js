// Status mapping for display
const statusMapping = {
    'active': { text: 'Disponibil', class: 'bg-green-100 text-green-800' },
    'under_review': { text: 'În analiză', class: 'bg-yellow-100 text-yellow-800' },
    'reserved': { text: 'Rezervat', class: 'bg-blue-100 text-blue-800' },
    'sold': { text: 'Vândut', class: 'bg-gray-100 text-gray-800' },
    'inactive': { text: 'Inactiv', class: 'bg-red-100 text-red-800' }
};

// Analysis rendering removed from details page

// Markdown rendering is now handled by markdown-utils.js

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
    
    // Analysis badges removed
    
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
    
    // Analysis details removed
    
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
        const cereAnalizaBtn = document.createElement('button');
        cereAnalizaBtn.className = 'primary';
        cereAnalizaBtn.textContent = 'Cere o analiză';
        cereAnalizaBtn.onclick = () => openAnalysisModal(teren);
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
    
    // Add email button event listener
    const sendEmailBtn = document.getElementById("send-email-btn");
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener("click", function() {
            // Get current teren data from the page
            const terenId = getTerenIdFromUrl();
            if (terenId) {
                // We need to get the teren data, but since we don't have it in scope here,
                // we'll create a simple version with the data we can get from the DOM
                const teren = {
                    titlu: document.getElementById('teren-title')?.textContent || 'Teren fără titlu',
                    suprafata: document.getElementById('teren-suprafata')?.textContent?.replace(' mp', '') || 'N/A',
                    zona: document.getElementById('teren-zona')?.textContent || 'N/A',
                    pret_pe_mp: document.getElementById('teren-pret')?.textContent?.replace(' €/mp', '') || 'N/A'
                };
                sendAnalysisEmail(teren);
            }
        });
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

// Analysis Modal Functions
function openAnalysisModal(teren) {
    // Populate email content with teren details
    const terenUrl = window.location.href;
    const emailSubject = `Solicitare analiză teren - ${teren.titlu || 'Teren fără titlu'}`;
    
    const emailContent = `Bună ziua,

Solicit o analiză pentru următorul teren:

Titlu: ${teren.titlu || 'N/A'}
URL: ${terenUrl}
Suprafață: ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}
Zonă: ${teren.zona || 'N/A'}
Preț pe mp: ${teren.pret_pe_mp ? teren.pret_pe_mp + ' EUR/mp' : 'N/A'}

Tipul de analiză solicitat: [Vă rog să specificați: Analiză Generală (100 EUR) sau Analiză Specifică (500 EUR)]

Vă rog să îmi trimiteți detaliile pentru plata corespunzătoare.

Mulțumesc,
[Numele dumneavoastră]`;

    // Update email content in modal
    document.getElementById('email-subject').textContent = emailSubject;
    document.getElementById('email-content').textContent = emailContent;
    
    // Show modal
    document.getElementById('analysis-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeAnalysisModal() {
    document.getElementById('analysis-modal').classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
}

function sendAnalysisEmail(teren) {
    const terenUrl = window.location.href;
    const emailSubject = `Solicitare analiză teren - ${teren.titlu || 'Teren fără titlu'}`;
    
    const emailContent = `Bună ziua,

Solicit o analiză pentru următorul teren:

Titlu: ${teren.titlu || 'N/A'}
URL: ${terenUrl}
Suprafață: ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}
Zonă: ${teren.zona || 'N/A'}
Preț pe mp: ${teren.pret_pe_mp ? teren.pret_pe_mp + ' EUR/mp' : 'N/A'}

Tipul de analiză solicitat: [Vă rog să specificați: Analiză Generală (100 EUR) sau Analiză Specifică (500 EUR)]

Vă rog să îmi trimiteți detaliile pentru plata corespunzătoare.

Mulțumesc,
[Numele dumneavoastră]`;

    // Create mailto link
    const mailtoLink = `mailto:office@ltfbstudio.ro?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailContent)}`;
    
    // Open email client
    window.location.href = mailtoLink;
    
    // Close modal after opening email client
    closeAnalysisModal();
}

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
        closeAnalysisModal();
    }
});
