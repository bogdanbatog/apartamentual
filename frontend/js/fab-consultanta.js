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

        // Hide button completely when footer is visible
        // Look for the actual <footer> element (created by footer.js) or the container
        var footer = document.querySelector('footer') || document.getElementById('footer');
        if (footer) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    btn.style.display = entry.isIntersecting ? 'none' : 'flex';
                });
            }, { threshold: 0.01 });

            // If footer.js hasn't rendered yet, wait for it
            if (footer.querySelector('footer')) {
                observer.observe(footer.querySelector('footer'));
            } else {
                // Observe the container, and also watch for the inner footer to appear
                observer.observe(footer);
                var checkFooter = setInterval(function() {
                    var innerFooter = footer.querySelector('footer');
                    if (innerFooter) {
                        observer.disconnect();
                        observer.observe(innerFooter);
                        clearInterval(checkFooter);
                    }
                }, 200);
                // Stop checking after 5 seconds
                setTimeout(function() { clearInterval(checkFooter); }, 5000);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(createButton, 150);
        });
    } else {
        setTimeout(createButton, 150);
    }
})();
