/* ══════════════════════════════════════════════════════════════════════
   PAȘII UNUI PROIECT: sursa unică
   ══════════════════════════════════════════════════════════════════════

   Cele 11 casete ale cronologiei, folosite în două locuri:
     · pagina grupului (grup-details.html), unde se și bifează
     · Spațiul tău din homepage (index.html), unde se citesc, fără bife

   TEXTUL NU E SCRIS AICI. Fișierul ăsta ține doar titlurile, cheile și
   ancorele. Explicația fiecărei casete stă în ghidul public,
   `ce-este/cum-functioneaza.html`, iar paginile o citesc de acolo la
   rulare, cu `incarcaPasiDinGhid()`.

   De ce așa: ghidul e o pagină publică, pe care vrem să o găsească lumea
   în Google, deci trebuie să rămână HTML static. Dacă am muta textul aici,
   ghidul s-ar genera din JavaScript și ar dispărea din indexare. Iar dacă
   l-am copia, s-ar desincroniza în două luni, cum s-a întâmplat deja o dată
   cu patru liste diferite de pași.

   ⚠️ `key` se scrie în `grup_checklist.step_key`, la fel pentru note și
   atașamente. Nu se redenumesc fără migrare.

   ⚠️ `ghid` e id-ul secțiunii din ghid. Dacă acolo se redenumește un id,
   caseta rămâne fără text și arată în loc un link către ghid.
   ══════════════════════════════════════════════════════════════════════ */

var PASI_CASETE = [
  { key: 'c1',  ghid: 'comunicarea',           culoare: '#5a7196',
    titlu: 'Comunicarea cu cei din grup',
    sub: 'Pe ce canal se discută ce, și prima discuție serioasă despre ce vreți' },

  { key: 'c2',  ghid: 'organizarea',           culoare: '#2f8f5b',
    // Titlul s-a schimbat pe 22 august (cererea lui Lucian): pasul începe cu
    // analiza preliminară a terenului, nu cu împărțirea. Ancora din ghid
    // (`organizarea`) a rămas aceeași, deci nu se rupe niciun link.
    titlu: 'Analiza preliminară și organizarea pe apartamente',
    sub: 'Ce încape pe teren, apoi cine ia ce apartament și cu ce cotă indiviză' },

  { key: 'c3',  ghid: 'verificarea-terenului', culoare: '#2f8f5b',
    titlu: 'Verificarea terenului',
    sub: 'Vizita, cartea funciară, notarul, certificatul de urbanism, forajele, vecinii' },

  { key: 'c4',  ghid: 'analiza-detaliata',     culoare: '#2f8f5b',
    titlu: 'Analiza detaliată',
    sub: 'Planuri, suprafețe finale, randări și cote indivize' },

  { key: 'c5',  ghid: 'contract-asociere',     culoare: '#2f8f5b',
    titlu: 'Contractul de asociere',
    sub: 'Întocmit de avocat și legalizat la notar, sau un SRL' },

  { key: 'c6',  ghid: 'cumpararea-terenului',  culoare: '#2f8f5b',
    titlu: 'Cumpărați terenul',
    sub: 'Antecontract, apoi actul la notar' },

  { key: 'c7',  ghid: 'proiectarea',           culoare: '#c2604a',
    titlu: 'Începeți proiectarea',
    sub: 'Concept, certificat de urbanism, avize, proiect tehnic, autorizație, detalii' },

  { key: 'c8',  ghid: 'santierul',             culoare: '#8f5a48',
    titlu: 'Șantierul',
    sub: 'Ofertele, constructorul, dirigintele de șantier, execuția' },

  // Fără bifă: nu e un pas prin care treci, e ce faceți dacă se întâmplă.
  { key: 'c9',  ghid: 'iesirea',               culoare: '#8a8a8a', faraBifa: true,
    titlu: 'Dacă cineva vrea să iasă din asociere',
    sub: 'Nu e un pas, e ce faceți dacă se întâmplă' },

  { key: 'c10', ghid: 'receptia',              culoare: '#8f5a48',
    titlu: 'Recepția și apartamentarea',
    sub: 'Recepția nu vă face proprietari pe apartamente, apartamentarea da' },

  { key: 'c11', ghid: 'mutarea',               culoare: '#8f5a48',
    titlu: 'Mutarea',
    sub: 'Utilitățile, administrarea părților comune, garanțiile' }
];

// Doar casetele care se bifează. A noua nu intră în numărătoare.
var PASI_CU_BIFA = PASI_CASETE.filter(function(c){ return !c.faraBifa; });


/* ══════════════════════════════════════════════════════════════════════
   PAȘII CARE SE FAC PE FIECARE TEREN ÎN PARTE
   ══════════════════════════════════════════════════════════════════════

   Astea NU sunt pașii grupului, sunt pașii unui TEREN candidat. Un grup se
   uită la trei terenuri și le face pe toate trei, separat. De aceea se
   bifează pe teren, nu pe grup: „am extrasul de carte funciară" e adevărat
   despre un teren anume, nu despre grup în general.

   Ordinea e cea din ghid, iar ghidul o alege după cât costă: întâi ce e
   gratis, la urmă ce se plătește. Primul pas e analiza preliminară, fiindcă
   fără ea nu știi dacă terenul merită restul drumului.

   ⚠️ `key` ajunge în `grup_teren_checklist.step_key` și, împreună cu id-ul
   terenului, în `step_key` din `grup_checklist_notes` și `grup_checklist_files`
   (vezi `cheiaPasTeren()` din grup-details.html). Nu se redenumesc fără
   migrare.

   ⚠️ `ghid` e ancora secțiunii din care e luat pasul, ca omul să poată citi
   despre el pe larg.

   ⚠️ ÎN PAGINĂ lista asta NU se mai numește „pași" (23 august). Se cheamă
   „Verificările terenului", fiindcă în aceeași pagină mai există un lucru numit
   pas: casetele de citit din `CHECKLIST_BOXES`, care poartă pastila „Pasul 3".
   Un om care aude „pasul 3" trebuie să știe la care se referă. Numele din cod
   (`PASI_TEREN`, `tv-pas`, `cheiaPasTeren`) rămâne cum e: cheile ajung în bază
   și nu se redenumesc fără migrare.
   ⚠️ Numele seamănă cu titlul pasului 3, „Verificarea terenului", care stă chiar
   deasupra în pagină. E asumat (decizia lui Lucian, 23 august): prima variantă,
   „De verificat pe teren", suna a listă de dus cu tine la fața locului, deși
   înăuntru sunt cartea funciară, notarul și certificatul de urbanism.
   ══════════════════════════════════════════════════════════════════════ */
