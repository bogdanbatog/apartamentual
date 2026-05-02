// comanda-analiza.js
// Logica pentru pagina /comanda-analiza.html
// - Toggle PF/PJ
// - Pre-completare date din URL (?teren_id=xxx) sau din profil dacă userul e logat
// - Validare formular
// - Apel Edge Function `creeaza-proforma-oblio`
// - Afișare view de success cu URL plată

(function () {
    'use strict';

    // =====================================================
    // STATE
    // =====================================================
    const containerEl = document.querySelector('.ord-container');
    const formEl = document.getElementById('ord-form');
    const errorBox = document.getElementById('ord-error');
    const submitBtn = document.getElementById('ord-submit');
    const submitText = document.getElementById('ord-submit-text');
    const formView = document.getElementById('ord-form-view');
    const successView = document.getElementById('ord-success-view');

    // =====================================================
    // INIT
    // =====================================================
    document.addEventListener('DOMContentLoaded', async () => {
        setupToggle();
        setupSubmit();
        applyInitialBodyClass();
        await prefillFromContext();
    });

    // =====================================================
    // TOGGLE PF / PJ
    // =====================================================
    function setupToggle() {
        const pfRadio = document.getElementById('tip-pf');
        const pjRadio = document.getElementById('tip-pj');
        [pfRadio, pjRadio].forEach((el) => {
            el.addEventListener('change', applyToggleClass);
        });
    }

    function applyInitialBodyClass() {
        applyToggleClass();
    }

    function applyToggleClass() {
        const pfChecked = document.getElementById('tip-pf').checked;
        document.body.classList.toggle('show-pf', pfChecked);
        document.body.classList.toggle('show-pj', !pfChecked);
    }

    // =====================================================
    // PRE-FILL (din URL ?teren_id sau din profil utilizator)
    // =====================================================
    async function prefillFromContext() {
        const params = new URLSearchParams(window.location.search);

        // 1. Pre-completare descriere teren din URL params
        const terenTitlu = params.get('teren_titlu');
        const terenId = params.get('teren_id');
        if (terenTitlu || terenId) {
            const linkTerenInput = document.getElementById('link_teren');
            const descriereInput = document.getElementById('descriere_teren');
            if (terenId && linkTerenInput && !linkTerenInput.value) {
                linkTerenInput.value = window.location.origin + '/teren-details.html?id=' + terenId;
            }
            if (terenTitlu && descriereInput && !descriereInput.value) {
                descriereInput.value = 'Teren: ' + terenTitlu + '\n\n[completează cu numărul cadastral sau adresa exactă]';
            }
        }

        // 2. Pre-completare din profilul userului (dacă e logat)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, email, phone')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!profile) return;

            const setIfEmpty = (id, val) => {
                const el = document.getElementById(id);
                if (el && !el.value && val) el.value = val;
            };

            setIfEmpty('email', profile.email || user.email);
            setIfEmpty('telefon', profile.phone);
            setIfEmpty('prenume', profile.first_name);
            setIfEmpty('nume', profile.last_name);
        } catch (err) {
            // Non-fatal — dacă nu se poate fetch, formularul rămâne gol
            console.log('Prefill from profile skipped:', err);
        }
    }

    // =====================================================
    // SUBMIT
    // =====================================================
    function setupSubmit() {
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleSubmit();
        });
    }

    async function handleSubmit() {
        clearError();

        // Build payload
        const payload = buildPayload();

        // Client-side validation
        const err = validateClient(payload);
        if (err) {
            showError(err);
            return;
        }

        // Disable button + show loading
        setSubmitting(true);

        try {
            // Pass auth token if user is logged in (so backend can link comanda to user_id)
            const session = (await supabase.auth.getSession()).data.session;
            const headers = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = 'Bearer ' + session.access_token;
            }

            const { data, error } = await supabase.functions.invoke('creeaza-proforma-oblio', {
                body: payload,
                headers: headers,
            });

            if (error) {
                throw new Error(error.message || 'Eroare la trimiterea comenzii');
            }

            if (!data || !data.success) {
                throw new Error((data && data.error) || 'Răspuns invalid de la server');
            }

            // Success!
            showSuccess(data, payload.email);

        } catch (err) {
            console.error('Submit error:', err);
            showError(err.message || 'Eroare neașteptată. Te rugăm să încerci din nou.');
            setSubmitting(false);
        }
    }

    function buildPayload() {
        const fd = new FormData(formEl);

        return {
            tip_persoana: fd.get('tip_persoana') || 'PF',
            email: (fd.get('email') || '').trim(),
            telefon: (fd.get('telefon') || '').trim(),

            // PF
            nume: (fd.get('nume') || '').trim(),
            prenume: (fd.get('prenume') || '').trim(),
            cnp: (fd.get('cnp') || '').trim(),

            // PJ
            denumire_firma: (fd.get('denumire_firma') || '').trim(),
            cui: (fd.get('cui') || '').trim(),
            reg_com: (fd.get('reg_com') || '').trim(),

            // Adresa
            adresa: (fd.get('adresa') || '').trim(),
            oras: (fd.get('oras') || '').trim(),
            judet: (fd.get('judet') || '').trim(),
            cod_postal: (fd.get('cod_postal') || '').trim(),

            // Teren
            descriere_teren: (fd.get('descriere_teren') || '').trim(),
            link_teren: (fd.get('link_teren') || '').trim(),

            // Termeni
            accept_termeni: document.getElementById('accept_termeni').checked,
            accept_gdpr: document.getElementById('accept_gdpr').checked,
            accept_retur: document.getElementById('accept_retur').checked,
        };
    }

    function validateClient(p) {
        if (p.tip_persoana === 'PF') {
            if (!p.prenume) return 'Te rugăm să completezi prenumele.';
            if (!p.nume) return 'Te rugăm să completezi numele.';
            if (p.cnp && !/^\d{13}$/.test(p.cnp)) {
                return 'CNP-ul trebuie să aibă exact 13 cifre (sau lasă-l gol).';
            }
        } else {
            if (!p.denumire_firma) return 'Te rugăm să completezi denumirea firmei.';
            if (!p.cui) return 'Te rugăm să completezi CUI-ul firmei.';
            if (!p.reg_com) return 'Te rugăm să completezi numărul Reg. Comerțului.';
        }

        if (!p.email) return 'Te rugăm să completezi adresa de email.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
            return 'Adresa de email pare invalidă. Verifică-o.';
        }

        if (!p.adresa) return 'Te rugăm să completezi adresa.';
        if (!p.oras) return 'Te rugăm să completezi orașul.';
        if (!p.judet) return 'Te rugăm să completezi județul.';

        if (!p.descriere_teren || p.descriere_teren.length < 10) {
            return 'Te rugăm să descrii terenul (minim 10 caractere — număr cadastral, adresă, etc.).';
        }

        if (!p.accept_termeni) return 'Trebuie să accepți termenii de utilizare a analizelor.';
        if (!p.accept_gdpr) return 'Trebuie să confirmi că ai citit politica GDPR.';
        if (!p.accept_retur) return 'Trebuie să confirmi politica de retur.';

        return null;
    }

    // =====================================================
    // UI HELPERS
    // =====================================================
    function setSubmitting(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            submitText.innerHTML = '<span class="spin"></span> Se procesează...';
        } else {
            submitText.textContent = 'Continuă la plată — 99 RON';
        }
    }

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.add('show');
        // Scroll to error
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function clearError() {
        errorBox.classList.remove('show');
        errorBox.textContent = '';
    }

    function showSuccess(data, email) {
        document.getElementById('ord-success-email').textContent = email;
        document.getElementById('ord-success-orderid').textContent = data.order_id || '';
        const payBtn = document.getElementById('ord-success-pay');
        if (data.payment_url) {
            payBtn.href = data.payment_url;
        } else {
            payBtn.style.display = 'none';
        }
        formView.style.display = 'none';
        successView.style.display = 'block';
        // Scroll up
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

})();
