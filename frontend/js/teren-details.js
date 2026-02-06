// ── OWN SUPABASE CLIENT (avoids conflict with app.js) ──
const SUPABASE_URL_TD = 'https://glbvbbgmcobtswwlktic.supabase.co';
const SUPABASE_ANON_KEY_TD = 'sb_publishable_I25cj3p8FZJyTAe0X2ngDA_vvz6ssWz';
const sb = window.supabase.createClient(SUPABASE_URL_TD, SUPABASE_ANON_KEY_TD);

// Status mapping for display
const statusMapping = {
    'pending': { text: 'În așteptare', class: 'bg-yellow-100 text-yellow-800' },
    'approved': { text: 'Aprobat', class: 'bg-green-100 text-green-800' },
    'rejected': { text: 'Respins', class: 'bg-red-100 text-red-800' },
    'disabled': { text: 'Dezactivat', class: 'bg-gray-100 text-gray-800' },
    // Legacy statuses for backwards compatibility
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
        const { data: { user } } = await sb.auth.getUser();
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
    
    // Preț total
    if (teren.pret_total) {
        document.getElementById('teren-pret-total').textContent = `${Number(teren.pret_total).toLocaleString('ro-RO')} €`;
    } else {
        document.getElementById('teren-pret-total').textContent = '—';
    }
    
    document.getElementById('teren-pret').textContent = teren.pret_pe_mp ? `${teren.pret_pe_mp} €/mp` : 'N/A';
    
    // Link sursă
    if (teren.link_sursa) {
        const linkSursaRow = document.getElementById('link-sursa-row');
        const linkSursaEl = document.getElementById('teren-link-sursa');
        linkSursaRow.classList.remove('hidden');
        linkSursaEl.href = teren.link_sursa;
    }
    
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
    fetchTerenDetails();
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
        closeGroupModal();
        closeShareModal();
    }
});

// ══════════════════════════════════════════
//  ACTION BUTTONS: Add to Profile, Add to Group, Share
// ══════════════════════════════════════════

let currentTerenData = null;
let userLikedThisTeren = false;

// Store teren data when loaded for use in action buttons
function storeTerenData(teren) {
    currentTerenData = teren;
}

// Check if user has liked this teren
async function checkIfUserLiked(terenId) {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return false;
        
        const { data, error } = await sb
            .from('terenuri_likes')
            .select('id')
            .eq('teren_id', terenId)
            .eq('user_id', user.id)
            .single();
        
        return !error && data;
    } catch (e) {
        return false;
    }
}

// Update Add to Profile button state
function updateAddToProfileButton(isLiked) {
    const btn = document.getElementById('btn-add-to-profile');
    const btnText = document.getElementById('btn-add-to-profile-text');
    if (!btn || !btnText) return;
    
    userLikedThisTeren = isLiked;
    
    if (isLiked) {
        btn.classList.add('bg-orange-50', 'border-orange-400');
        btn.querySelector('svg').classList.add('text-orange-500', 'fill-current');
        btn.querySelector('svg').classList.remove('text-gray-500');
        btnText.textContent = 'Salvat în profil';
    } else {
        btn.classList.remove('bg-orange-50', 'border-orange-400');
        btn.querySelector('svg').classList.remove('text-orange-500', 'fill-current');
        btn.querySelector('svg').classList.add('text-gray-500');
        btnText.textContent = 'Adaugă la profil';
    }
}

// Add to Profile (like/unlike)
async function toggleAddToProfile() {
    const terenId = getTerenIdFromUrl();
    if (!terenId) return;
    
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) {
            showToast('Trebuie să fii autentificat pentru a salva terenuri.');
            setTimeout(() => window.location.href = 'register.html', 1500);
            return;
        }
        
        if (userLikedThisTeren) {
            // Unlike
            const { error } = await sb
                .from('terenuri_likes')
                .delete()
                .eq('teren_id', terenId)
                .eq('user_id', user.id);
            
            if (!error) {
                updateAddToProfileButton(false);
                showToast('Teren eliminat din profil');
            }
        } else {
            // Like
            const { error } = await sb
                .from('terenuri_likes')
                .insert({ teren_id: terenId, user_id: user.id });
            
            if (!error) {
                updateAddToProfileButton(true);
                showToast('Teren salvat în profil!');
            }
        }
    } catch (e) {
        console.error('Error toggling like:', e);
        showToast('A apărut o eroare');
    }
}

// Add to Group Modal
function openGroupModal() {
    document.getElementById('group-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeGroupModal() {
    document.getElementById('group-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Share Modal
function openShareModal() {
    document.getElementById('share-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Share via Email
function shareViaEmail() {
    const title = currentTerenData?.titlu || 'Teren interesant';
    const url = window.location.href;
    const subject = `Uite un teren interesant: ${title}`;
    const body = `Salut!\n\nAm găsit un teren care mi s-a părut interesant și am vrut să ți-l arăt:\n\n${title}\n${url}\n\nVezi detaliile pe ApartamenTUal!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    closeShareModal();
}

// Share via WhatsApp
function shareViaWhatsApp() {
    const title = currentTerenData?.titlu || 'Teren interesant';
    const url = window.location.href;
    const text = `Uite un teren interesant pe ApartamenTUal: ${title}\n${url}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    closeShareModal();
}

// Copy link to clipboard
async function copyLinkToClipboard() {
    try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copiat!');
        closeShareModal();
    } catch (e) {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copiat!');
        closeShareModal();
    }
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Setup action button event listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Add to Profile button
    const btnAddToProfile = document.getElementById('btn-add-to-profile');
    if (btnAddToProfile) {
        btnAddToProfile.addEventListener('click', toggleAddToProfile);
        
        // Check initial like state
        const terenId = getTerenIdFromUrl();
        if (terenId) {
            const isLiked = await checkIfUserLiked(terenId);
            updateAddToProfileButton(isLiked);
        }
    }
    
    // Add to Group button
    const btnAddToGroup = document.getElementById('btn-add-to-group');
    if (btnAddToGroup) {
        btnAddToGroup.addEventListener('click', openGroupModal);
    }
    
    // Share button
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', openShareModal);
    }
    
    // Share modal buttons
    const shareEmail = document.getElementById('share-email');
    if (shareEmail) shareEmail.addEventListener('click', shareViaEmail);
    
    const shareWhatsApp = document.getElementById('share-whatsapp');
    if (shareWhatsApp) shareWhatsApp.addEventListener('click', shareViaWhatsApp);
    
    const shareCopy = document.getElementById('share-copy');
    if (shareCopy) shareCopy.addEventListener('click', copyLinkToClipboard);
    
    // Close modals when clicking outside
    document.getElementById('group-modal')?.addEventListener('click', closeGroupModal);
    document.getElementById('share-modal')?.addEventListener('click', closeShareModal);
});
