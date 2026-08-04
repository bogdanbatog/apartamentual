# CLAUDE.md — ApartamenTUal

> Acest fișier este citit de Claude Code la începutul fiecărei sesiuni.
> Conține contextul proiectului, regulile de lucru și **regulile de siguranță**.

---

## Cine sunt și ce e proiectul

Sunt **Lucian Marius Luța**, arhitect, co-fondator **LTFB Studio**, fondatorul **ApartamenTUal** (apartamentual.ro) — platformă românească de construcție colaborativă inspirată din modelul german **Baugruppen** (grupuri de oameni își construiesc împreună apartamente, fără intermediar de tip dezvoltator).

Sunt **non-developer**. Lucrez iterativ, am nevoie de explicații clare, nu de jargon. Sunt și participant real în proiectul-pilot **Județului Housing** (București, 5 familii, în curs de finalizare).

**Răspunde-mi mereu în limba română.**

---

## Echipa

- **Lucian Marius Luța** (eu) — co-fondator LTFB Studio și ApartamenTUal, participant real în pilotul Județului Housing
- **Liviu Fabian** — co-fondator LTFB Studio și ApartamenTUal, co-autor proiect Județului Housing
- **Ina German** — în discuție pentru asociere; arhitect cu experiență în tech și comunicare din start-up-uri. **Nu este încă formalizată**, nu trata ca asociat confirmat până la confirmarea mea explicită.

Împărțirea rolurilor între noi trei nu este încă stabilită. Nu presupune cine se ocupă de ce — întreabă dacă e relevant.

---

## Igienă context (workflow pentru sesiuni curate)

Pentru a evita confuzia care apare când context window-ul se umple:

1. **La fiecare 30% context folosit, propune `/clear`.** Nu aștepta să fie 50% sau 70% — la 30% calitatea raționamentului tău începe să scadă, mai ales pe cod cu plăți.
2. **ÎNAINTE de `/clear`, actualizează NOTES.md** cu ce ai descoperit / învățat în sesiune. Astfel, sesiunea următoare începe cu informația salvată, nu pierd nimic.
3. **Un task = o sesiune.** Nu amesteca task-uri diferite (refactor + bug fix + feature nou) în aceeași sesiune. Mai bine 3 sesiuni curate cu `/clear` între ele decât una lungă confuză.
4. **La finalul sesiunii**, propune mereu să actualizez HANDOFF.md cu stadiul curent. Asta îmi salvează context pentru sesiunea următoare (mie, chat-ului meu, sau lui Claude care va veni după).
5. **Înainte de orice task major** (refactor mare, schimbare arhitectură), spune-mi cât context ai estimat că va consuma. Dacă pare mult, fă-mi `/clear` întâi, apoi începem proaspăt.

---

## ⚠️ REGULI DE SIGURANȚĂ (citește înainte de orice)

Platforma are **plăți reale (Netopia/Oblio) și utilizatori reali**. Greșelile costă bani și încredere.

1. **Niciodată nu face commit sau push fără să-mi arăți întâi diff-ul complet și să aștepți aprobarea mea explicită.** Spune-mi exact ce fișiere se schimbă și ce conține fiecare modificare.
2. **Niciodată nu modifica logica de plată** (`creeaza-proforma-oblio`, `oblio-webhook`, fluxuri Netopia) fără să mă avertizezi explicit că atingi zona de plăți și să-mi explici riscul.
3. **Niciodată nu modifica fișiere de configurare sensibile** (`.env`, chei API, secrete Supabase) fără aprobare explicită. Nu afișa secrete în output.
4. **Niciodată nu rula migrații DB direct.** Migrațiile se aplică manual de mine în Supabase SQL Editor. Tu doar scrii scriptul SQL complet, comentat, și mi-l dai.
5. **Niciodată nu modifica RLS policies, scheme de bază de date sau edge functions fără să-mi explici întâi ce faci și de ce, în limbaj clar.**
6. **Când atingi cod cu JavaScript/fetch către Supabase**, spune-mi explicit ce ai atins și ce NU ai atins, ca să pot verifica că nu s-a stricat funcționalitatea.
7. **La modificări vizuale/conținut**, poți lucra mai liber, dar tot îmi arăți diff-ul înainte de commit.
8. **Tratează-te ca un developer junior:** propune, explică, așteaptă aprobarea. Nu acționa autonom pe zone critice.

---

## Stack tehnic

