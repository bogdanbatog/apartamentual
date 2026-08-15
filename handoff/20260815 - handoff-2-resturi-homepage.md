# Handoff 2: cele trei rămășițe de după „Cum începi"

**Repo:** bogdanbatog/apartamentual
**Pornit din:** sesiunea din 15 august 2026, comiturile `7df6e2d` (homepage) + `2ff29e6` (screenshots), ambele împinse, frontendul **publicat** din cPanel și verificat pe live.
**Regulă de bază: niciun commit și niciun push fără aprobarea explicită a lui Lucian.**
**Deployul e MANUAL din cPanel.** Un push pe GitHub nu schimbă nimic pe apartamentual.ro. (Fișele vechi de handoff spun „Render" — e greșit, vezi memoria `deployment-cpanel-not-render`.)

Cele trei lucruri de mai jos au ieșit la iveală în timp ce se lucra la secțiunea „Cum începi". Niciunul nu e urgent, niciunul nu blochează nimic, **fiecare e o sesiune scurtă separată**. Nu le face pe toate într-una singură: prima atinge frontendul, a doua atinge un fișier de conținut, a treia se face din admin, fără cod.

---

## A. Homepage-ul uită că omul are cont

**Ce s-a observat.** Pe 15 august, Lucian și-a făcut cont pe serverul local și am parcurs homepage-ul logat, cadru cu cadru (`screenshots/20260815/homepage-logat-01..14.jpg`). Hero-ul se schimbă corect: apare varianta A, cu numele omului și cu vecinii compatibili. **Restul paginii nu știe nimic.**

Trei locuri, în ordinea gravității:

1. **Caseta webinar (blocul negru) oferă butonul „Creează cont"** unui om logat, la două ecrane sub hero-ul care îi scrie numele. Cel mai vizibil dintre cele trei. `index.html`, butonul cu `plausible-event-loc=bloc-webinar plausible-event-dest=register`.
2. **Blocul final spune „Vii, asculți, întrebi. Fără angajament, fără cont, fără nimic de pregătit."** Argumentul e construit ca să liniștească un străin înainte de înscriere. Pentru cine are deja cont, se citește ca și cum pagina nu l-ar recunoaște.
3. **Newsletterul cere adresa de email pe care platforma o are deja**, plus bifa de consimțământ. Nu e greșit (sunt liste separate, iar consimțământul pentru newsletter chiar e distinct de cont), dar e o frecare inutilă.

**Ce NU e o soluție.** Să ascunzi blocurile astea pentru cei logați. Webinarul e util și celor cu cont — poate mai mult, fiindcă ei sunt cei care ar veni. Se schimbă **butonul și fraza**, nu se scoate secțiunea.

**Ce ar fi de făcut, ca punct de plecare, nu ca decizie luată:**
- butonul „Creează cont" → „Vezi terenurile" sau „Completează-ți profilul", după ce e mai util cuiva proaspăt înscris;
- fraza din blocul final → o variantă care nu presupune că omul n-are cont;
- newsletterul → email precompletat din sesiune, bifa rămâne neatinsă (consimțământul se dă, nu se presupune).

**Mecanismul există deja și nu trebuie inventat.** Scriptul „HERO PE ROLURI" de la finalul lui `index.html` alege deja varianta de hero după sesiune + rol + grup. Orice comutare nouă se agață de acolo, **nu** se adaugă a doua verificare de sesiune în paralel.

⚠️ **Capcană de măsurare.** Dacă schimbi butonul, schimbi și perechea `loc`/`dest` a evenimentului Plausible. Vezi secțiunea „Plausible" de mai jos înainte să atingi vreun buton.

⚠️ **Capcană de probă.** Pagina asta **trebuie probată logat**, pe server local. Regula scrisă în NOTES.md pe 15 august, după cele două defecte care au scăpat la pagina unui teren: *o pagină cu stări de autentificare se probează LOGAT*. Serverul local vorbește cu baza REALĂ — un cont făcut de acolo e cont adevărat.

---

## B. `frontend/js/faq.js`: fără diacritice, plus 5 liniuțe lungi

**Ce s-a observat.** Întrebările din FAQ se afișează pe homepage, adică la primul contact al unui vizitator nou, iar restul paginii are diacriticele corecte. Contrastul sare în ochi: „Cu cat e mai ieftin fata de un apartament de la dezvoltator?", „Cum se personalizeaza apartamentele?", „Exista proiecte Baugruppen realizate deja in Romania?". Se vede în `screenshots/20260815/homepage-logat-13-faq.jpg`.

Sunt 39 de întrebări, tot fișierul e scris așa. Punctul e deschis în NOTES.md din 28 mai, când s-a corectat doar întrebarea cu procentul de economie, ca să rămână diff-ul mic.

**Separat, tot acolo: 5 răspunsuri conțin em-dash** (liniuța lungă), contrar regulii permanente din CLAUDE.md. Se văd doar când deschizi întrebarea, de aceea au scăpat până acum. Liniile: 18, 20, 24, 35, 46.

**Fă-le pe amândouă odată.** E același fișier, aceeași trecere, iar dacă le separi vei citi fișierul de două ori.

✅ **Verificat pe 15 august, nu e nevoie să reverifici: răspunsul despre preț NU promite niciun procent.** Zice explicit „Nu lucram cu un procent fix de economie" și mută argumentul pe lipsa marjei și pe transparență. Regula de conținut din CLAUDE.md e respectată.

⚠️ **Regula pentru liniuțe: se rescrie fraza, nu se înlocuiește semnul.** O virgulă pusă unde era o liniuță dă adesea o frază proastă.

⚠️ **`js/footer.js` mai are unul**, în alt-ul logoului Netopia. Acela e pe **toate** paginile, nu doar pe homepage, deci nu intră în această sesiune decât dacă Lucian decide altfel.

---

## C. Un titlu de articol cu liniuță lungă, în baza de date

**Ce s-a observat.** Scanând pagina **live** după em-dash, a ieșit unul pe care niciun grep prin repo nu-l putea găsi: titlul unui articol din secțiunea News, **„Povestea noastra — Prototipul Judetului Housing"**. Vine din Supabase, nu din cod. E și fără diacritice („noastra", „Judetului").

**De ce contează dincolo de titlul ăsta.** Regula despre liniuța lungă are o poartă la care nu ne uitasem: **articolele scrise din admin**. Codul poate fi curat și textul tot să apară pe site.

**Se repară din admin, nu din cod.**

🔴 **CITEȘTE ASTA ÎNAINTE SĂ DESCHIZI EDITORUL.** Editarea titlului unui articol din admin **poate regenera slug-ul** și rupe linkurile existente (cardul de pe homepage, bio-uri, orice link dat mai devreme). Vezi memoria `admin-slug-editare-articole`. **Nu atinge câmpul slug.** După salvare, verifică pe homepage că articolul se mai deschide.

⚠️ Legat: articolele n-au încă URL propriu, merg pe `/news.html#slug` (memoria `articole-fara-url-propriu`). Nu rezolva asta aici, e altă treabă.

---

## Plausible: convenția, înainte să atingi vreun buton

Tot ce se măsoară pe click pe site trece printr-un **singur eveniment**, `CTA Click`, cu două proprietăți: `loc` (unde stă butonul) și `dest` (unde duce). Se pune prin clase pe `<a>`:

```html
class="cta-secondary plausible-event-name=CTA+Click plausible-event-loc=hero plausible-event-dest=webinar"
```

Valorile de `loc` în folosință azi: `hero`, `bloc-webinar`, `cum-incepi`, `final`. Toate butoanele marcate sunt **doar în `frontend/index.html`**; nicio altă pagină și niciun fișier JS nu emit evenimente.

**Nu inventa nume noi de evenimente.** Un nume nou apare ca rând separat în Plausible, în afara familiei, și comparația „hero versus «Cum începi»" se face manual, din două locuri. Buton nou ⇒ tot `CTA Click`, schimbi doar `loc` și `dest`.

⚠️ **Un eveniment a dispărut pe 15 august**: butonul „Creează cont gratuit" din secțiunea veche „Cum funcționează" avea `loc=pasi dest=register` și s-a dus odată cu secțiunea. Dacă la punctul A se pune un buton de cont, **nu-l boteza `pasi`** — ar amesteca date vechi cu date noi.

---

## Ce s-a făcut deja și NU se reface

- Secțiunea „Cum începi" e **publicată** și verificată pe live: cele două căi, ancora din hero, derularea lină cu respectarea lui `prefers-reduced-motion`, evenimentele Plausible, „5 familii" scos din hero și din caseta webinar, em-dash scos din cele 7 texte și atribute din `index.html`.
- Cele trei linkuri noi întorc 200 pe live: `/terenuri.html`, `/grupuri.html`, `/ce-este/cum-functioneaza.html`.
- Diacriticele au supraviețuit urcării în cPanel.
- Screenshoturile de referință sunt în `screenshots/20260815/`, comise: `homepage-logat-01..14`, `homepage-mobil-01..02`, `homepage-dupa-nelogat-02`. Setul „înainte" (`homepage-nelogat-01..14`) a rămas **netrackuit**, ca restul folderului.

## Ce NU intră în acest handoff

- Pagina-ghid `/ce-este/cum-functioneaza.html` (harta pe 7 etape) — e handoff-ul 3, nescris.
- Ordinea amestecată a cardurilor din News (episoadele apar 3, 2, 0, 1, cu un articol despre Bruxelles între ele). Observat pe 15 august, nediscutat cu Lucian.
- Hero-ul, dincolo de ce s-a schimbat deja.
- Baza de date, migrații, RLS, edge functions, orice zonă de plăți.
