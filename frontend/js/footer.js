// Unified Footer component — ApartamenTUal
// Used on ALL pages

function createFooter() {
    const currentYear = new Date().getFullYear();

    return `
        <style>
            .site-footer {
                background: #0f172a;
                padding: 48px 24px 0;
                margin-top: 3rem;
            }
            .site-footer-container {
                max-width: 1200px;
                margin: 0 auto;
                display: grid;
                grid-template-columns: 2fr 1fr 1fr;
                gap: 40px;
                padding-bottom: 40px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .site-footer-logo {
                font-size: 1.15rem;
                font-weight: 700;
                display: block;
                margin-bottom: 10px;
            }
            .site-footer .logo-apart, .site-footer .logo-al { color: #cbd5e1; }
            .site-footer .logo-tu { color: #f97316; }
            .site-footer-col p {
                font-size: 0.87rem;
                color: #94a3b8;
                line-height: 1.6;
                margin: 0;
            }
            .site-footer-col h4 {
                font-size: 0.82rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #cbd5e1;
                margin: 0 0 14px 0;
            }
            .site-footer-col a {
                display: block;
                font-size: 0.87rem;
                color: #94a3b8;
                margin-bottom: 8px;
                text-decoration: none;
                transition: color 0.15s;
            }
            .site-footer-col a:hover { color: #f97316; }
            .site-footer-bottom {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px 0;
                text-align: center;
            }
            .site-footer-bottom p {
                font-size: 0.8rem;
                color: #64748b;
                margin: 0;
            }
            @media (max-width: 768px) {
                .site-footer-container {
                    grid-template-columns: 1fr;
                    gap: 24px;
                }
            }
        </style>
        <footer class="site-footer">
            <div class="site-footer-container">
                <div class="site-footer-col">
                    <span class="site-footer-logo">
                        <span class="logo-apart">Apartamen</span><span class="logo-tu">TU</span><span class="logo-al">al</span>
                    </span>
                    <p>Platformă pentru grupuri de construcție colaborativă în România.</p>
                </div>
                <div class="site-footer-col">
                    <h4>Navigare</h4>
                    <a href="/index.html">Acasă</a>
                    <a href="/ce-este/">Ce este</a>
                    <a href="/terenuri.html">Terenuri</a>
                    <a href="/utilizatori.html">Utilizatori</a>
                    <a href="/grupuri.html">Grupuri</a>
                    <a href="/parteneri.html">Parteneri</a>
                </div>
                <div class="site-footer-col">
                    <h4>Legal</h4>
                    <a href="/termeni.html">Termeni și condiții</a>
                    <a href="/gdpr.html">GDPR</a>
                    <a href="/contact.html#faq-container">FAQ</a>
                    <a href="/ghid.html">Ghid platformă</a>
                    <a href="/contact.html">Contact</a>
                </div>
            </div>
            <div class="site-footer-bottom">
                <p>&copy; ${currentYear} ApartamenTUal. Toate drepturile rezervate.</p>
            </div>
        </footer>
    `;
}

function loadFooter() {
    const footerContainer = document.getElementById('footer');
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFooter();
});
