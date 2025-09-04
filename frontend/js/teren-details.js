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
    'completed': { text: 'Completă', class: 'bg-green-100 text-green-800' },
    'in_progress': { text: 'În curs', class: 'bg-yellow-100 text-yellow-800' },
    'pending': { text: 'În așteptare', class: 'bg-red-100 text-red-800' },
    'rejected': { text: 'Respinsă', class: 'bg-red-100 text-red-800' }
};

// Extract teren ID from URL query parameter
function getTerenIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Get image URL from storage or fallback to legacy blob data
function getImageUrl(teren) {
    // First, try the new image_url field (Supabase Storage)
    if (teren.image_url) {
        return teren.image_url;
    }
    
    // Fallback to legacy poza field (blob data) for backward compatibility
    if (teren.poza) {
        return binaryToBase64(teren.poza);
    }
    
    return null;
}

// Legacy binary to base64 conversion (kept for backward compatibility)
function binaryToBase64(binaryData) {
    if (!binaryData) return null;
    
    try {
        // If it's already a base64 string, return it
        if (typeof binaryData === 'string') {
            return binaryData.startsWith('data:') ? binaryData : `data:image/jpeg;base64,${binaryData}`;
        }
        
        // Handle ArrayBuffer or Uint8Array
        let bytes;
        if (binaryData instanceof ArrayBuffer) {
            bytes = new Uint8Array(binaryData);
        } else if (binaryData instanceof Uint8Array) {
            bytes = binaryData;
        } else {
            // Try to convert to Uint8Array
            bytes = new Uint8Array(binaryData);
        }
        
        // Detect image format from magic bytes
        let mimeType = 'image/jpeg'; // default
        if (bytes.length >= 4) {
            // PNG: 89 50 4E 47
            if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                mimeType = 'image/png';
            }
            // GIF: 47 49 46 38
            else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
                mimeType = 'image/gif';
            }
            // WebP: 52 49 46 46 (RIFF) + WebP
            else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
                     bytes.length >= 12 && 
                     bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
                mimeType = 'image/webp';
            }
        }
        
        // Convert to binary string
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        return `data:${mimeType};base64,${btoa(binary)}`;
    } catch (error) {
        console.error('Error converting binary data to base64:', error);
        return null;
    }
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

// Fetch teren details
async function fetchTerenDetails() {
    const terenId = getTerenIdFromUrl();
    
    if (!terenId) {
        showNotFound();
        return;
    }

    try {
        showLoading();
        
        const { data, error } = await supabase
            .from('terenuri')
            .select('*')
            .eq('id', terenId)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            showNotFound();
            return;
        }

        displayTerenDetails(data);
        hideLoading();
        
    } catch (error) {
        console.error("Error fetching teren details:", error);
        const errorMessage = error.message || "A apărut o eroare la încărcarea detaliilor terenului.";
        showError(errorMessage);
    }
}

// Display teren details
function displayTerenDetails(teren) {
    // Update page title
    document.title = `${teren.titlu} - ApartamenTUal`;
    
    // Basic information
    document.getElementById('teren-title').textContent = teren.titlu || 'Teren fără titlu';
    document.getElementById('teren-description').textContent = teren.descriere || 'Fără descriere disponibilă';
    
    // Status
    const status = statusMapping[teren.status] || { text: teren.status, class: 'bg-gray-100 text-gray-800' };
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
    
    // Image handling with support for both Storage URLs and legacy blob data
    const imageContainer = document.getElementById('teren-image-container');
    const noImageDiv = document.getElementById('no-image');
    const imageEl = document.getElementById('teren-image');
    
    const imageUrl = getImageUrl(teren);
    
    if (imageUrl) {
        imageEl.src = imageUrl;
        imageEl.alt = `Imagine teren - ${teren.titlu}`;
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
    
    // Analysis details
    const generalSection = document.getElementById('general-analysis-section');
    const specificSection = document.getElementById('specific-analysis-section');
    
    if (teren.analiza_generala_text) {
        document.getElementById('general-analysis-text').textContent = teren.analiza_generala_text;
        generalSection.classList.remove('hidden');
    } else {
        generalSection.classList.add('hidden');
    }
    
    if (teren.analiza_specifica_text) {
        document.getElementById('specific-analysis-text').textContent = teren.analiza_specifica_text;
        specificSection.classList.remove('hidden');
    } else {
        specificSection.classList.add('hidden');
    }
    
    // Show the details
    document.getElementById('teren-details').classList.remove('hidden');
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
