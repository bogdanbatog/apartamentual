// Footer component
function createFooter() {
    const currentYear = new Date().getFullYear();
    
    const footerHTML = `
        <footer style="border-top: 1px solid #e2e8f0; padding: 2rem 1rem; font-size: 0.875rem;">
            <div style="max-width: 1280px; margin: 0 auto; text-align: center;">
                <div style="display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 0.75rem;">
                    <a href="/termeni.html" style="color: #64748b; text-decoration: none;">Termeni</a>
                    <a href="/gdpr.html" style="color: #64748b; text-decoration: none;">GDPR</a>
                    <a href="/contact.html" style="color: #64748b; text-decoration: none;">Contact</a>
                </div>
                <p style="color: #94a3b8; margin: 0;">© ${currentYear} ApartamenTUal</p>
            </div>
        </footer>
    `;

    return footerHTML;
}

// Function to inject footer into the page
function loadFooter() {
    const footerContainer = document.getElementById('footer');
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
    }
}

// Initialize footer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadFooter();
});