var PASI_TEREN = [
  { key: 'analiza-prelim',      ghid: 'organizarea',           cereAnaliza: true,
    titlu: 'Analiza preliminară',
    sub: 'Câte apartamente încap și cu ce costuri, înainte de orice cheltuială' },

  { key: 'vizita',              ghid: 'verificarea-terenului',
    titlu: 'Vizita la teren și întâlnirea cu proprietarul',
    sub: 'Mergeți pe teren, vedeți vecinii, discutați prețul. Notați ce ați aflat' },

  { key: 'carte-funciara',      ghid: 'verificarea-terenului',
    titlu: 'Extrasul de carte funciară',
    sub: 'Situația juridică de azi, luată online sau cerută proprietarului' },

  { key: 'notar',               ghid: 'verificarea-terenului',
    titlu: 'Istoricul terenului, verificat la notar',
    sub: 'Pasul sărit cel mai des. Extrasul spune cum e acum, nu cum s-a ajuns aici' },

  { key: 'certificat-urbanism', ghid: 'verificarea-terenului',
    titlu: 'Certificatul de urbanism pentru construire',
    sub: 'Îl depune proprietarul, cu propunerea voastră de bloc' },

  { key: 'geotehnic',           ghid: 'verificarea-terenului',
    titlu: 'Studiul geotehnic sumar',
    sub: 'Unul sau două foraje, ca să știți pe ce construiți' },

  { key: 'vecini-calcan',       ghid: 'verificarea-terenului',
    titlu: 'Acordul vecinilor de la calcan',
    sub: 'Dacă blocul se lipește de o construcție existentă' }
];

// Textul secțiunilor, citit o singură dată. ancoră -> HTML
var _pasiGhidCache = null;
var _pasiGhidPromisiune = null;

/**
 * Citește ghidul public și scoate din el textul celor 11 casete.
 * Se apelează de câte ori vrei, citirea se face o singură dată.
 *
 * optiuni.cale         calea către ghid, față de pagina curentă
 * optiuni.prefixAncora prefixul id-urilor casetelor din pagina care cheamă,
 *                      ca ancorele interne din ghid (ex. „#iesirea") să
 *                      trimită la caseta corespunzătoare, nu în gol
 *
 * Întoarce mereu un obiect. Dacă citirea eșuează, e gol, iar pagina care
 * cheamă trebuie să aibă un text de rezervă pentru casetele fără conținut.
 */
function incarcaPasiDinGhid(optiuni){
    if (_pasiGhidCache) return Promise.resolve(_pasiGhidCache);
    if (_pasiGhidPromisiune) return _pasiGhidPromisiune;

    var o = optiuni || {};
    var cale = o.cale || 'ce-este/cum-functioneaza.html';
    var prefix = o.prefixAncora || 'pas-';
    var folder = cale.replace(/[^/]*$/, '');   // „ce-este/"

    _pasiGhidPromisiune = fetch(cale).then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
    }).then(function(text){
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var rezultat = {};

        PASI_CASETE.forEach(function(caseta){
            var sectiune = doc.getElementById(caseta.ghid);
            if (!sectiune) return;
            var copie = sectiune.cloneNode(true);

            // Capul de secțiune (numărul mare și titlul) îl pune pagina care
            // cheamă, în antetul casetei ei.
            var cap = copie.querySelector('.pas-cap');
            if (cap) cap.remove();

            // Linkurile din ghid sunt scrise față de folderul lui. Paginile
            // care cheamă stau în altă parte, deci se rescriu.
            copie.querySelectorAll('a[href]').forEach(function(a){
                var href = a.getAttribute('href') || '';
                if (href.charAt(0) === '#') {
                    var tinta = PASI_CASETE.filter(function(c){ return c.ghid === href.slice(1); })[0];
                    a.setAttribute('href', tinta ? '#' + prefix + tinta.key : cale + href);
                    return;
                }
                if (/^(https?:|mailto:|tel:|\/)/.test(href)) {
                    a.setAttribute('target', '_blank');
                    return;
                }
                a.setAttribute('href', folder + href);
                a.setAttribute('target', '_blank');
            });

            rezultat[caseta.ghid] = copie.innerHTML;
        });

        _pasiGhidCache = rezultat;
        return rezultat;
    }).catch(function(err){
        console.error('Nu am putut citi pașii din ghid:', err);
        _pasiGhidCache = {};
        return _pasiGhidCache;
    });

    return _pasiGhidPromisiune;
}

/** Ce se pune într-o casetă când textul n-a putut fi citit din ghid. */
function textLipsaDinGhid(caseta, cale){
    var c = cale || 'ce-este/cum-functioneaza.html';
    return '<p>Textul acestui pas se citește din ghid, iar acum nu a putut fi încărcat. ' +
           '<a href="' + c + '#' + caseta.ghid + '" target="_blank">Deschide-l în ghid</a>.</p>';
}
