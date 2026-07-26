# Handoff: RLS pe jurnalul de progres al grupurilor

> **STARE: REZOLVAT ȘI RULAT (2026-07-26).** Commit `31339d9` pe `main`, cu trei
> migrații. Toate trei au fost rulate manual în Supabase SQL Editor și verificate
> funcțional. **Nu s-a pushat pe GitHub.** Nu e nevoie de deploy din cPanel —
> nicio modificare de frontend, totul e în baza de date.

## Cum a început

Logat ca superadmin, pe pagina unui grup, secțiunea „Progresul Grupului" arăta
doar titlurile etapelor și pașilor — fără note și fără atașamente. Ca admin de
grup, aceleași lucruri se vedeau.

## Ce era de fapt (trei probleme, nu una)

**1. Atașamentele invizibile pentru superadmin — bugul reclamat.**
`grup_checklist_files` avea două politici de SELECT și niciuna nu-l includea pe
superadmin:
- `checklist_files_select` → adminul grupului, sau membru în grup „cu aprobare"
- `checklist_files_select_members` → membru cu status `activ`, sau `is_admin()`

`is_admin()` verifică `profiles.is_admin`, care e **alt câmp** decât
`profiles.is_super_admin`. Superadminul picase ambele condiții. RLS întoarce listă
goală **fără eroare**, deci nu apărea nimic nici în consolă. Celelalte două tabele
ale jurnalului aveau deja politici `Super admin full access ...` (ALL) — pe tabela
de fișiere s-a uitat.

**2. Notele nu erau un bug.** `Public read checklist notes` avea qual `true`, deci
superadminul le vedea deja. Nu le vedea pentru că pe grupul testat („Parcul
Circului,") **nu exista nicio notă**. În toată platforma era una singură, pe un
grup-exemplu.

**3. Două găuri de securitate găsite pe drum:**
- politica de storage `Users can delete own checklist files` avea condiția doar
  `bucket_id = 'checklist-files'`, fără verificare de proprietar → orice
  utilizator logat putea șterge orice atașament al oricărui grup (pierdere de
  date, nu doar expunere)
- `grup_checklist` și `grup_checklist_notes` aveau `Public read ...` cu qual
  `true`, iar bucket-ul avea `Anyone can read checklist files` → bifele, notele și
  fișierele grupurilor **reale** se citeau fără login, cu cheia anon care e
  publică în `frontend/js/supabase-config.js`

## Ce s-a rulat (commit `31339d9`)

| Fișier | Ce face |
|---|---|
| `supabase/migrations/032_checklist_files_superadmin_read.sql` | politică nouă `Super admin read checklist files` (SELECT, `public.is_super_admin()`) |
| `supabase/migrations/033_checklist_files_storage_delete_owner.sql` | rescrie politica de DELETE pe storage: ștergere doar de către cel din `grup_checklist_files.uploaded_by` |
| `supabase/migrations/034_checklist_close_public_read.sql` | înlocuiește cele trei politici publice de SELECT (2 tabele + storage) cu politici pe apartenență: membru `activ`, admin de grup, superadmin |

Criteriul de membru din politici e același folosit de pagină
(`grup-details.html:1341`): rând în `grup_membri` cu `status = 'activ'`. Cererile
`pending` nu dau acces.

## Verificat

- superadmin, grup-exemplu `d6ab0a78-...`, faza 2 extinsă → atașamentele apar
  (confirmat de Lucian după rularea 032)
- după 034, interogare cu cheia anon **nelogat**: `grup_checklist`,
  `grup_checklist_notes`, `grup_checklist_files` → 0 rânduri (înainte: 7 / 1 / 0),
  listarea bucket-ului → listă goală (înainte: 2 foldere de grup), descărcare
  directă de fișier → HTTP 400
- niciun fișier frontend atins; `grup_checklist*` sunt citite doar din
  `grup-details.html`, pe ramura `isMember || isSuperAdmin`
  (`grup-details.html:1612`), iar bucket-ul e folosit doar acolo, fără
  `getPublicUrl` — de aceea închiderea citirii publice nu produce regresii

## De testat totuși pe site (nu s-a putut din Claude Code)

Regresia cea mai probabilă e ca o politică să fie prea strictă și membrii să-și
piardă accesul la propriul jurnal:

1. ca **membru activ** al unui grup: bifele, notele și atașamentele apar; bifarea
   unui pas, adăugarea unei note și urcarea unui fișier funcționează
2. ca **admin de grup** (fondator care poate nu are rând în `grup_membri` —
   acoperit explicit de ramura `admin_id` din politici)
3. ca **utilizator logat, nemembru**: secțiunea nu se încarcă

## Dependență de reținut pentru viitor

Politica de DELETE din `033` se sprijină pe rândul din `grup_checklist_files`.
Funcționează pentru că `deleteStepFile()` (`grup-details.html:4310`) șterge **întâi**
fișierul din storage și abia apoi rândul din tabelă. **Dacă vreodată se inversează
ordinea în cod, ștergerea din storage va începe să eșueze.**

## Rămas deschis

- **`grup_membri` e citibil fără autentificare.** Decizie de produs, nu bug: ce
  dintr-un grup e public și ce nu. De gândit împreună cu politicile din `034`,
  care se sprijină pe citirea din `grup_membri`.
- **Fișiere orfane în storage**, sub folderul unui grup care nu mai există în
  tabela `grupuri`: `097aa33f-19ee-4d9e-8513-c98d9ffb161f/f1_regulament/`. După
  `033` nu mai pot fi șterse prin API de nimeni (nu au rând de metadate) — se
  șterg din Dashboard → Storage.
- **Moderare atașamente**: adminul de grup și superadminul nu pot șterge
  atașamentul altcuiva. Politica opțională e scrisă, comentată, la finalul lui
  `033`; ar avea nevoie și de un buton în interfață.
- **Push pe GitHub** — commit-ul `31339d9` e doar local.

## Context util pentru sesiuni viitoare

- Grupurile-exemplu (`is_demo = true`) și adminii lor: *Comunitate Verde Băneasa*
  → `luta.lucian.m+test15@gmail.com` (pseudonim Cristina Moldovan);
  *Bloc Eco pentru Medici* → `+test18`; *Investiție Inteligentă – Bloc Boutique
  Central* → `+test12`. Toate pe alias-uri ale adresei tale, deci resetul de
  parolă ajunge în inbox-ul tău.
- Singurul grup-exemplu cu date reale în jurnal (o notă + două atașamente) e
  *Investiție Inteligentă – Bloc Boutique Central*
  (`d6ab0a78-6935-4a95-8967-794708c208e5`) — util pentru teste.
- Notele și atașamentele se încarcă **doar pentru fazele deschise**
  (`grup-details.html:1965`); prima fază neterminată se auto-deschide. Dacă testezi
  o fază închisă, trebuie click pe ea întâi.
- Diagnostic rapid de RLS fără login: se pot interoga tabelele cu cheia anon din
  `frontend/js/supabase-config.js`. Ce vede `anon` = ce e public.
