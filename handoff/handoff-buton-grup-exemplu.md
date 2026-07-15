# Handoff: Buton „Pornește un grup ca acesta" pe grupurile-exemplu

> **STARE: IMPLEMENTAT ȘI PUSHAT (2026-07-15).** Commit `8d65f2b` pe `main`, pushat pe GitHub (`bogdanbatog/apartamentual`). Vezi secțiunea „Stadiu final" de la finalul fișierului.

**Context și problemă:** Grupurile demo sunt deja reetichetate ca „Exemplu" (badge + banner de context pe /grupuri.html), dar butonul „Cere alăturarea" rămâne activ pe ele. Consecința reală, întâmplată azi: un utilizator nou real a cerut alăturarea la grupul-exemplu „Design & Eficiență – Centru București", iar cererea a intrat într-o fundătură (grupul nu are oameni reali în spate). Cât timp butonul există pe grupurile-exemplu, scenariul se va repeta cu fiecare utilizator nou.

**Obiectiv:** Pe grupurile marcate ca exemplu (și NUMAI pe ele), butonul „Cere alăturarea" se înlocuiește cu **„Pornește un grup ca acesta"**, care duce utilizatorul în fluxul de creare a unui grup nou, ideal cu zona pre-completată din grupul-exemplu de pe care a venit. Fundătura devine exact acțiunea pe care platforma o dorește de la un utilizator hotărât.

**Text exact al butonului: „Pornește un grup ca acesta"** (formă fixă, cu diacritice). Reguli de limbaj în orice text atins: fără em-dash, fără „fără dezvoltator", fără „mic bloc", diacritice corecte.

---

## FAZA 1: AUDIT (fără modificări)

1. Identifică unde e definit butonul „Cere alăturarea": pe cardurile din listarea /grupuri.html, pe pagina de detaliu a grupului (group-details sau echivalent), și în orice alt loc (ex. profil utilizator, rezultate căutare). Listează toate aparițiile.
2. Identifică cum se recunoaște în frontend un grup-exemplu: câmp în tabelul de grupuri (ex. is_demo / demo boolean), sau altă convenție. Confirmă că badge-ul „Exemplu" existent folosește același criteriu (o singură sursă de adevăr).
3. Identifică fluxul de creare grup: URL-ul paginii/modalului de creare, și dacă acceptă parametri de pre-completare (ex. ?zona=...). Dacă nu acceptă, raportează; pre-completarea devine opțională, nu blocantă.
4. Verifică comportamentul pentru utilizator nelogat: ce se întâmplă azi la click pe „Cere alăturarea" fără cont (redirect la login?); noul buton trebuie să aibă comportament echivalent (login → apoi creare grup).
5. Verifică dacă există cereri de alăturare PENDING pe grupuri-exemplu în baza de date (există cel puțin una, de azi). Raportează câte și de la cine. NU le modifica.

**STOP 1: Raportează aparițiile butonului, criteriul de identificare a grupurilor-exemplu, situația pre-completării și cererile pending. Așteaptă confirmarea lui Lucian.**

---

## FAZA 2: PLAN

Propune modificările exacte:
- În fiecare loc identificat: dacă grupul e exemplu → butonul „Cere alăturarea" se înlocuiește cu „Pornește un grup ca acesta", stil vizual identic sau echivalent (buton primar existent), care navighează la fluxul de creare grup (+ pre-completare zonă dacă e fezabil fără modificări invazive).
- Butonul „Vezi" rămâne neschimbat (pagina de detaliu a grupului-exemplu rămâne vizitabilă, e vitrina).
- Pe pagina de DETALIU a unui grup-exemplu: aceeași înlocuire, plus (dacă există un loc natural, fără re-design) o propoziție scurtă sub buton: „Acesta este un grup exemplu. Grupurile reale se formează chiar acum; poți porni primul din zona ta." (de confirmat formularea la STOP 2)
- Ce se întâmplă cu endpoint-ul de cerere de alăturare pentru grupurile-exemplu: propune și o gardă pe backend (respinge cereri noi către grupuri demo cu mesaj clar), ca protecție împotriva cererilor trimise direct/din pagini vechi din cache. De discutat la STOP 2 dacă intră în acest handoff sau se amână.
- Cererile pending existente pe grupuri-exemplu: NU se șterg automat; se lasă deciziei manuale a lui Lucian din admin (cazul de azi e deja gestionat personal prin email).

**STOP 2: Prezintă diff-ul propus și formularea finală a textelor. Așteaptă aprobarea lui Lucian.**

---

## FAZA 3: IMPLEMENTARE

1. Aplică modificările aprobate.
2. Nu atinge grupurile reale sau fluxul lor de alăturare.
3. Nu modifica datele (grupuri, cereri, utilizatori); e strict o schimbare de UI + eventual garda de backend aprobată la STOP 2.

