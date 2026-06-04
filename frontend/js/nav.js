// ══════════════════════════════════════════════════════════════
// UNIFIED NAVIGATION COMPONENT — ApartamenTUal (stil v9)
// Folosit pe TOATE paginile (mai puțin homepage care are nav inline).
// Folosește global `sb` (și `supabase`) din supabase-config.js.
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

// ── Font + stiluri v9 (injectate o singură dată) ──
function injectChromeAssets() {
    if (document.getElementById('site-chrome-assets')) return;

    // Preconnect + Mona Sans
    var pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pre1);
    var pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = '';
    document.head.appendChild(pre2);
    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Mona+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(font);

    var style = document.createElement('style');
    style.id = 'site-chrome-assets';
    style.textContent = `
    /* ── Banda nav (full-width, fundal crem v9) ── */
    .site-nav-band{
        background:#faf8f3;
        border-bottom:1px solid rgba(0,0,0,0.10);
    }
    .site-nav-band .site-nav-wrap{
        max-width:1100px;
        margin:0 auto;
        padding:0 1.5rem;
    }
    .site-nav{
        display:flex;
        align-items:center;
        justify-content:space-between;
        height:68px;          /* înălțime fixă → band-ul = 68px + 1px border = 69px,
                                 egal cu spațiul rezervat pe #navigation. Nu mai depinde
                                 de starea logat/nelogat sau de încărcarea fontului. */
        box-sizing:border-box;
        gap:24px;
        font-family:"Mona Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color:#1a1a1a;
    }
    .site-logo{
        font-size:17px;
        font-weight:500;
        letter-spacing:-0.005em;
        color:#1a1a1a;
        text-decoration:none;
        display:inline-flex;
        align-items:baseline;
        gap:5px;
    }
    .site-logo .logo-mark{
        display:inline-flex;
        align-items:baseline;
        font-size:17px;
        font-weight:500;
        letter-spacing:-0.005em;
        color:#1a1a1a;
        font-family:inherit;
    }
    .site-logo b{ font-weight:600; transition:color .5s ease; }
    .site-logo .logo-by{
        font-size:11px;
        font-weight:400;
        letter-spacing:0.06em;
        color:#8a8a8a;
        white-space:nowrap;
    }
    .site-nav-links{
        display:flex;
        gap:32px;
        font-size:13.5px;
        font-weight:500;
    }
    .site-nav-links a{
        color:#1a1a1a;
        text-decoration:none;
        padding-bottom:2px;
        border-bottom:1px solid transparent;
        transition:border-color .2s ease;
    }
    .site-nav-links a:hover{ border-bottom-color:#1a1a1a; }
    .site-nav-links a.active{ border-bottom-color:#1a1a1a; }
    .site-nav-actions{
        display:flex;
        align-items:center;
        gap:12px;
        justify-content:flex-end; /* buton/avatar mereu lipite de dreapta */
    }
    .site-nav-cta{
        font-size:12px;
        font-weight:500;
        color:#1a1a1a;
        text-decoration:none;
        padding:6px 10px;
        border:1px solid #1a1a1a;
        border-radius:2px;
        white-space:nowrap;
        line-height:1.2;
        transition:background .2s ease, color .2s ease;
        display:inline-flex;
        align-items:center;
        gap:6px;
    }
    .site-nav-cta:hover{ background:#1a1a1a; color:#fff; }
    .site-nav-cta.ghost{
        border-color:rgba(0,0,0,0.25);
        color:#1a1a1a;
    }
    .site-nav-cta.ghost:hover{ background:rgba(0,0,0,0.03); color:#1a1a1a; }

    /* Link text de login (folosit pe homepage, alături de „Creează cont" CTA) */
    .site-nav-login-link{
        font-size:13px;
        font-weight:500;
        color:#1a1a1a;
        text-decoration:none;
        padding-bottom:2px;
        border-bottom:1px solid transparent;
        transition:border-color .2s ease;
        white-space:nowrap;
        line-height:1.2;
    }
    .site-nav-login-link:hover{ border-bottom-color:#1a1a1a; }

    /* User avatar + dropdown */
    .site-nav-user{ position:relative; }
    .site-btn-avatar{
        background:none;
        border:1px solid #1a1a1a;
        border-radius:50%;
        width:32px;
        height:32px;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        color:#1a1a1a;
        font-size:14px;
        padding:0;
        line-height:1;
    }
    .site-btn-avatar:hover{ background:#1a1a1a; color:#fff; }
    .site-user-dropdown{
        display:none;
        position:absolute;
        top:42px;
        right:0;
        background:#faf8f3;
        border:1px solid rgba(0,0,0,0.10);
        border-radius:4px;
        box-shadow:0 6px 20px rgba(0,0,0,0.10);
        min-width:180px;
        padding:6px;
        z-index:1000;
        font-family:"Mona Sans", sans-serif;
    }
    .site-user-dropdown.show{ display:block; }
    .site-user-dropdown a,
    .site-user-dropdown button{
        display:flex;
        align-items:center;
        gap:10px;
        width:100%;
        padding:8px 12px;
        font-size:13px;
        color:#1a1a1a;
        text-decoration:none;
        background:none;
        border:none;
        border-radius:2px;
        cursor:pointer;
        font-family:inherit;
        text-align:left;
        transition:background .15s;
    }
    .site-user-dropdown a:hover,
    .site-user-dropdown button:hover{ background:rgba(0,0,0,0.04); }
    .site-user-dropdown i{ width:14px; text-align:center; color:#8a8a8a; font-size:12px; }

    /* Mobile */
    .site-nav-burger{
        display:none;
        background:none;
        border:1px solid rgba(0,0,0,0.25);
        border-radius:2px;
        width:36px;
        height:36px;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        color:#1a1a1a;
        font-size:14px;
        padding:0;
    }
    .site-nav-mobile{
        display:none;
        flex-direction:column;
        gap:4px;
        padding:12px 0 18px;
        border-top:1px solid rgba(0,0,0,0.10);
        font-family:"Mona Sans", sans-serif;
    }
    .site-nav-mobile a{
        color:#1a1a1a;
        text-decoration:none;
        font-size:14px;
        padding:10px 12px;
        border-radius:2px;
        display:flex;
        align-items:center;
        gap:10px;
    }
    .site-nav-mobile a:hover{ background:rgba(0,0,0,0.04); }
    .site-nav-mobile a.active{ background:rgba(0,0,0,0.04); font-weight:600; }
    .site-nav-mobile .site-nav-cta{ justify-content:center; padding:10px; margin-top:6px; }
    .site-nav-mobile-user{ display:none; flex-direction:column; gap:4px; margin-top:6px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.10); }
    .site-nav-mobile-user button{
        background:none; border:none; cursor:pointer; font-family:inherit;
        width:100%; text-align:left; color:#1a1a1a; font-size:14px;
        padding:10px 12px; display:flex; align-items:center; gap:10px;
    }

    @media (max-width:768px){
        .site-nav-links{ display:none; }
        .site-nav-actions{ display:none; }
        .site-nav-burger{ display:flex; }
        .site-logo .logo-by{ display:none; }
    }

    /* Buton flotant scroll-to-top (stil v9) */
    .site-scroll-top{
        position:fixed; bottom:24px; left:24px; z-index:90;
        width:42px; height:42px; border-radius:50%;
        background:#1a1a1a; color:#fff; border:none; cursor:pointer;
        font-size:14px; display:none; align-items:center; justify-content:center;
        box-shadow:0 6px 20px rgba(0,0,0,0.18);
        font-family:"Mona Sans", sans-serif;
        transition:transform .2s ease;
    }
    .site-scroll-top:hover{ transform:translateY(-2px); }

    /* Buton flotant Cere consultanță (stil v9) */
    .site-fab-consult{
        position:fixed; bottom:24px; right:24px; z-index:90;
        display:inline-flex; align-items:center; gap:8px;
        background:#1a1a1a; color:#fff; text-decoration:none;
        padding:12px 18px; border-radius:50px;
        font-size:13px; font-weight:500;
        font-family:"Mona Sans", sans-serif;
        box-shadow:0 6px 20px rgba(0,0,0,0.18);
        transition:transform .2s ease;
    }
    .site-fab-consult:hover{ transform:translateY(-2px); color:#fff; }
    `;
    document.head.appendChild(style);
}

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
    } else if (path.includes('utilizatori')) {
        currentPage = 'users';
    } else if (path.includes('grup')) {
        currentPage = 'groups';
    } else if (path.includes('parteneri')) {
        currentPage = 'partners';
    } else if (path.includes('povestea-noastra')) {
        currentPage = 'story';
    } else if (path.includes('register')) {
        currentPage = 'register';
        window._registerPage = true;
    }

    return { currentPage, ctaButton };
}

