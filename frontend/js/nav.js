// ══════════════════════════════════════════════════════════════
// UNIFIED NAVIGATION COMPONENT — ApartamenTUal
// Used on ALL pages: Acasă, Ce este, Terenuri, Utilizatori, Grupuri, etc.
// ══════════════════════════════════════════════════════════════

(function() {

function getPageConfig() {
    const path = window.location.pathname;
    
    let currentPage = '';
    let ctaButton = null;
    
    if (path === '/' || (path.endsWith('/index.html') && !path.includes('ce-este'))) {
        currentPage = 'home';
    } else if (path.includes('ce-este')) {
        currentPage = 'about';
    } else if (path.includes('teren')) {
        currentPage = 'land';
        ctaButton = { href: '/terenuri-propune.html', icon: 'fa-plus', label: 'Propune teren' };
    } else if (path.includes('utilizatori')) {
        currentPage = 'users';
    } else if (path.includes('grup')) {
        currentPage = 'groups';
        ctaButton = { href: '/grup-nou.html', icon: 'fa-plus', label: 'Creează grup' };
    } else if (path.includes('register')) {
        currentPage = 'register';
    }
    
    return { currentPage, ctaButton };
}

function createNavigation() {
    const { currentPage, ctaButton } = getPageConfig();
    
    const navItems = [
        { href: '/index.html', label: 'Acasă', id: 'home' },
        { href: '/ce-este/', label: 'Ce este', id: 'about' },
        { href: '/terenuri.html', label: 'Terenuri', id: 'land' },
        { href: '/utilizatori.html', label: 'Utilizatori', id: 'users' },
        { href: '/grupuri.html', label: 'Grupuri', id: 'groups' },
    ];

    const navLinksHTML = navItems.map(item => {
        const isActive = currentPage === item.id;
        return `<a href="${item.href}" class="unified-nav-link ${isActive ? 'active' : ''}">${item.label}</a>`;
    }).join('');

    const ctaHTML = ctaButton 
        ? `<a href="${ctaButton.href}" class="unified-btn-cta"><i class="fas ${ctaButton.icon}"></i> ${ctaButton.label}</a>` 
        : '';

    return `
    <nav class="unified-nav">
        <div class="unified-nav-inner">
            <a href="/index.html" class="unified-nav-logo">
                <span class="logo-a">Apartamen</span><span class="logo-tu">TU</span><span class="logo-al">al</span>
            </a>
            <div class="unified-nav-links">
                ${navLinksHTML}
            </div>
            <div class="unified-nav-actions">
                ${ctaHTML}
                <div class="unified-nav-user" id="navUser" style="display:none;">
                    <button class="unified-btn-avatar" id="btnUserAvatar">
                        <i class="fas fa-user-circle"></i>
                    </button>
                    <div class="unified-user-dropdown" id="userDropdown">
                        <a href="#" id="navProfileLink"><i class="fas fa-user"></i> Profilul meu</a>
                        <button id="btnLogout"><i class="fas fa-sign-out-alt"></i> Deconectare</button>
                    </div>
                </div>
                <a href="#" class="unified-btn-login" id="btnLoginNav" onclick="event.preventDefault(); if(typeof openLoginModal==='function') openLoginModal();">
                    <i class="fas fa-sign-in-alt"></i> Intră în cont
                </a>
            </div>
            <button class="unified-nav-burger" id="navMobileToggle">
                <i class="fas fa-bars"></i>
            </button>
        </div>
        <div class="unified-nav-mobile" id="navMobileMenu" style="display:none;">
            ${navLinksHTML}
            ${ctaHTML}
            <a href="#" class="unified-btn-login" id="btnLoginNavMobile" onclick="event.preventDefault(); if(typeof openLoginModal==='function') openLoginModal();">
                <i class="fas fa-sign-in-alt"></i> Intră în cont
            </a>
        </div>
    </nav>`;
}

function loadNavigation() {
    // Try #navigation container first (Acasă, Ce este pages)
    const navContainer = document.getElementById('navigation');
    if (navContainer) {
        navContainer.innerHTML = createNavigation();
        setupNavBehavior();
        checkAuthState();
        return;
    }
    // If no container, try replacing existing nav (Terenuri, Grupuri, Utilizatori)
    const existingNav = document.querySelector('nav.navbar, nav.main-nav');
    if (existingNav) {
        const wrapper = document.createElement('div');
        wrapper.id = 'navigation';
        wrapper.innerHTML = createNavigation();
        existingNav.parentNode.replaceChild(wrapper, existingNav);
        setupNavBehavior();
        checkAuthState();
    }
}

function setupNavBehavior() {
    // Mobile toggle
    const mobileToggle = document.getElementById('navMobileToggle');
    const mobileMenu = document.getElementById('navMobileMenu');
    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = mobileMenu.style.display !== 'none';
            mobileMenu.style.display = isOpen ? 'none' : 'flex';
            mobileToggle.querySelector('i').className = isOpen ? 'fas fa-bars' : 'fas fa-times';
        });
    }

    // User avatar dropdown
    const avatarBtn = document.getElementById('btnUserAvatar');
    const dropdown = document.getElementById('userDropdown');
    if (avatarBtn && dropdown) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdown.classList.remove('show'));
    }

    // Profile link
    const profileLink = document.getElementById('navProfileLink');
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.currentUserId) {
                window.location.href = '/profile-view-new.html?id=' + window.currentUserId;
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                var url = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://glbvbbgmcobtswwlktic.supabase.co';
                var key = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'sb_publishable_I25cj3p8FZJyTAe0X2ngDA_vvz6ssWz';
                var client = window.supabase.createClient(url, key);
                await client.auth.signOut();
                window.location.href = '/index.html';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }
}

async function checkAuthState() {
    try {
        if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
            setTimeout(checkAuthState, 200);
            return;
        }

        var url = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://glbvbbgmcobtswwlktic.supabase.co';
        var key = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'sb_publishable_I25cj3p8FZJyTAe0X2ngDA_vvz6ssWz';
        var client = window.supabase.createClient(url, key);

        const { data: { user } } = await client.auth.getUser();
        window.currentUserId = user ? user.id : null;

        const navUser = document.getElementById('navUser');
        const btnLogin = document.getElementById('btnLoginNav');
        const btnLoginMobile = document.getElementById('btnLoginNavMobile');

        if (user) {
            if (navUser) navUser.style.display = 'flex';
            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLoginMobile) btnLoginMobile.style.display = 'none';
        } else {
            if (navUser) navUser.style.display = 'none';
            if (btnLogin) btnLogin.style.display = 'flex';
            if (btnLoginMobile) btnLoginMobile.style.display = 'flex';
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadNavigation);

})();
