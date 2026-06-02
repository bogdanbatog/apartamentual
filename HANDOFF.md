# HANDOFF — ApartamenTUal

> Status curent al proiectului. Citește la începutul fiecărei sesiuni noi (chat sau Claude Code) ca să intri rapid în context.
> Ultima actualizare: 2 iunie 2026

---

## Status general

Platformă activă pe https://apartamentual.ro, hostată pe Render, backend Supabase.
Pilot real în curs: **Județului Housing** (București, 5 familii, aproape de mutare).
Lansare publică iminentă, dar nu există dată fixă.

---

## Echipă

- **Lucian Marius Luța** (eu) — co-fondator LTFB Studio și ApartamenTUal
- **Liviu Fabian** — co-fondator LTFB Studio și ApartamenTUal
- **Ina German** — în discuție pentru asociere. Arhitect cu experiență tech și comunicare. **Nu formalizată încă.**

Împărțirea rolurilor între noi trei nu e stabilită. Nu presupune.

---

## Ce e finalizat și stabil

- Sistem de notificări (21 evenimente)
- Flux registrare (signup → verificare email → profile → homepage)
- Admin panel complet
- Integrare Oblio + Netopia (edge functions deployate)
- Database curat, migrațiile prin 029
- **Homepage v9 integrat și LIVE** (28 mai) — design + texte noi (Claude Design), font Mona Sans, portrete reale + carusel Strada Județului, footer cu secțiunile reale (Navigare/Legal) + bara firmă/Netopia/ANPC, FAQ real complet, timelapse în buclă, video cu buton play sub față, preview News din Supabase. Backup vechi în `_archive/index-pre-v9.html`. Detalii: `HANDOFF-integrare-homepage-v9.md`.
- **Header + footer v9 unificat pe toate paginile interioare** (2 iunie, commit `864240c`) — `frontend/js/nav.js` și `frontend/js/footer.js` rescrise integral în stil v9 (Mona Sans, fundal crem, badge BETA, „Povestea noastră" în nav și footer, „Acasă" scoasă din ambele — click pe logo duce acasă). Logica auth (login, avatar+dropdown, mobile menu, blocare cont suspendat) păstrată 1:1. Banda firmă LTFB + Netopia + ANPC păstrată integral în footer. Butoanele flotante „Cere consultanță" și scroll-to-top restilizate v9. CTA-urile page-specifice „Propune teren" / „Creează grup" scoase din header (vor reapărea mai vizibil în corpul paginilor). Pe `parteneri.html` s-a descoperit că `fab-consultanta.js` era de fapt o copie veche a nav.js mascată sub alt nume — scos din pagină. Pe `povestea-noastra.html` lipsea `<script src="js/nav.js">` — adăugat.

---

## Ce e în lucru sau pe orizont apropiat

- **Automatizare deploy** — apartamentual.ro se deployează prin **cPanel** (NU Render, cum scrie CLAUDE.md): `.cpanel.yml` copiază `frontend/*` în `/home/ar4/app.ltfbstudio.ro/`. Momentan Lucian dă manual din cPanel „Update from Remote" + „Deploy HEAD Commit" după fiecare push. De automatizat (webhook GitHub→cPanel sau remote git direct care rulează `.cpanel.yml` la push).
- **Cod mort de curățat după unificarea header/footer v9**:
  - `frontend/nav.css` — definește clase `.unified-nav-*` care nu mai există în DOM (nav.js generează acum `.site-nav-*`). Multe pagini încă includ `<link rel="stylesheet" href="/nav.css">` — inofensiv, dar de șters împreună cu referințele.
  - `frontend/js/fab-consultanta.js` (227 linii) — copie veche a nav.js, neutilizată acum (am scos referința de pe parteneri.html, singura care o avea). Fișierul rămâne pe disc — de șters.
  - `frontend/fab-consultanta.css` — același caz, neutilizat acum.
  - În `nav.js`, mecanismul page-specific CTA (`ctaButton` din `getPageConfig`) rămâne dar nicio ramură nu îl mai setează. De curățat când e clar că nu mai e nevoie de el.
- **Patch analiza-simplificata.html** (înlocuire pop-up vechi cu link la /comanda-analiza.html)
- **Solicită aprobare Netopia** + test plată reală
- **Migrare domeniu** apartamentual.onrender.com → apartamentual.ro (DNS + URL-uri în cod și Supabase Auth)
- **Transfer ownership Render** către luta.lucian.m@gmail.com
- **MFA** pe contul Supabase admin

---

## Setup tehnic Claude Code (NOU, 20 mai)

- Instalat pe laptop, versiunea 2.1.144 (update automat a eșuat — TODO: claude doctor sau npm i -g)
- Logat cu contul `office@ltfbstudio.ro` (LTFB Studio Organization, plan Max)
- Username GitHub: `lutalucianm-lang`
- Repo clonat local la: `C:\Users\lucia\proiecte\apartamentual`
- CLAUDE.md în repo (cu reguli de siguranță, echipă, ton, juridic ca trimitere la pagina site)
- NOTES.md în repo (cu 5 observații tehnice din prima sesiune)
- Workflow ales: SQL manual + deploy edge functions manual (prudent la început)

---

## Decizii deschise (de luat în curând)

1. **Forma juridică ApartamenTUal**: SRL nou separat sau sub LTFB? Cum intră Ina? — **Necesită avocat de start-up** (NU de imobiliar)
2. **Organizație GitHub vs. cont personal** — în discuție cu Ina, ea propune să facă ea organizația
3. **Contul Claude Code**: rămân pe LTFB sau trec pe personal? — provizoriu LTFB
4. **Cele 5 observații tehnice din NOTES.md** — abordate când ajung pe rol

---

## Ce să NU faci fără confirmare explicită

- Commit/push pe repo fără diff arătat
- Modificări la logica de plată (Netopia/Oblio)
- Rulare directă migrații DB (eu rulez manual în SQL Editor)
- Decizii despre echipă (cine ce rol)
- Decizii despre forma juridică

---

## Resurse rapide

- Site: https://apartamentual.ro
- Repo: https://github.com/bogdanbatog/apartamentual
- Supabase project: glbvbbgmcobtswwlktic
- Slack: #app_events
- Pilot: Județului Housing (București)