function createNavigation() {
    const { currentPage, ctaButton } = getPageConfig();

    // Pe TOATE paginile afișăm aceleași elemente pentru neautentificați:
    //   „Intră în cont" (link text) + „Creează cont" (buton CTA în chenar).
    // Zona din dreapta are lățime fixă (vezi min-width mai jos), ca header-ul
    // să nu „sară" între pagini sau între stările logat/nelogat.
    const loginOnclick = "if(window._registerPage){window.location.href='/index.html?login=1';return;} if(typeof openLoginModal==='function') openLoginModal(); else window.location.href='/index.html?login=1';";

    // Markup pentru aria de auth — identic pe toate paginile
    const authHTML =
        `<a href="#" class="site-nav-login-link" id="btnLoginNav" style="display:none;" onclick="event.preventDefault(); ${loginOnclick}">Intră în cont</a>
         <a href="/register.html" class="site-nav-cta" id="btnRegisterCta" style="display:none;">Creează cont</a>`;
    const authMobileHTML =
        `<a href="#" class="site-nav-login-link" id="btnLoginNavMobile" style="display:none;" onclick="event.preventDefault(); ${loginOnclick}">Intră în cont</a>
         <a href="/register.html" class="site-nav-cta" id="btnRegisterCtaMobile" style="display:none;">Creează cont</a>`;

    const navItems = [
        { href: '/ce-este/',              label: 'Ce este',           id: 'about'    },
        { href: '/terenuri.html',         label: 'Terenuri',          id: 'land'     },
        { href: '/utilizatori.html',      label: 'Utilizatori',       id: 'users'    },
        { href: '/grupuri.html',          label: 'Grupuri',           id: 'groups'   },
        { href: '/parteneri.html',        label: 'Parteneri',         id: 'partners' },
        { href: '/povestea-noastra.html', label: 'Povestea noastră',  id: 'story'    },
    ];

    const navLinksHTML = navItems.map(item => {
        const isActive = currentPage === item.id;
        return `<a href="${item.href}" class="${isActive ? 'active' : ''}">${item.label}</a>`;
    }).join('');

    const ctaHTML = ctaButton
        ? `<a href="${ctaButton.href}" class="site-nav-cta ghost">${ctaButton.label}</a>`
        : '';

    return `
    <div class="site-nav-band">
      <div class="site-nav-wrap">
        <nav class="site-nav">
            <a href="/" class="site-logo">
                <span class="logo-mark">apartamen<b>TU</b>al</span>
                <span class="logo-by">by LTFB Studio</span>
            </a>
            <div class="site-nav-links">
                ${navLinksHTML}
            </div>
            <div class="site-nav-actions" style="min-width:200px;">
                ${ctaHTML}
                <div class="site-nav-user" id="navUser" style="display:none;">
                    <button class="site-btn-avatar" id="btnUserAvatar" aria-label="Meniu profil">
                        <i class="fas fa-user"></i>
                    </button>
                    <div class="site-user-dropdown" id="userDropdown">
                        <a href="#" id="navProfileLink"><i class="fas fa-user"></i> Profilul meu</a>
                        <button id="btnLogout"><i class="fas fa-sign-out-alt"></i> Deconectare</button>
                    </div>
                </div>
                ${authHTML}
            </div>
            <button class="site-nav-burger" id="navMobileToggle" aria-label="Meniu">
                <i class="fas fa-bars"></i>
            </button>
        </nav>
        <div class="site-nav-mobile" id="navMobileMenu" style="display:none;">
            ${navLinksHTML}
            ${ctaHTML}
            ${authMobileHTML}
            <div class="site-nav-mobile-user" id="navMobileUser" style="display:none;">
                <a href="#" id="btnProfileMobile"><i class="fas fa-user"></i> Profilul meu</a>
                <button id="btnLogoutMobile"><i class="fas fa-sign-out-alt"></i> Deconectare</button>
            </div>
        </div>
      </div>
    </div>`;
}

