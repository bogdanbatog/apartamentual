// Floating Consultation Button - auto-inject on every page
(function() {
    // Don't show on admin page
    if (window.location.pathname.includes('admin')) return;

    document.addEventListener('DOMContentLoaded', function() {
        var btn = document.createElement('a');
        btn.href = 'mailto:office@ltfbstudio.ro?subject=Cerere%20consultan%C8%9B%C4%83%20ApartamenTUal';
        btn.className = 'fab-consultanta';
        btn.title = 'Cere consultanță';
        btn.innerHTML = '<span class="fab-consultanta-icon"><i class="fas fa-comments"></i></span>' +
                         '<span class="fab-consultanta-text">Cere consultanță</span>';
        document.body.appendChild(btn);
    });
})();
