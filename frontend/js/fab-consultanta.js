// Floating Consultation Button - auto-inject on every page
(function() {
    // Don't show on admin page
    if (window.location.pathname.includes('admin')) return;

    function createButton() {
        // Avoid duplicates
        if (document.querySelector('.fab-consultanta')) return;

        var btn = document.createElement('div');
        btn.className = 'fab-consultanta';
        btn.title = 'Cere consultanță';
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.innerHTML = '<span class="fab-consultanta-icon"><i class="fas fa-comments"></i></span>' +
                         '<span class="fab-consultanta-text">Cere consultanță</span>';
        
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'mailto:office@ltfbstudio.ro?subject=Cerere%20consultan%C8%9B%C4%83%20ApartamenTUal';
        });

        document.body.appendChild(btn);
    }

    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        createButton();
    }
})();
