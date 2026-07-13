// Newsletter — handler comun pentru formularele de abonare (footer + banda de pe
// homepage). Folosește DELEGARE de evenimente pe document, deci funcționează și
// pentru footer-ul injectat dinamic de footer.js, fără cod dublat.
//
// Trimite spre edge function-ul newsletter-subscribe prin clientul global `sb`
// (același pattern ca nav.js / window.notifyAdmins). Marcaj idempotent ca să nu
// legăm handler-ul de două ori dacă scriptul ajunge să fie inclus de mai multe ori.

(function () {
  if (window.__newsletterBound) return;
  window.__newsletterBound = true;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.addEventListener('submit', async function (e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains('js-newsletter-form')) return;
    e.preventDefault();

    var emailInput = form.querySelector('input[type="email"]');
    var consent = form.querySelector('input[type="checkbox"]');
    var btn = form.querySelector('button[type="submit"]') || form.querySelector('button');
    var msg = form.querySelector('.js-newsletter-msg');
    var source = form.getAttribute('data-source') || 'necunoscut';
    var email = (emailInput && emailInput.value || '').trim();

    // Validare în client.
    if (!email || !EMAIL_RE.test(email)) {
      showMsg(msg, 'Te rog introdu o adresă de email validă.', true);
      return;
    }
    if (consent && !consent.checked) {
      showMsg(msg, 'Bifează acordul ca să te poți abona.', true);
      return;
    }

    if (btn) btn.disabled = true;
    showMsg(msg, '', false);

    try {
      if (typeof sb === 'undefined' || !sb) throw new Error('client Supabase indisponibil');
      var res = await sb.functions.invoke('newsletter-subscribe', {
        body: { email: email, source: source, consent: true }
      });
      if (res && res.error) throw res.error;
      replaceWithSuccess(form);
      // Eveniment Plausible opțional, per formular (ex. blocul de final de episod).
      // Guard: nu crapă dacă Plausible e blocat de un adblocker.
      var goal = form.getAttribute('data-plausible-goal');
      if (goal && window.plausible) {
        try { window.plausible(goal); } catch (e) {}
      }
    } catch (err) {
      if (btn) btn.disabled = false;
      showMsg(msg, 'Ceva n-a mers. Mai încearcă o dată în câteva momente.', true);
    }
  });

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#c2604a' : '#5e8a6c';
    el.style.display = text ? 'block' : 'none';
  }

  function replaceWithSuccess(form) {
    var p = document.createElement('p');
    p.className = 'js-newsletter-success';
    // Text de succes: implicit comun (fără em-dash), sau specific per formular
    // via data-success-msg (ex. blocul de final de episod).
    p.textContent = form.getAttribute('data-success-msg')
      || 'Verifică-ți emailul: ți-am trimis un link de confirmare.';
    p.style.margin = '0';
    p.style.fontSize = '14px';
    p.style.lineHeight = '1.6';
    p.style.color = '#1a1a1a';
    if (form.parentNode) form.parentNode.replaceChild(p, form);
  }
})();
