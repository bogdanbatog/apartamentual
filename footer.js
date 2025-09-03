// Footer component
function createFooter() {
    const currentYear = new Date().getFullYear();
    
    const footerHTML = `
        <footer class="border-t py-8 text-sm">
            <div class="container flex flex-wrap items-center justify-between gap-4">
                <p>© ${currentYear} ApartamenTUal</p>
                <div class="flex gap-4">
                    <a href="termeni.html">Termeni</a>
                    <a href="gdpr.html">GDPR</a>
                    <a href="contact.html">Contact</a>
                </div>
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