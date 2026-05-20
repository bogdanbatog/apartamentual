# HANDOFF — ApartamenTUal

> Status curent al proiectului. Citește la începutul fiecărei sesiuni noi (chat sau Claude Code) ca să intri rapid în context.
> Ultima actualizare: 20 mai 2026

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
- Homepage v7 (hero + 3 căsuțe + Județul banner + secțiuni "de ce" și "cu ce te ajută") — finalizat ca draft, nu integrat încă pe site live

---

## Ce e în lucru sau pe orizont apropiat

- **Integrare homepage v7 pe site real** (din fișierul apartamentual-homepage-v7.html)
- **Întâlnire cu Ina** despre asociere și organizație GitHub
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
