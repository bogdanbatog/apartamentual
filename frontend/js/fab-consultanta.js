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

        function observeFooter(el) {
            new IntersectionObserver(function(entries) {
                btn.style.display = entries[0].isIntersecting ? 'none' : 'flex';
            }, { rootMargin: '80px' }).observe(el);
        }

        var container = document.getElementById('footer');
        if (container) {
            var inner = container.querySelector('footer');
            if (inner) {
                observeFooter(inner);
            } else {
                var check = setInterval(function() {
                    var f = container.querySelector('footer');
                    if (f) { observeFooter(f); clearInterval(check); }
                }, 200);
                setTimeout(function() { clearInterval(check); }, 5000);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(createButton, 150); });
    } else {
        setTimeout(createButton, 150);
    }
})();
