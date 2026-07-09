# Handoff: Bug notificare „cerere de alăturare" tratată ca „invitație acceptată"

## STATUS: REZOLVAT SI LIVE IN PRODUCTIE (10 iulie 2026)

Commit `9291ba4` pe `main`. Edge function `notify-admins` deployat pe Supabase (live imediat). Frontend deployat manual din cPanel de Lucian si VERIFICAT live: fisierul de pe apartamentual.ro/grup-details.html contine fix-ul (codul nou prezent, apelul gresit disparut, `join_request_admin_email` ramane doar in fluxul de invitatie). Fix-ul e complet in productie.

### Cauza reală (diferită de ipoteza inițială)

Ipoteza din faza de audit (cerere spontană construită peste tabelul de invitații, cu `invited_by null`) era GRESITA. Cererea spontană inserează doar în `grup_membri` cu `status='pending'`; nu atinge deloc `grup_invitations`. Bug-ul era mai simplu: funcția `requestJoinGroup` (`frontend/grup-details.html`) apela DOUA evenimente:
- `join_request` (text corect: „X a cerut să se alăture")
- `join_request_admin_email` (text de invitație acceptată: „X a acceptat o invitație... membru obișnuit") — GRESIT pentru o cerere spontană.

`join_request_admin_email` NU e inutil: e apelat corect și din fluxul de invitație reală acceptată de la un membru obișnuit (`grup-details.html:3373`), unde textul chiar se aplică. Deci a fost păstrat intact.

### Fix aplicat (varianta 1 aleasă de Lucian: admin în To, superadmin în CC)

1. `frontend/grup-details.html`, `requestJoinGroup`: șters apelul `join_request_admin_email`; adminul grupului mutat pe `join_request` (`admin_email` + `user_name` din pseudonim). Un singur email în loc de două.
2. `supabase/functions/notify-admins/index.ts`: `'join_request'` mutat din `SUPERADMIN_CC_IF_NO_RECIPIENT` în `SUPERADMIN_CC_ALWAYS`, ca superadminul să rămână pe CC deși acum există recipient explicit.

Confirmat în audit: fluxul „membru invită → admin aprobă" CC-uia deja superadminul la fiecare pas (`invitation_sent`, `join_request_admin_email`, `member_approved`, `member_joined`), deci nu a trebuit atins.

### Pași rămași
- [x] Deploy manual frontend din cPanel — făcut și verificat live (10 iulie 2026).
- [ ] (Opțional) Test funcțional real cu conturi de test: cerere spontană pe grup exemplu → adminul primește UN email „X a cerut să se alăture" (fără mențiune de invitație), superadmin pe CC, un singur `join_request` în Slack `#app_events`. Poate fi făcut doar de Lucian cu conturile reale.

---

## Context (istoric, la momentul raportării)

Pe 9 iulie 2026, utilizatorul real atortolea@yahoo.com (user_id: 50212bd6-b592-477e-975a-cb4dd13265d3) s-a înregistrat și a cerut alăturarea în două grupuri exemplu:

- 17:52 — „Investiție Inteligentă – Bloc Boutique Central" (admin: luta.lucian.m+test12@gmail.com)
- 17:54 — „Bloc Eco pentru Medici și Profesioniști" (admin: luta.lucian.m+test18@gmail.com)

Pentru FIECARE cerere au plecat DOUĂ notificări email cu texte contradictorii:

1. Către superadmin (apartamentual@ltfbstudio.ro): „X a cerut să se alăture grupului Y" — CORECT
2. Către adminul grupului (adresa de test, CC apartamentual@): „X a acceptat o invitație și așteaptă aprobarea ta pentru a intra în grupul Y. Pentru că invitația a fost trimisă de un membru obișnuit (nu direct de tine), cererea trebuie aprobată de tine ca admin" — GREȘIT. Nimeni nu l-a invitat pe utilizator; a fost o cerere spontană din pagina grupului.

Ipoteză de verificat: fluxul „Cere alăturare" e implementat peste mecanismul de invitații (rând în tabelul de invitații cu invited_by null / egal cu solicitantul / alt membru implicit), iar template-ul din notify-admins alege ramura „invitație trimisă de un membru obișnuit" pentru orice rând unde invited_by nu e adminul, inclusiv pentru cereri spontane.

## Faza 1: AUDIT (doar citire, fără modificări)

1. Găsește codul frontend al butonului „Cere alăturare" de pe pagina grupului: ce insert/RPC face în Supabase (ce tabel, ce coloane, ce valoare are invited_by / inviter_id / sursa cererii).
2. Găsește în edge function notify-admins evenimentele implicate (probabil join_request și invitation_accepted sau echivalente din cele 21). Identifică condiția care alege template-ul „invitația a fost trimisă de un membru obișnuit".
3. Verifică în DB rândurile create azi pentru user_id 50212bd6-b592-477e-975a-cb4dd13265d3 (ambele grupuri): ce valori au câmpurile de tip invited_by / status / source.
4. Răspunde explicit: cererea spontană și invitația acceptată sunt același eveniment în cod, sau evenimente diferite cu template comun?

### STOP 1: prezintă concluziile auditului și așteaptă confirmarea lui Lucian înainte de orice plan.

## Faza 2: PLAN

Propune fix-ul minim, de exemplu:
- Distinge cererea spontană de invitația acceptată (coloană source / invited_by null => cerere spontană).
- Template cerere spontană către adminul grupului: „X a cerut să se alăture grupului Y și așteaptă aprobarea ta." (fără nicio mențiune de invitație).
- Template invitație acceptată rămâne cum e, doar pentru invitații reale.
- Verifică să nu se dubleze notificările către superadmin (pattern-ul dublu user + superadmin trebuie păstrat, dar cu textul corect pe fiecare ramură).

### STOP 2: plan aprobat de Lucian înainte de implementare.

## Faza 3: IMPLEMENTARE

- Modificările în notify-admins (index.ts) și, dacă e cazul, în insertul din frontend.
- Fără migrații DB decât dacă e strict necesar (dacă da, script separat pentru SQL Editor, cu comentarii).

## Faza 4: TEST

- Simulează o cerere spontană pe un grup exemplu cu un cont de test: verifică textul emailului către adminul grupului și către superadmin.
- Simulează o invitație reală trimisă de un membru obișnuit + acceptare: verifică că textul „invitația a fost trimisă de un membru obișnuit" apare DOAR aici.
- Verifică idempotency guard (nu se trimit duplicate).
- Verifică Slack #app_events pentru ambele scenarii.

### STOP 3: rezultatele testelor prezentate lui Lucian.

## Faza 5: COMMIT / DEPLOY

- NIMIC nu se pushează pe GitHub și NU se rulează npx supabase functions deploy fără aprobarea explicită a lui Lucian.
- Deploy edge function din C:\Users\lucia\supabase cu: npx supabase functions deploy notify-admins

## Reguli de limbaj pentru orice text de email modificat

- Diacritice corecte obligatoriu.
- Fără em-dash (—) în texte; folosește virgulă, două puncte sau paranteze.
- „bloc", nu „mic bloc".
- Ton calm, factual.