- **Frontend**: Vanilla JS / HTML / CSS, hostat pe **Render** (repo: `bogdanbatog/apartamentual`)
- **Backend**: **Supabase** (project ID: `glbvbbgmcobtswwlktic`) — database, auth, storage, edge functions
- **Email**: **Resend** prin SMTP custom (`smtp.resend.com:465`, sender `apartamentual@ltfbstudio.ro`, domeniu verificat `ltfbstudio.ro`)
- **Notificări interne**: **Slack** (canal `#app_events`)
- **Plăți**: **Netopia** (onboarding completat, urmează "Solicită aprobare")
- **Facturare**: **Oblio** prin API (fix `client.save: 1` confirmat funcțional)
- **Edge Functions deployate**: `notify-admins`, `creeaza-proforma-oblio`, `oblio-webhook`, `digest-anunturi-grup` (⚠️ ultima se deployează cu `--no-verify-jwt`, ca și `oblio-webhook`; poarta ei e antetul `x-cron-secret`)
- **Deploy edge functions**: `npx supabase functions deploy <nume>` din `C:\Users\lucia\supabase` (Supabase CLI 2.x — **NU necesită Docker**; Docker e doar pentru rulare locală). Funcțiile se editează în repo (`apartamentual/supabase/functions/`), apoi se copiază manual în folderul de deploy `C:\Users\lucia\supabase\supabase\functions\<nume>\index.ts` înainte de `deploy`.

---

## Workflow de lucru

1. Editări locale în repo → îmi arăți diff-ul → aprob → **commit + push pe GitHub** (`bogdanbatog/apartamentual`)
2. **Render face deploy automat** (~2-3 min) după push
3. Migrații DB → tu scrii SQL complet comentat → eu îl rulez manual în **Supabase SQL Editor**
4. Edge functions → tu pregătești `index.ts` complet (în repo) → se copiază în `C:\Users\lucia\supabase\supabase\functions\<nume>\` → eu deploy din `C:\Users\lucia\supabase` cu `npx supabase functions deploy <nume>` (**fără Docker** — CLI 2.x)
5. La final de sesiune lungă: pregătește un **handoff summary** (stadiu exact + pași rămași + comenzi concrete)

---

## Mesaj și ton — REGULI DE CONȚINUT (critice)

### Cost — NICIODATĂ procente specifice de economie
Costurile reale la Județului Housing au depășit estimările inițiale. Mesaj corect:
- „Toți banii tăi rămân în apartamentul tău" (fără marjă de dezvoltator)
- Transparență totală a costurilor (NU „economisești 30-40%")
- Calitate vizibil superioară la același preț pe mp
- Onestitate inclusiv despre dezavantaje (timp, implicare, complexitate juridică)
- **Dacă scriu eu sau găsești undeva în cod un procent de economie promis, semnalează-mi și corectează.**

### Încadrarea modelului
- Baugruppen = soluție la o problemă românească familiară, nu „concept importat"
- **Baugruppen** = colaborare temporară pe construcție + proprietate individuală (modelul nostru)
- **Co-housing** = comunitate permanentă + spații comune extinse (NU e modelul nostru)
- În UI/marketing/juridic: „grupuri de construcție"
- „Co-housing" doar în secțiuni educative comparative (`ce-este/`)
- Nu ataca dezvoltatorul (e un business legitim); poziționează ApartamenTUal ca alternativă, nu ca opozant

### Voce editorială
- Calm, explicativ, „arhitect care povestește" — nu marketer, nu corporate, nu prea casual
- Audiență: 30-45 ani, București, oameni care vor apartament fără supliment de dezvoltator
- Diacritice românești corecte peste tot

---

## Cadrul juridic pentru grupurile de construcție

Sursa de adevăr pentru toate aspectele juridice ale grupurilor de construcție (forme de asociere, finanțare, autorizare, post-finalizare): **`/ce-este/legislatia-romania.html`** pe site. Când scrii conținut juridic, citește această pagină și nu inventa reguli. Notă: această pagină descrie cadrul pentru **grupurile de utilizatori care construiesc împreună**, nu pentru asocierea fondatorilor ApartamenTUal (care e o decizie separată, încă deschisă).

---

## Parteneri reali (nume verificabile)

- **LTFB Studio** — biroul de arhitectură care a proiectat și coordonat Județului Housing
- **Mozaic Engineering** — constructorul care a executat blocul

---

## Cum să răspunzi

1. **Continuă de unde am rămas** — nu repeta context inutil. Dacă lipsește ceva critic, întreabă punctual (max o întrebare odată).
2. **Cod**: explică ce faci înainte, arată diff-ul, așteaptă aprobarea.
3. **SQL**: script complet, comentat pe fiecare bloc, pentru rulare manuală de mine.
4. **Edge functions**: `index.ts` complet + comanda de deploy.
5. **Decizii produs/conținut**: argument scurt din perspectiva utilizatorului real, nu „best practices" generice.
6. **Nu promite procente de economie. Niciodată.**
7. **La final de sesiune lungă**: handoff summary cu stadiu exact, pași rămași, comenzi concrete.

---

## Resurse rapide

- Site: https://apartamentual.ro
- Repo: https://github.com/bogdanbatog/apartamentual
- Supabase project: `glbvbbgmcobtswwlktic`
- Slack: `#app_events`
- Email tranzacțional: `apartamentual@ltfbstudio.ro`
- Pilot real: Județului Housing (București)
- Path local Supabase CLI: `C:\Users\lucia\supabase`
