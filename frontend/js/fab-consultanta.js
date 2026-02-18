// Floating Consultation Button - auto-inject on every page
(function() {
    if (window.location.pathname.includes('admin')) return;
    if (window.location.pathname.includes('contact')) return;

    function createButton() {
        if (document.querySelector('.fab-consultanta')) return;

        var btn = document.createElement('a');
        btn.href = '/contact.html';
        btn.className = 'fab-consultanta';
        btn.title = 'Cere consultanță';
        btn.innerHTML = '<span class="fab-consultanta-icon"><i class="fas fa-comments"></i></span>' +
                         '<span class="fab-consultanta-text">Cere consultanță</span>';
        document.body.appendChild(btn);

        // Hide when near bottom of page (where footer links are)
        window.addEventListener('scroll', function() {
            var scrollBottom = window.innerHeight + window.scrollY;
            var pageHeight = document.body.offsetHeight;
            // Hide when within 100px of page bottom
            btn.style.display = (pageHeight - scrollBottom < 100) ? 'none' : 'flex';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(createButton, 150); });
    } else {
        setTimeout(createButton, 150);
    }
})();
