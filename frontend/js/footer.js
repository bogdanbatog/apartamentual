// Footer component
function createFooter() {
    const currentYear = new Date().getFullYear();
    
    const footerHTML = `
        <footer class="border-t py-8 text-sm">
            <div class="container text-center">
                <div class="flex justify-center gap-6 mb-3">
                    <a href="/termeni.html">Termeni</a>
                    <a href="/gdpr.html">GDPR</a>
                    <a href="/contact.html">Contact</a>
                </div>
                <p class="text-gray-500">© ${currentYear} ApartamenTUal</p>
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
