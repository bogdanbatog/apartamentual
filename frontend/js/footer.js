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

            /* Company identification band — required by Netopia/ANPC */
            .site-footer-company {
                max-width: 1200px;
                margin: 0 auto;
                padding: 24px 0;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                display: flex;
                flex-wrap: wrap;
                gap: 8px 24px;
                font-size: 0.82rem;
                color: #94a3b8;
                line-height: 1.6;
            }
            .site-footer-company strong { color: #cbd5e1; font-weight: 600; }
            .site-footer-company a { color: #94a3b8; text-decoration: none; }
            .site-footer-company a:hover { color: #f97316; }

            /* Payment logos + ANPC band */
            .site-footer-payments {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px 0;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .site-footer-payments-logos {
                display: flex;
                align-items: center;
                gap: 18px;
                flex-wrap: wrap;
            }
            .site-footer-payments-logos img {
                height: 24px;
                width: auto;
                opacity: 0.85;
                filter: brightness(0) invert(1);
                transition: opacity 0.15s;
            }
            .site-footer-payments-logos a:hover img { opacity: 1; }
            .site-footer-payments-logos .logo-netopia { height: 28px; filter: none; }
            .site-footer-payments-anpc {
                display: flex;
                gap: 14px;
                font-size: 0.78rem;
                color: #94a3b8;
                flex-wrap: wrap;
            }
            .site-footer-payments-anpc a {
                color: #94a3b8;
                text-decoration: underline;
                text-decoration-color: rgba(148, 163, 184, 0.3);
            }
            .site-footer-payments-anpc a:hover { color: #f97316; }

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
                .site-footer-payments {
                    flex-direction: column;
                    align-items: flex-start;
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
                    <a href="/povestea-noastra.html">Povestea noastră</a>
                    <a href="/terenuri.html">Terenuri</a>
                    <a href="/utilizatori.html">Utilizatori</a>
                    <a href="/grupuri.html">Grupuri</a>
                    <a href="/parteneri.html">Parteneri</a>
                </div>
                <div class="site-footer-col">
                    <h4>Legal</h4>
                    <a href="/termeni.html">Termeni și condiții</a>
                    <a href="/gdpr.html">GDPR</a>
                    <a href="/politica-retur.html">Politica de retur</a>
                    <a href="/contact.html#faq-container">FAQ</a>
                    <a href="/ghid.html">Ghid platformă</a>
                    <a href="/contact.html">Contact</a>
                </div>
            </div>

            <!-- Company identification (Netopia + ANPC requirement) -->
            <div class="site-footer-company">
                <span><strong>SC LTFB Studio SRL</strong></span>
                <span>CUI: <strong>RO22004992</strong></span>
                <span>Reg. Com.: <strong>J40/12417/2007</strong></span>
                <span>Sediu: Str. Popa Petre 23, Sector 2, București</span>
                <span>Telefon: <a href="tel:+40723870834">+40 723 870 834</a></span>
                <span>Email: <a href="mailto:office@ltfbstudio.ro">office@ltfbstudio.ro</a></span>
            </div>

            <!-- Payment logos + ANPC SOL/SAL links (Netopia approval requirement) -->
            <div class="site-footer-payments">
                <div class="site-footer-payments-logos">
                    <img src="/assets/payment-logos/visa.svg" alt="Visa" loading="lazy">
                    <img src="/assets/payment-logos/mastercard.svg" alt="Mastercard" loading="lazy">
                    <a href="https://netopia-payments.com" target="_blank" rel="noopener" title="Plăți procesate de NETOPIA Payments">
                        <img class="logo-netopia" src="/assets/payment-logos/netopia.svg" alt="NETOPIA Payments" loading="lazy">
                    </a>
                </div>
                <div class="site-footer-payments-anpc">
                    <a href="https://anpc.ro" target="_blank" rel="noopener">ANPC</a>
                    <a href="https://anpc.ro/sal/" target="_blank" rel="noopener">SAL</a>
                    <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener">Platforma SAL</a>
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
