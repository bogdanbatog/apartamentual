// Standalone Login Modal - works independently, no conflicts with page scripts
// Uses its own namespaced Supabase client and unique element IDs

(function() {
    'use strict';
    
    // Create modal HTML with unique IDs to avoid conflicts
    function createLoginModal() {
        const modal = document.createElement('div');
        modal.id = 'login-modal-overlay';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;';
        
        modal.innerHTML = `
            <div style="background:white; border-radius:12px; padding:2rem; max-width:420px; width:calc(100% - 2rem); margin:1rem; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h2 style="font-size:1.25rem; font-weight:600; margin:0;">Autentificare</h2>
                    <button id="lm-close" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#666; padding:0; line-height:1;">&times;</button>
                </div>
                
                <div id="lm-form">
                    <div style="margin-bottom:1rem;">
                        <label for="lm-email" style="display:block; font-size:0.875rem; font-weight:500; color:#374151; margin-bottom:0.25rem;">Email</label>
                        <input type="email" id="lm-email" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #d1d5db; border-radius:0.5rem; font-size:1rem; box-sizing:border-box;" placeholder="exemplu@email.com">
                    </div>
                    
                    <div style="margin-bottom:1rem;">
                        <label for="lm-password" style="display:block; font-size:0.875rem; font-weight:500; color:#374151; margin-bottom:0.25rem;">Parolă</label>
                        <input type="password" id="lm-password" style="width:100%; padding:0.5rem 0.75rem; border:1px solid #d1d5db; border-radius:0.5rem; font-size:1rem; box-sizing:border-box;" placeholder="Parola ta">
                    </div>
                    
                    <div id="lm-message" style="display:none; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; margin-bottom:1rem;"></div>
                    
                    <button id="lm-submit" style="width:100%; padding:0.75rem; background:#1e293b; color:white; border:none; border-radius:0.5rem; font-size:1rem; font-weight:500; cursor:pointer;">
                        Autentificare
                    </button>
                    
                    <p style="text-align:center; font-size:0.875rem; color:#6b7280; margin-top:1rem;">
                        Nu ai cont? <a href="/register.html" style="color:#2563eb; text-decoration:none;">Creează unul nou</a>
                    </p>
                </div>
                
                <div id="lm-success" style="display:none; text-align:center; padding:1rem 0;">
                    <div style="font-size:2rem; margin-bottom:0.5rem;">✓</div>
                    <p style="font-weight:500; color:#16a34a;">Autentificat cu succes!</p>
                    <p style="font-size:0.875rem; color:#6b7280;">Se reîncarcă pagina...</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close handlers
        document.getElementById('lm-close').addEventListener('click', closeLoginModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeLoginModal();
        });
        
        // Submit handler
        document.getElementById('lm-submit').addEventListener('click', handleLogin);
        
        // Enter key
        ['lm-email', 'lm-password'].forEach(function(id) {
            document.getElementById(id).addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleLogin();
            });
        });
    }
    
    function openLoginModal() {
        var modal = document.getElementById('login-modal-overlay');
        if (modal) {
            modal.style.display = 'flex';
            // Reset state
            document.getElementById('lm-form').style.display = 'block';
            document.getElementById('lm-success').style.display = 'none';
            var msg = document.getElementById('lm-message');
            msg.style.display = 'none';
            // Focus email
            setTimeout(function() {
                document.getElementById('lm-email').focus();
            }, 100);
        }
    }
    
    function closeLoginModal() {
        var modal = document.getElementById('login-modal-overlay');
        if (modal) modal.style.display = 'none';
    }
    
    async function handleLogin() {
        var email = document.getElementById('lm-email').value.trim();
        var password = document.getElementById('lm-password').value;
        var msg = document.getElementById('lm-message');
        var btn = document.getElementById('lm-submit');
        
        if (!email || !password) {
            msg.textContent = 'Completează email-ul și parola.';
            msg.style.cssText = 'display:block; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; margin-bottom:1rem; background:#fef2f2; color:#991b1b; border:1px solid #fecaca;';
            return;
        }
        
        btn.disabled = true;
        btn.textContent = 'Se autentifică...';
        msg.style.display = 'none';
        
        try {
            // Use the global Supabase client from supabase-config.js
            var client = sb;
            
            var result = await client.auth.signInWithPassword({ email: email, password: password });
            
            if (result.error) {
                var errorMsg = result.error.message;
                if (errorMsg.includes('Invalid login')) errorMsg = 'Email sau parolă incorectă.';
                msg.textContent = errorMsg;
                msg.style.cssText = 'display:block; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; margin-bottom:1rem; background:#fef2f2; color:#991b1b; border:1px solid #fecaca;';
                btn.disabled = false;
                btn.textContent = 'Autentificare';
            } else {
                // Success
                document.getElementById('lm-form').style.display = 'none';
                document.getElementById('lm-success').style.display = 'block';
                setTimeout(function() {
                    window.location.reload();
                }, 1000);
            }
        } catch (e) {
            msg.textContent = 'Eroare: ' + e.message;
            msg.style.cssText = 'display:block; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; margin-bottom:1rem; background:#fef2f2; color:#991b1b; border:1px solid #fecaca;';
            btn.disabled = false;
            btn.textContent = 'Autentificare';
        }
    }
    
    // Make functions globally available
    window.openLoginModal = openLoginModal;
    window.closeLoginModal = closeLoginModal;
    
    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createLoginModal();
            if (new URLSearchParams(window.location.search).get('login') === '1') openLoginModal();
        });
    } else {
        createLoginModal();
        if (new URLSearchParams(window.location.search).get('login') === '1') openLoginModal();
    }
})();
