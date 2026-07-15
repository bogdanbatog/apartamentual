# HANDOFF, reîncadrare exemple (DEMO) + card de recrutare

> Plasează în `/_handoff/` și invocă-l în Claude Code.
> Structură în 5 faze. Oprește-te (STOP) la fiecare punct marcat. NU face deploy
> fără aprobare explicită de la Lucian.
> În orice text vizibil introdus, NU folosi em-dash (—) sau en-dash (–). Doar
> virgulă, două puncte sau paranteze.

---

## Context și scop

Repo `bogdanbatog/apartamentual`, frontend vanilla HTML/JS/CSS, Supabase pentru date.

Paginile **Utilizatori** (`utilizatori.html`) și **Grupuri** (`grupuri.html`) afișează
acum profiluri și grupuri marcate „DEMO”. Platforma e la început, deci e normal să nu
existe încă useri reali; exemplele sunt acolo ca secțiunile să nu pară goale. Problema
e percepția: badge-ul „DEMO” lângă nume și poze îl face pe un vizitator sceptic să
citească „fals”, nu „exemplu ilustrativ”.

Scop: păstrăm exemplele, dar le reîncadrăm ONEST, ca să dezarmeze scepticul în loc
să-l alunge, și adăugăm un apel la acțiune (card de recrutare) fix unde altfel ar pleca.

NU e în scop acum: afișarea Județului Housing ca prim grup real (decizie amânată).

---

## FAZA 1, AUDIT (fără modificări)

Raportează:
1. **Cum e implementat „DEMO”**: e un câmp în baza de date (ex. `is_demo` pe
   profiluri/grupuri) randat ca badge, sau cuvântul „DEMO” vine din datele propriu-zise
   (ex. în numele afișat)? Arată unde și cum se randează badge-ul în
   `utilizatori.html` și `grupuri.html`.
2. **Structura paginilor**: unde începe lista de carduri (ca să știm unde inserăm banda
   de sus și cardul de recrutare). Arată markup-ul unui card de user și al unui card
   de grup.
3. **Numele exemplelor**: listează numele profilurilor și grupurilor afișate acum.
   Semnalează dacă vreunul ar putea fi confundat cu o persoană reală identificabilă
   (vrem nume clar ilustrative, gen „Familia M.”, „Grup de medici”, „Tânăr cuplu,
   Băneasa”). Numele trăiesc în date (Supabase), deci eventuala redenumire o face
   Lucian separat; tu doar raportează.

> **STOP 1.** Prezintă constatările. Așteaptă OK.

---

## FAZA 2, PLAN

Listează exact fișierele de modificat și unde inserezi: (a) redenumirea badge-ului,
(b) banda onestă de sus, (c) cardul „Locul tău aici”. Confirmă dacă badge-ul se poate
schimba din template (preferat) sau dacă „DEMO” vine din date (caz în care raportezi
și îl lasă pe Lucian să-l schimbe în date).

> **STOP 2.** Așteaptă aprobarea planului.

---

## FAZA 3, IMPLEMENTARE

### 3.1 Redenumire badge

Schimbă eticheta vizibilă a badge-ului din `DEMO` în `Exemplu`, pe ambele pagini.
Dacă e posibil, păstrează un stil mai blând/neutru (nu roșu de alertă), ca să citească
„ilustrativ”, nu „atenție”. Dacă „DEMO” vine din date și nu din template, nu modifica
datele; raportează și oprește-te pe acest punct.

### 3.2 Bandă onestă de sus

Adaugă, sus pe fiecare pagină (sub titlu, înainte de filtre sau de lista de carduri),
o bandă scurtă, în ton calm.

Pe `utilizatori.html`:
> Platforma e la început. Profilurile de mai jos sunt exemple, ca să vezi cum vor
> arăta anunțurile reale. Fii printre primii care își creează un profil adevărat.

Pe `grupuri.html`:
> Platforma e la început. Grupurile de mai jos sunt exemple, ca să vezi cum vor arăta
> grupurile reale. Creează primul grup adevărat din zona ta.

### 3.3 Card de recrutare „Locul tău aici”

Adaugă în grila de carduri un card vizual distinct (alt fundal/contur, fără poză de
persoană), ideal ca primul card sau imediat după primele exemple.

Pe `utilizatori.html`:
> **Locul tău aici**
> Creează-ți profilul și lasă vecinii potriviți să te găsească.
> [buton: Creează cont]

Pe `grupuri.html`:
> **Fii primul grup real**
> Creează un grup și invită-ți prietenii, sau lasă oameni cu aceeași viziune să ți
> se alăture.
> [buton: Creează un grup]

Butoanele duc spre fluxul existent de creare cont / creare grup (folosește aceleași
linkuri ca CTA-urile existente de pe pagini).

> **STOP 3.** Arată diff-urile complete. NU face commit/push. Așteaptă review-ul.

---

## FAZA 4, TEST

1. Pe ambele pagini, badge-ul afișează „Exemplu”, nu „DEMO”.
2. Banda de sus apare corect și se citește calm, nu alarmant.
3. Cardul „Locul tău aici” apare în grilă, e vizual distinct, iar butonul duce spre
   creare cont / creare grup.
4. Aspect corect pe desktop și pe mobil (cardul de recrutare nu strică grila).

---

## FAZA 5, COMMIT & DEPLOY

- Commit: `content: reîncadrare exemple (Exemplu in loc de DEMO) + card de recrutare pe utilizatori si grupuri`
- Push-ul declanșează deploy automat pe Render.

> **STOP 5.** Commit/push DOAR după „dă commit” explicit de la Lucian.

---

## Pas separat pentru Lucian (date, nu cod)

Dacă la Faza 1 reiese că unele nume de exemplu seamănă cu persoane reale, schimbă-le
în date (admin panel sau SQL Editor) în nume clar ilustrative: „Familia M.”,
„Grup de medici”, „Tânăr cuplu, Băneasa” etc. Nu e treaba lui Claude Code, ca să nu
atingă datele din producție.
