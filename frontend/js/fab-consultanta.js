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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(createButton, 150); });
    } else {
        setTimeout(createButton, 150);
    }
})();
