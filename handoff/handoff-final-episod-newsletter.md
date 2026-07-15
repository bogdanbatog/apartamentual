# Handoff: Bloc final de episod (newsletter inline + link poveste + goal Plausible)

**Context și problemă:** Plausible arată că /news.html primește ~209 intrări și are ~195 ieșiri în 28 de zile: oamenii citesc episodul (durată medie 2m27s) și pleacă fără să atingă altă pagină. Blocul actual de final de episod are teaser pentru episodul 2 și un LINK text spre abonare newsletter, dar linkul cere o navigare în plus (mulți vizitatori sunt în browserul din aplicația Facebook). Obiectiv: transformăm finalul de episod în punctul principal de conversie.

**Trei livrabile:**
1. Formular de newsletter INLINE la finalul episodului (email + buton), refolosind mecanismul double opt-in existent (LIVE: migration 023, edge function `newsletter-confirm`, contacte Resend)
2. Link spre /povestea-noastra.html sub formular
3. Eveniment Plausible custom la abonarea reușită din episod, ca goal separat

**Reguli de limbaj obligatorii în orice text afișat:** fără em-dash (folosește virgulă sau două puncte), fără sintagma „fără dezvoltator", diacritice corecte, „bloc" nu „mic bloc", „Județului Housing" formă fixă. Stil: culori existente ale site-ului, accent teracotă #BF6B50, fundal deschis #F7F5F0, text #1A1916.

---

## FAZA 1: AUDIT (fără modificări)

1. Identifică unde trăiește conținutul episoadelor: /news.html conține articolele integral sau există pagini separate per episod? Unde e blocul actual de final (teaser „Episodul 2 vine în curând" + link newsletter + butoane share)?
2. Găsește implementarea existentă a abonării la newsletter (banda de pe homepage): fișier HTML, JS-ul care face submit, endpoint-ul apelat (tabel Supabase / edge function), formatul payload-ului, mesajele de succes/eroare afișate, tratarea double opt-in („verifică-ți emailul").
3. Verifică ce variantă de script Plausible e încărcată (plain `script.js` sau cu extensii: outbound-links, form-submissions etc.) și dacă `window.plausible` e disponibil pentru evenimente custom.
4. Verifică dacă /povestea-noastra.html e path-ul corect și funcțional.
5. Verifică dacă butoanele de share existente au vreun tracking.

**STOP 1: Raportează ce ai găsit (structura episoadelor, mecanismul newsletter reutilizabil sau nu, varianta Plausible) și așteaptă confirmarea lui Lucian înainte de plan.**

---

## FAZA 2: PLAN

Propune concret, pe baza auditului:
- Unde se inserează blocul nou (înlocuiește blocul actual de teaser+link)
- Dacă logica de subscribe se extrage într-un modul JS partajat (de ex. `js/newsletter-subscribe.js`) folosit și de homepage și de episod, sau se refolosește altfel, FĂRĂ duplicare de logică
- Structura HTML/CSS a blocului (vezi copy-ul de mai jos)
- Numele evenimentului Plausible: propunere `Newsletter Episod` (cu prop opțional `episode: 1` dacă e simplu de adăugat)

**Copy-ul blocului (de folosit ca atare, Lucian poate ajusta la STOP 2):**

> **Episodul 2 vine în curând: luna în care autorizația s-a blocat și nu mai știam dacă proiectul mai merge înainte.**
>
> Primește-l direct pe email:
> [câmp email, placeholder: „adresa ta de email"] [buton teracotă: „Abonează-mă"]
> Un email pe săptămână, doar când avem ceva de spus. Fără spam.
>
> Mesaj succes: „Aproape gata: verifică-ți emailul și confirmă abonarea."
>
> ---
> Nu ne cunoști încă? **Povestea noastră, de la o pagină de Facebook la un bloc construit împreună →** (link spre /povestea-noastra.html)

Note de design: butonul pe fundal teracotă #BF6B50 cu text deschis, câmpul de email suficient de mare pe mobil (majoritatea vin din aplicația Facebook), blocul vizual delimitat de restul articolului (fundal ușor diferit sau chenar subtil), butoanele de share rămân sub el, neschimbate.

**STOP 2: Prezintă planul + copy-ul final și așteaptă aprobarea lui Lucian.**

---

## FAZA 3: IMPLEMENTARE

1. Construiește blocul conform planului aprobat.
2. Refolosește mecanismul de subscribe existent (același endpoint, același flux double opt-in). Nu crea tabele sau edge functions noi.
3. Validare email pe client înainte de submit; stări vizibile: loading, succes, eroare (mesaje în română, cu diacritice).
4. La răspuns de succes, apelează `window.plausible && window.plausible('Newsletter Episod')` (cu guard, să nu crape dacă Plausible e blocat de un adblocker).
5. Linkul spre povestea-noastra.html sub formular, stil link teracotă existent.
6. Nu atinge alte pagini decât cele identificate la audit ca necesare.

---

## FAZA 4: TEST

1. Local sau pe preview: submit cu email valid nou → verifică apariția în tabelul de aboneri cu status neconfirmat + primirea emailului de confirmare (folosește un alias +test).
2. Submit cu email invalid → mesaj de eroare corect, fără submit.
3. Submit cu email deja abonat → comportamentul existent al mecanismului (raportează care e).
4. Verifică în consolă că evenimentul Plausible se trimite la succes (network request către plausible.io).
5. Verifică pe viewport mobil (375px): formularul nu iese din ecran, butonul e apăsabil, diacriticele se afișează corect.
6. Verifică că blocul respectă regulile de limbaj (fără em-dash, fără „fără dezvoltator").

**STOP 3: Raportează rezultatele testelor cu capturi/descrieri. NU face commit fără aprobarea explicită a lui Lucian (push = deploy live automat pe Render).**

---

## FAZA 5: COMMIT (doar după aprobare la STOP 3)

1. Commit cu mesaj: `feat(news): bloc final episod cu newsletter inline, link poveste si event Plausible`
2. După deploy (~2 min pe Render), test rapid pe apartamentual.ro cu un email +test real.
3. Reamintește-i lui Lucian pasul MANUAL rămas: în dashboard-ul Plausible → Site settings → Goals → adaugă goal de tip Custom Event cu numele exact `Newsletter Episod`.

---

## Pași manuali pentru Lucian (în afara Claude Code)
- Creare goal `Newsletter Episod` în Plausible (după deploy)
- Opțional: verificare IP shield Plausible pentru toate locațiile proprii (birou + mobil), pentru curățenia datelor
- La publicarea episodului 2: teaser-ul din bloc se actualizează, iar deasupra lui se adaugă navigarea de serial („← Episodul 1")