---

## FAZA 4: TEST

1. Grup-exemplu în listare: butonul nou apare, cu diacritice corecte; click → ajunge în fluxul de creare grup (logat) sau la login (nelogat), cu revenire corectă.
2. Grup REAL în listare (dacă există unul de test): butonul „Cere alăturarea" e neschimbat și funcțional.
3. Pagina de detaliu a unui grup-exemplu: butonul nou + textul aprobat; „Vezi" funcțional.
4. Pre-completarea zonei (dacă s-a implementat): zona grupului-exemplu apare în formularul de creare.
5. Garda de backend (dacă s-a aprobat): cerere directă către un grup demo e respinsă cu mesajul stabilit.
6. Viewport mobil 375px: butonul nou nu rupe layoutul cardurilor (textul e mai lung decât „Cere alăturarea").
7. Verifică vizual că badge-urile „Exemplu" și bannerele existente au rămas neatinse.

**STOP 3: Raportează rezultatele. NU face commit fără aprobarea explicită a lui Lucian (push = deploy live pe Render).**

---

## FAZA 5: COMMIT (doar după aprobare la STOP 3)

1. Commit cu mesaj: `feat(grupuri): buton "Porneste un grup ca acesta" pe grupurile exemplu, in loc de cerere alaturare`
2. După deploy (~2 min), verificare pe apartamentual.ro: butonul live pe un grup-exemplu, fluxul de creare funcțional.

---

## Note pentru Lucian (în afara Claude Code)
- Cererea pending a Alexandrei pe grupul-exemplu: o respingi manual din admin DOAR după ce verificăm ce notificare primește la respingere (bug-ul cunoscut al notificărilor de alăturare e încă deschis); până atunci o lași pending, emailul personal a acoperit comunicarea.
- Textul cardurilor-exemplu conține „bloc mic" în 2-3 locuri (descrierile grupurilor demo); e corecție de date, separată, de făcut direct în admin/DB când ai 5 minute.

---

## Stadiu final (2026-07-15)

**Decizii luate la STOP-uri:**
- Ales varianta **simplă**: butonul duce la `grup-nou.html` gol, **fără** pre-completarea zonei.
- Texte aprobate: butonul „Pornește un grup ca acesta"; propoziția de sub buton (doar pe detaliu): „Acesta este un grup exemplu. Grupurile reale se formează chiar acum; poți porni primul din zona ta."
- Badge „Exemplu" pe pagina de detaliu și garda de backend: **amânate** (separate de acest task).

**Ce s-a implementat (commit `8d65f2b`, push pe `main`):**
1. `frontend/js/grupuri.js` (card listare, ~linia 491): pentru `grup.is_demo`, blocul de acțiuni arată `<a href="grup-nou.html" class="btn-alatura">Pornește un grup ca acesta</a>` în loc de „Cere alăturarea"/„Aprobare în așteptare". „Vezi" neatins. Cardul pentru nelogat („Creează cont pentru detalii") neschimbat.
2. `frontend/grup-details.html` (`renderActions`, ~linia 1680): ramură nouă `else if (group.is_demo)` — butonul nou + propoziția explicativă. Prinde userul logat-nemembru ȘI vizitatorul nelogat. Ramura `if (isMember || isSuperAdmin)` neatinsă (adminii/membrii grupurilor exemplu își păstrează controalele).

Criteriu unic: câmpul `is_demo` din tabelul `grupuri` (aceeași sursă ca badge-ul existent).

**Verificat:** `node --check grupuri.js` OK; inserția din `grup-details.html` bine formată. **Testul vizual end-to-end** (login + grup-exemplu) rămâne de făcut pe site după deploy.

**⚠️ Deploy:** push-ul pe GitHub NU schimbă site-ul live — apartamentual.ro se deployează **manual din cPanel**. Fișierele modificate trebuie urcate acolo.

**De testat după deploy (din FAZA 4):**
- Listare, grup-exemplu (logat): buton nou cu diacritice → duce la creare grup.
- Listare, grup REAL: „Cere alăturarea" neschimbat.
- Detaliu grup-exemplu (nelogat + logat non-membru): buton + propoziție; „Vezi" ok.
- Detaliu grup-exemplu ca admin/membru: controalele de admin rămân.
- Mobil 375px: textul mai lung nu rupe cardul.

**Pași rămași (separate, în afara acestui task):**
1. Badge „Exemplu" pe pagina de detaliu (momentan doar pe listare).
2. Gardă de backend/RLS: respinge cereri de alăturare către grupuri `is_demo` (protecție împotriva cererilor din pagini vechi din cache).
3. Cererea pending a Alexandrei pe grupul-exemplu: respinsă manual din admin DOAR după verificarea notificării la respingere (bug notificări alăturare încă deschis).
4. Corecție date: „bloc mic" în descrierile grupurilor demo.
