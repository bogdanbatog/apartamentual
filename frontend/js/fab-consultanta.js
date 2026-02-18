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

        // Hide button when footer is visible
        var footer = document.querySelector('footer') || document.getElementById('footer');
        if (footer) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        btn.style.opacity = '0';
                        btn.style.pointerEvents = 'none';
                    } else {
                        btn.style.opacity = '1';
                        btn.style.pointerEvents = 'auto';
                    }
                });
            }, { threshold: 0.1 });
            observer.observe(footer);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        // Small delay to ensure footer.js has run
        setTimeout(createButton, 100);
    }
})();