function loadNavigation() {
    injectChromeAssets();

    const navContainer = document.getElementById('navigation');
    if (navContainer) {
        navContainer.innerHTML = createNavigation();
        setupNavBehavior();
        startLogoColorCycle();
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
        startLogoColorCycle();
        checkAuthState();
    }
}

// Animația de culoare pe „TU" — identică cu cea de pe homepage v9
function startLogoColorCycle() {
    const palette = ['#c2604a','#5e8a6c','#5a7196','#a76782','#b8965c','#7a9a90'];
    const tuEls = document.querySelectorAll('.site-logo b');
    if (!tuEls.length) return;
    let i = Math.floor(Math.random() * palette.length);
    function paint(){
        const c = palette[i];
        tuEls.forEach(el => el.style.color = c);
    }
    paint();
    setInterval(() => {
        i = (i + 1) % palette.length;
        paint();
    }, 2400);
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
        // Pe homepage există și butonul „Creează cont" alături de link-ul de login
        const btnRegister = document.getElementById('btnRegisterCta');
        const btnRegisterMobile = document.getElementById('btnRegisterCtaMobile');

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
                        overlay.innerHTML = '<div style="background:#faf8f3; border-radius:4px; padding:2.5rem; max-width:440px; width:90%; text-align:center; font-family:Mona Sans,sans-serif; color:#1a1a1a;">' + msg + '<a href="/index.html" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#1a1a1a; color:white; border-radius:2px; text-decoration:none; font-weight:500; font-size:13px;">Înapoi la pagina principală</a></div>';
                        document.body.appendChild(overlay);
                        // Hide nav elements
                        if (navUser) navUser.style.display = 'none';
                        if (navMobileUser) navMobileUser.style.display = 'none';
                        if (btnLogin) btnLogin.style.display = 'inline-flex';
                        if (btnLoginMobile) btnLoginMobile.style.display = 'inline-flex';
                        if (btnRegister) btnRegister.style.display = 'inline-flex';
                        if (btnRegisterMobile) btnRegisterMobile.style.display = 'inline-flex';
                        return;
                    }
                }
            } catch(e) { console.warn('Suspension check failed:', e); }
            } // end !isAdminPage

            if (navUser) navUser.style.display = 'flex';
            if (navMobileUser) navMobileUser.style.display = 'flex';
            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLoginMobile) btnLoginMobile.style.display = 'none';
            if (btnRegister) btnRegister.style.display = 'none';
            if (btnRegisterMobile) btnRegisterMobile.style.display = 'none';
        } else {
            if (navUser) navUser.style.display = 'none';
            if (navMobileUser) navMobileUser.style.display = 'none';
            if (btnLogin) btnLogin.style.display = 'inline-flex';
            if (btnLoginMobile) btnLoginMobile.style.display = 'inline-flex';
            if (btnRegister) btnRegister.style.display = 'inline-flex';
            if (btnRegisterMobile) btnRegisterMobile.style.display = 'inline-flex';
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadNavigation();

    // Scroll-to-top button (stil v9)
    var btn = document.createElement('button');
    btn.id = 'scrollToTop';
    btn.className = 'site-scroll-top';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Înapoi sus');
    btn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.body.appendChild(btn);

    window.addEventListener('scroll', function() {
        btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
    });

    // FAB Consultanță (stil v9) — sărim pe admin și pe pagina consultanță
    var p = window.location.pathname;
    if (!p.includes('admin') && !p.includes('consultanta')) {
        var fab = document.createElement('a');
        fab.href = '/consultanta.html';
        fab.title = 'Cere consultanță';
        fab.className = 'site-fab-consult';
        fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg><span>Cere consultanță</span>';
        document.body.appendChild(fab);
    }
});

})();
