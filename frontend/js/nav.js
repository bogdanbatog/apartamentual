// ══════════════════════════════════════════════════════════════
// UNIFIED NAVIGATION COMPONENT — ApartamenTUal
// Used on ALL pages: Acasă, Ce este, Terenuri, Utilizatori, Grupuri, etc.
// Uses global `sb` (and `supabase`) from supabase-config.js
// ══════════════════════════════════════════════════════════════

// Global notify helper - available on all pages
window.notifyAdmins = async function(eventType, data) {
    try {
        if (typeof sb === 'undefined' || !sb) return;
        await sb.functions.invoke('notify-admins', {
            body: { event_type: eventType, ...data }
        });
    } catch (err) {
        console.warn('Notify failed:', err);
    }
};

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
    } else if (path.includes('parteneri')) {
        currentPage = 'partners';
    } else if (path.includes('register')) {
        currentPage = 'register';
        // Flag to use direct link for login instead of modal
        window._registerPage = true;
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
        { href: '/parteneri.html', label: 'Parteneri', id: 'partners' },
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
                <span class="logo-a">Apartamen</span><span class="logo-tu">TU</span><span class="logo-al">al</span> <span class="logo-by">by LTFB studio</span>
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
                <a href="#" class="unified-btn-login" id="btnLoginNav" onclick="event.preventDefault(); if(window._registerPage){window.location.href='/index.html?login=1';return;} if(typeof openLoginModal==='function') openLoginModal(); else window.location.href='/index.html?login=1';">
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
            <a href="#" class="unified-btn-login" id="btnLoginNavMobile" onclick="event.preventDefault(); if(window._registerPage){window.location.href='/index.html?login=1';return;} if(typeof openLoginModal==='function') openLoginModal(); else window.location.href='/index.html?login=1';">
                <i class="fas fa-sign-in-alt"></i> Intră în cont
            </a>
            <div class="unified-nav-mobile-user" id="navMobileUser" style="display:none;">
                <a href="#" class="unified-nav-link" id="btnProfileMobile"><i class="fas fa-user"></i> Profilul meu</a>
                <button class="unified-nav-link" id="btnLogoutMobile" style="text-align:left; background:none; border:none; cursor:pointer; font-family:inherit; width:100%;"><i class="fas fa-sign-out-alt"></i> Deconectare</button>
            </div>
        </div>
    </nav>`;
}

function loadNavigation() {
    const navContainer = document.getElementById('navigation');
    if (navContainer) {
        navContainer.innerHTML = createNavigation();
        setupNavBehavior();
        checkAuthState();
        return;
    }
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
    const mobileToggle = document.getElementById('navMobileToggle');
    const mobileMenu = document.getElementById('navMobileMenu');
    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = mobileMenu.style.display !== 'none';
            mobileMenu.style.display = isOpen ? 'none' : 'flex';
            mobileToggle.querySelector('i').className = isOpen ? 'fas fa-bars' : 'fas fa-times';
        });
    }

    const avatarBtn = document.getElementById('btnUserAvatar');
    const dropdown = document.getElementById('userDropdown');
    if (avatarBtn && dropdown) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdown.classList.remove('show'));
    }

    const profileLink = document.getElementById('navProfileLink');
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.currentUserId) {
                window.location.href = '/profile-view-new.html?id=' + window.currentUserId;
            }
        });
    }

    // Logout — uses global `sb` from supabase-config.js
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await sb.auth.signOut();
                window.location.href = '/index.html';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }

    // Mobile profile link
    const profileLinkMobile = document.getElementById('btnProfileMobile');
    if (profileLinkMobile) {
        profileLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.currentUserId) {
                window.location.href = '/profile-view-new.html?id=' + window.currentUserId;
            }
        });
    }

    // Mobile logout
    const logoutBtnMobile = document.getElementById('btnLogoutMobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', async () => {
            try {
                await sb.auth.signOut();
                window.location.href = '/index.html';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }
}

async function checkAuthState() {
    try {
        // Wait for global sb client from supabase-config.js
        if (typeof sb === 'undefined' || !sb) {
            if (!checkAuthState._retries) checkAuthState._retries = 0;
            if (checkAuthState._retries < 25) {
                checkAuthState._retries++;
                setTimeout(checkAuthState, 200);
                return;
            }
            return;
        }

        const { data: { user } } = await sb.auth.getUser();
        window.currentUserId = user ? user.id : null;

        const navUser = document.getElementById('navUser');
        const navMobileUser = document.getElementById('navMobileUser');
        const btnLogin = document.getElementById('btnLoginNav');
        const btnLoginMobile = document.getElementById('btnLoginNavMobile');

        if (user) {
            // Check if account is suspended or deleted (skip on admin pages)
            var isAdminPage = window.location.pathname.includes('admin');
            if (!isAdminPage) {
            try {
                var { data: prof } = await sb.from('profiles').select('suspended_until, account_status').eq('user_id', user.id).single();
                if (prof) {
                    var isSuspended = prof.suspended_until && new Date(prof.suspended_until) > new Date();
                    var isDeleted = prof.account_status === 'deleted';
                    if (isSuspended || isDeleted) {
                        // Sign out
                        await sb.auth.signOut();
                        window.currentUserId = null;
                        // Show suspension overlay
                        var overlay = document.createElement('div');
                        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;';
                        var msg = isDeleted
                            ? '<h2 style="margin-bottom:8px;">Cont dezactivat</h2><p>Acest cont a fost dezactivat de administratorul platformei.</p>'
                            : '<h2 style="margin-bottom:8px;">Cont suspendat</h2><p>Contul tău este suspendat până la <strong>' + new Date(prof.suspended_until).toLocaleDateString('ro-RO') + '</strong>.</p><p style="margin-top:8px; font-size:13px; opacity:0.7;">Dacă ai întrebări, contactează echipa ApartamenTUal.</p>';
                        overlay.innerHTML = '<div style="background:white; border-radius:12px; padding:2.5rem; max-width:440px; width:90%; text-align:center; font-family:DM Sans,sans-serif;">' + msg + '<a href="/index.html" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#1e293b; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Înapoi la pagina principală</a></div>';
                        document.body.appendChild(overlay);
                        // Hide nav elements
                        if (navUser) navUser.style.display = 'none';
                        if (navMobileUser) navMobileUser.style.display = 'none';
                        if (btnLogin) btnLogin.style.display = 'flex';
                        if (btnLoginMobile) btnLoginMobile.style.display = 'flex';
                        return;
                    }
                }
            } catch(e) { console.warn('Suspension check failed:', e); }
            } // end !isAdminPage

            if (navUser) navUser.style.display = 'flex';
            if (navMobileUser) navMobileUser.style.display = 'flex';
            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLoginMobile) btnLoginMobile.style.display = 'none';
        } else {
            if (navUser) navUser.style.display = 'none';
            if (navMobileUser) navMobileUser.style.display = 'none';
            if (btnLogin) btnLogin.style.display = 'flex';
            if (btnLoginMobile) btnLoginMobile.style.display = 'flex';
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadNavigation();

    // Scroll-to-top button
    var btn = document.createElement('button');
    btn.id = 'scrollToTop';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Înapoi sus');
    btn.style.cssText = 'position:fixed; bottom:24px; left:24px; width:42px; height:42px; border-radius:50%; background:#1e293b; color:white; border:none; cursor:pointer; font-size:16px; display:none; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,0.15); transition:all 0.3s; z-index:90;';
    btn.onmouseover = function() { this.style.background = '#f97316'; };
    btn.onmouseout = function() { this.style.background = '#1e293b'; };
    btn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.body.appendChild(btn);

    window.addEventListener('scroll', function() {
        btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
    });

    // FAB Consultation button (skip on admin and consultanta pages)
    var p = window.location.pathname;
    if (!p.includes('admin') && !p.includes('consultanta')) {
        var fab = document.createElement('a');
        fab.href = '/consultanta.html';
        fab.title = 'Cere consultanță';
        fab.style.cssText = 'position:fixed; bottom:24px; right:24px; display:flex; align-items:center; gap:8px; background:#1e293b; color:white; text-decoration:none; padding:12px 20px; border-radius:50px; font-size:14px; font-weight:500; font-family:DM Sans,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.2); transition:all 0.3s; z-index:90;';
        fab.innerHTML = '<i class="fas fa-comments"></i> <span>Cere consultanță</span>';
        fab.onmouseover = function() { this.style.background = '#f97316'; };
        fab.onmouseout = function() { this.style.background = '#1e293b'; };
        document.body.appendChild(fab);
    }
});

})();
