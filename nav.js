// Navigation component
function createNavigation(currentPage = '') {
    const navItems = [
        { href: "index.html", label: "Acasă", id: "home" },
        { href: "ce-este-apartamentual.html", label: "Ce este", id: "about" },
        { href: "terenuri.html", label: "Terenuri", id: "land" },
        { href: "grupuri.html", label: "Grupuri", id: "groups" },
        { href: "proiecte.html", label: "Proiecte", id: "projects" },
        // { href: "parteneri.html", label: "Parteneri", id: "partners" },
        { href: "news.html", label: "News/Blog", id: "news" }
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
                    <button id="auth-toggle" class="badge">Login/Sign Up</button>
                    <a href="terenuri-propune.html" class="badge">Propune teren</a>
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
    }
}

// Auto-detect current page based on URL
function getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    if (path.includes('ce-este-apartamentual')) return 'about';
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