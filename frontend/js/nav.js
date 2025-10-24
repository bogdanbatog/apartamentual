// Navigation component
function createNavigation(currentPage = '') {
    const navItems = [
        { href: "/index.html", label: "Acasă", id: "home" },
        { href: "/ce-este/index.html", label: "Ce este", id: "about" },
        { href: "/terenuri.html", label: "Terenuri", id: "land" },
        { href: "/grupuri.html", label: "Grupuri", id: "groups" },
        // { href: "/proiecte.html", label: "Proiecte", id: "projects" },
        // { href: "/parteneri.html", label: "Parteneri", id: "partners" },
        // { href: "/news.html", label: "News/Blog", id: "news" }
    ];

    const navHTML = `
        <header class="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
            <div class="container flex items-center justify-between py-3">
                <a href="index.html" class="font-bold text-xl">ApartamenTUal</a>
                <nav class="hidden md:flex flex-wrap gap-4 text-sm">
                    ${navItems.map(item => `
                        <a href="${item.href}" ${currentPage === item.id ? 'class="font-semibold"' : ''}>${item.label}</a>
                    `).join('')}
                </nav>
                <div class="flex gap-3">
                    <div id="auth-section">
                        <button id="auth-toggle" class="badge">Login/Sign Up</button>
                    </div>
                    <div id="profile-section" class="hidden">
                        <div class="flex items-center gap-3">
                            <a id="profile-link" href="#" class="text-sm text-gray-600 hover:text-gray-900">Profil</a>
                            <button id="nav-logout-btn" class="text-sm text-gray-600 hover:text-gray-900">Logout</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Mobile menu toggle -->
            <button id="mobile-menu-toggle" class="md:hidden container py-2 text-sm">
                ☰ Meniu
            </button>
            
            <!-- Mobile menu -->
            <div id="mobile-menu" class="hidden md:hidden border-t">
                <nav class="container py-3 flex flex-col gap-2 text-sm">
                    ${navItems.map(item => `
                        <a href="${item.href}" ${currentPage === item.id ? 'class="font-semibold"' : ''}>${item.label}</a>
                    `).join('')}
                </nav>
                <div class="container py-3 border-t">
                    <div id="mobile-auth-section">
                        <button id="mobile-auth-toggle" class="w-full text-left py-2">Login/Sign Up</button>
                    </div>
                    <div id="mobile-profile-section" class="hidden">
                        <div class="flex flex-col gap-2">
                            <a id="mobile-profile-link" href="#" class="py-2">Profil</a>
                            <button id="mobile-logout-btn" class="w-full text-left py-2">Logout</button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;

    return navHTML;
}

// Function to inject navigation into the page
function loadNavigation(currentPage = '') {
    const navContainer = document.getElementById('navigation');
    if (navContainer) {
        navContainer.innerHTML = createNavigation(currentPage);
        
        // Set up mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
        
        // Set up profile links
        setupProfileLinks();
    }
}

// Set up profile links and auth state
function setupProfileLinks() {
    // Check if user is authenticated
    checkAuthState();
    
    // Set up profile link click handlers
    const profileLink = document.getElementById('profile-link');
    const mobileProfileLink = document.getElementById('mobile-profile-link');
    
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = getCurrentUserId();
            if (userId) {
                window.location.href = `/profile-view.html?id=${userId}`;
            }
        });
    }
    
    if (mobileProfileLink) {
        mobileProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = getCurrentUserId();
            if (userId) {
                window.location.href = `/profile-view.html?id=${userId}`;
            }
        });
    }
    
    // Set up logout button click handlers
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', async () => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Sign out failed:', error);
                } else {
                    // Redirect to home page after logout
                    window.location.href = '/index.html';
                }
            } catch (error) {
                console.error('Error during sign out:', error);
            }
        });
    }
    
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async () => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Sign out failed:', error);
                } else {
                    // Redirect to home page after logout
                    window.location.href = '/index.html';
                }
            } catch (error) {
                console.error('Error during sign out:', error);
            }
        });
    }
}

// Check authentication state and update UI
async function checkAuthState() {
    try {
        if (typeof supabase === 'undefined') {
            // Supabase not loaded yet, try again later
            setTimeout(checkAuthState, 100);
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        updateAuthUI(user);
    } catch (error) {
        console.error('Error checking auth state:', error);
        updateAuthUI(null);
    }
}

// Update authentication UI based on user state
function updateAuthUI(user) {
    const authSection = document.getElementById('auth-section');
    const profileSection = document.getElementById('profile-section');
    const mobileAuthSection = document.getElementById('mobile-auth-section');
    const mobileProfileSection = document.getElementById('mobile-profile-section');
    
    if (user) {
        // User is logged in
        if (authSection) authSection.classList.add('hidden');
        if (profileSection) profileSection.classList.remove('hidden');
        if (mobileAuthSection) mobileAuthSection.classList.add('hidden');
        if (mobileProfileSection) mobileProfileSection.classList.remove('hidden');
    } else {
        // User is not logged in
        if (authSection) authSection.classList.remove('hidden');
        if (profileSection) profileSection.classList.add('hidden');
        if (mobileAuthSection) mobileAuthSection.classList.remove('hidden');
        if (mobileProfileSection) mobileProfileSection.classList.add('hidden');
    }
}

// Get current user ID
function getCurrentUserId() {
    // This will be set by the auth system
    return window.currentUserId || null;
}

// Auto-detect current page based on URL
function getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    if (path.includes('ce-este')) return 'about';
    if (path.includes('terenuri')) return 'land';
    if (path.includes('grupuri')) return 'groups';
    if (path.includes('proiecte')) return 'projects';
    if (path.includes('parteneri')) return 'partners';
    if (path.includes('news')) return 'news';
    return '';
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadNavigation(getCurrentPage());
});