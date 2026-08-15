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
        setupLiveValidation();
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
            if (terenId && linkTerenInput) {
                if (!linkTerenInput.value) {
                    linkTerenInput.value = window.location.origin + '/teren-details.html?id=' + terenId;
                }
                // Teren de pe platformă: blocăm câmpul ca linkul să nu poată fi
                // șters/modificat accidental înainte de trimiterea comenzii.
                // (readonly => valoarea rămâne și se trimite normal cu formularul)
                linkTerenInput.readOnly = true;
                linkTerenInput.style.background = '#f4f4f4';
                linkTerenInput.style.cursor = 'not-allowed';
                const lbl = document.querySelector('label[for="link_teren"]');
                if (lbl) lbl.textContent = 'Teren de pe platformă (completat automat)';
                const field = linkTerenInput.parentElement;
                if (field && !field.querySelector('.ord-field-hint')) {
                    const hint = document.createElement('div');
                    hint.className = 'ord-field-hint';
                    hint.textContent = '🔒 Terenul este preluat de pe platformă. Linkul e completat automat și nu poate fi modificat.';
                    field.appendChild(hint);
                }
            }
            // Nu mai pre-completăm descriere_teren — utilizatorul descrie viziunea proprie
            // (terenul e identificat prin nr_cadastral, separat)
        }

        // 2. Pre-completare din profilul userului (dacă e logat)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Rândul propriu prin `profiles_visible` — view-ul întoarce datele
            // personale complet pentru propriul profil. Doar sursa se schimbă;
            // pre-completarea și restul formularului rămân neatinse.
            const { data: profile } = await supabase
                .from('profiles_visible')
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

    // =====================================================
    // LIVE VALIDATION — disable submit până când câmpurile critice
    // sunt completate. Feedback vizual instant pentru utilizator.
    // =====================================================
    function setupLiveValidation() {
        const nrCadastralInput = document.getElementById('nr_cadastral');
        const adresaTerenInput = document.getElementById('adresa_teren');
        const acceptCadastral = document.getElementById('accept_cadastral');
        const acceptTermeni = document.getElementById('accept_termeni');
        const acceptGdpr = document.getElementById('accept_gdpr');
        const acceptRetur = document.getElementById('accept_retur');
        const submitBtn = document.getElementById('ord-submit');

        if (!submitBtn) return;

        function updateSubmitState() {
            const cadastralOk = nrCadastralInput && nrCadastralInput.value.trim().length >= 3;
            const adresaTerenOk = adresaTerenInput && adresaTerenInput.value.trim().length >= 5;
            const terenIdentificat = cadastralOk || adresaTerenOk;
            const allChecked = acceptCadastral?.checked
                && acceptTermeni?.checked
                && acceptGdpr?.checked
                && acceptRetur?.checked;

            const canSubmit = terenIdentificat && allChecked;
            submitBtn.disabled = !canSubmit;
        }

        // Inițial: dezactivat
        updateSubmitState();

        // Event listeners pe câmpurile critice
        [nrCadastralInput, adresaTerenInput, acceptCadastral, acceptTermeni, acceptGdpr, acceptRetur].forEach(el => {
            if (!el) return;
            el.addEventListener('input', updateSubmitState);
            el.addEventListener('change', updateSubmitState);
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
            // NOTE: NU seta manual 'Content-Type' — invoke() face automat JSON.stringify
            // și setează headerul corect. Dacă-l setezi manual, body-ul ajunge corupt.
            const session = (await supabase.auth.getSession()).data.session;
            const headers = {};
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
            nr_cadastral: (fd.get('nr_cadastral') || '').trim(),
            adresa_teren: (fd.get('adresa_teren') || '').trim(),
            descriere_teren: (fd.get('descriere_teren') || '').trim(),
            link_teren: (fd.get('link_teren') || '').trim(),

            // Termeni
            accept_cadastral: document.getElementById('accept_cadastral').checked,
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

        const hasCadastral = p.nr_cadastral && p.nr_cadastral.length >= 3;
        const hasAdresaTeren = p.adresa_teren && p.adresa_teren.length >= 5;
        if (!hasCadastral && !hasAdresaTeren) {
            return 'Te rugăm să completezi fie numărul cadastral (minim 3 caractere), fie adresa exactă a terenului.';
        }

        if (!p.descriere_teren || p.descriere_teren.length < 10) {
            return 'Te rugăm să ne spui pe scurt ce ai vrea să construiești pe teren (minim 10 caractere).';
        }

        if (!p.accept_cadastral) return 'Trebuie să confirmi că deții numărul cadastral al terenului.';
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
            // ⚠️ Trebuie să fie EXACT textul din `comanda-analiza.html`
            // (#ord-submit-text). Rândul ăsta pune eticheta la loc după starea
            // „Se procesează…", deci dacă cele două se despart, butonul își
            // schimbă textul singur după o încercare de plată eșuată.
            // `.ord-nowrap` ține „99 RON cu TVA inclus" într-o bucată: pe telefon
            // eticheta nu încape pe un rând, iar fără el se rupea între „99" și
            // „RON". Se scrie cu innerHTML, ca rândul de deasupra, fiindcă e
            // markup, nu doar text. Conținutul e scris aici în cod, nu vine de
            // nicăieri din afară.
            submitText.innerHTML = 'Continuă la plată, <span class="ord-nowrap">99 RON cu TVA inclus</span>';
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
