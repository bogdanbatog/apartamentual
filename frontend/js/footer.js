// Unified Footer component — ApartamenTUal (stil v9)
// Folosit pe TOATE paginile (mai puțin homepage care are footer inline).

(function() {

function injectFooterStyles() {
    if (document.getElementById('site-footer-styles')) return;
    var style = document.createElement('style');
    style.id = 'site-footer-styles';
    style.textContent = `
    /* ── Banda footer (full-width, fundal crem v9) ── */
    .site-footer-band{
        background:#faf8f3;
        border-top:1px solid rgba(0,0,0,0.10);
        margin-top:3rem;
        font-family:"Mona Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color:#1a1a1a;
    }
    .site-footer-band .site-footer-wrap{
        max-width:1100px;
        margin:0 auto;
        padding:64px 1.5rem 32px;
    }
    .site-footer-main{
        display:grid;
        grid-template-columns:1.4fr 1fr 1fr;
        gap:48px;
        margin-bottom:64px;
    }
    .site-footer-brand .site-footer-logo{
        font-size:19px;
        font-weight:500;
        letter-spacing:-0.005em;
        color:#1a1a1a;
        text-decoration:none;
        display:inline-block;
    }
    .site-footer-brand .site-footer-logo b{ font-weight:600; transition:color .5s ease; }
    .site-footer-by{
        font-size:11px;
        letter-spacing:0.06em;
        color:#8a8a8a;
        margin:6px 0 18px;
    }
    .site-footer-tag{
        font-size:13.5px;
        line-height:1.6;
        color:#555555;
        margin:0;
        max-width:280px;
    }
    .site-footer-col h4{
        font-size:11px;
        font-weight:500;
        letter-spacing:0.16em;
        text-transform:uppercase;
        color:#8a8a8a;
        margin:0 0 18px;
    }
    .site-footer-col ul{
        list-style:none;
        padding:0;
        margin:0;
        display:flex;
        flex-direction:column;
        gap:10px;
    }
    .site-footer-col a{
        font-size:14px;
        color:#1a1a1a;
        text-decoration:none;
        transition:opacity .2s ease;
    }
    .site-footer-col a:hover{ opacity:0.6; }

    /* Banda firmă (cerință Netopia/ANPC) */
    .site-footer-legal{
        padding:24px 0;
        border-top:1px solid rgba(0,0,0,0.10);
        display:flex;
        flex-wrap:wrap;
        gap:8px 24px;
        font-size:12px;
        line-height:1.6;
        color:#555555;
    }
    .site-footer-legal b{ font-weight:600; color:#1a1a1a; }
    .site-footer-legal a{ color:#555555; text-decoration:none; }
    .site-footer-legal a:hover{ color:#1a1a1a; }

    /* Bandă plăți Netopia + ANPC */
    .site-footer-payments{
        padding:20px 0;
        border-top:1px solid rgba(0,0,0,0.10);
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:space-between;
        gap:16px;
    }
    .site-footer-payments .netopia-badge{
        display:inline-flex;
        align-items:center;
        background:#1a1a1a;
        border-radius:6px;
        padding:8px 14px;
    }
    .site-footer-payments .netopia-badge img{
        height:24px; width:auto; display:block;
    }
    .site-footer-anpc{
        display:flex; gap:18px;
        font-family:"JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
        font-size:11px; letter-spacing:0.06em; text-transform:uppercase;
    }
    .site-footer-anpc a{ color:#8a8a8a; text-decoration:none; }
    .site-footer-anpc a:hover{ color:#1a1a1a; }

    .site-footer-bottom{
        padding-top:28px;
        border-top:1px solid rgba(0,0,0,0.10);
        display:flex;
        justify-content:space-between;
        align-items:baseline;
        font-family:"JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
        font-size:11px;
        letter-spacing:0.06em;
        color:#8a8a8a;
        text-transform:uppercase;
    }

    @media (max-width:768px){
        .site-footer-main{ grid-template-columns:1fr 1fr; gap:36px; }
        .site-footer-brand{ grid-column:1 / -1; }
        .site-footer-bottom{ flex-direction:column; align-items:flex-start; gap:8px; }
        .site-footer-band .site-footer-wrap{ padding:48px 1.5rem 24px; }
    }
    `;
    document.head.appendChild(style);
}

function createFooter() {
    return `
    <div class="site-footer-band">
      <div class="site-footer-wrap">
        <div class="site-footer-main">
            <div class="site-footer-brand">
                <a href="/" class="site-footer-logo"><span>apartamen<b>TU</b>al</span></a>
                <p class="site-footer-by">by LTFB Studio</p>
                <p class="site-footer-tag">Platformă de construcție colaborativă în România. Construim împreună, împărțim costurile, câștigăm o comunitate.</p>
            </div>
            <div class="site-footer-col">
                <h4>Navigare</h4>
                <ul>
                    <li><a href="/ce-este/">Ce este</a></li>
                    <li><a href="/povestea-noastra.html">Povestea noastră</a></li>
                    <li><a href="/terenuri.html">Terenuri</a></li>
                    <li><a href="/utilizatori.html">Utilizatori</a></li>
                    <li><a href="/grupuri.html">Grupuri</a></li>
                    <li><a href="/parteneri.html">Parteneri</a></li>
                </ul>
            </div>
            <div class="site-footer-col">
                <h4>Legal</h4>
                <ul>
                    <li><a href="/termeni.html">Termeni și condiții</a></li>
                    <li><a href="/gdpr.html">GDPR</a></li>
                    <li><a href="/politica-retur.html">Politica de retur</a></li>
                    <li><a href="/contact.html#faq-container">FAQ</a></li>
                    <li><a href="/ghid.html">Ghid platformă</a></li>
                    <li><a href="/contact.html">Contact</a></li>
                </ul>
            </div>
        </div>

        <!-- Identificare firmă (cerință Netopia / ANPC) -->
        <div class="site-footer-legal">
            <span><b>SC LTFB Studio SRL</b></span>
            <span>CUI: RO22004992</span>
            <span>Reg. Com.: J2007012417402</span>
            <span>Sediu: Str. Popa Petre 23, Sector 2, București</span>
            <span>Telefon: <a href="tel:+40723870834">+40 723 870 834</a></span>
            <span>Email: <a href="mailto:office@ltfbstudio.ro">office@ltfbstudio.ro</a></span>
        </div>

        <!-- Plăți Netopia + ANPC -->
        <div class="site-footer-payments">
            <a href="https://netopia-payments.com" target="_blank" rel="noopener" title="Plăți procesate de NETOPIA Payments" class="netopia-badge">
                <img src="https://mny.ro/np-white-0.svg" alt="NETOPIA Payments — Visa, Mastercard" loading="lazy">
            </a>
            <div class="site-footer-anpc">
                <a href="https://anpc.ro" target="_blank" rel="noopener">ANPC</a>
                <a href="https://anpc.ro/sal/" target="_blank" rel="noopener">SAL</a>
                <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener">Platforma SAL</a>
            </div>
        </div>

        <div class="site-footer-bottom">
            <span>© MMXXVI · ApartamenTUal · București</span>
            <span>apartamentual.ro</span>
        </div>
      </div>
    </div>
    `;
}

// Animația de culoare pe „TU" din footer — sincronizată cu nav-ul
function startFooterLogoColorCycle() {
    const palette = ['#c2604a','#5e8a6c','#5a7196','#a76782','#b8965c','#7a9a90'];
    const tuEls = document.querySelectorAll('.site-footer-logo b');
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

function loadFooter() {
    injectFooterStyles();
    const footerContainer = document.getElementById('footer');
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
        startFooterLogoColorCycle();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFooter();
});

})();
