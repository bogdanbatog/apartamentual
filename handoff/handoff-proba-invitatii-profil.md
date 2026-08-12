# HANDOFF — proba pe viu: invitațiile în grup trebuie să aterizeze în formularul de profil

> Scris pe 10 august 2026, noaptea. **Nu s-a modificat nicio linie de cod în sesiunea asta** —
> e doar pregătirea probei, ca s-o putem relua de la zero fără să redescoperim capcanele.

---

## Unde suntem

Reparația e **scrisă, comisă (`b09bb3a`) și deployată din cPanel** pe 10 august seara. Cele trei
fișiere sunt live, iar funcția SQL `profil_complet` răspunde prin API. Securitatea pe funcții a
fost strânsă imediat după (`ae27ae8`).

**Rămâne un singur lucru: proba pe viu**, cu o adresă de email nouă. Punctul 1 al probei:

> invitație pe adresă nouă → deschizi linkul **nelogat** → „Creează cont" → clic pe linkul de
> confirmare din email → **trebuie să aterizezi pe formularul de profil, NU pe pagina invitației**.

URL-ul așteptat la pasul ăla: `profile-edit-new.html?welcome=1&redirect=/accept-invite.html?token=…`

## Ce a decis Lucian pentru probă

Face **un cont nou** și **debifează „Demo" la un grup-exemplu**, ca să aibă unde invita.

## Cele cinci lucruri de știut înainte (verificate în cod în sesiunea asta)

1. **Invitația NU pleacă automat prin email.** `grup-details.html:3033` cheamă
   `create_group_invitation` și primește înapoi un token; modalul te lasă să alegi cum trimiți
   (email prin Resend / WhatsApp / **copiază linkul**). Pentru probă ia **copiază linkul** — o
   piesă mai puțin care poate strica proba. Emailul care contează la punctul 1 e **cel de
   confirmare a contului**, trimis de Supabase pe adresa nouă.

2. **⚠️ Proba se face în fereastră privată.** Ăsta e pasul care poate invalida tot testul:
   `register.js:33-42` — dacă există deja o sesiune (tu, ca Lucian) și deschizi un link cu
   `?redirect=`, ești trimis **direct la destinație**, sărind peste formularul de profil. Deci
   linkul de invitație se deschide în **incognito**, unde nu e niciun cont logat.

3. **Ce se schimbă când debifezi „Demo" pe grup** (`admin-grupuri.html:143`): dispare eticheta
   „Exemplu" de pe `/grupuri` și de pe pagina grupului, grupul urcă la sortare printre cele reale,
   iar în locul butonului „Pornește un grup ca acesta" apare **cererea de alăturare pentru oricine
   e logat** (`grup-details.html:1731`). Pe durata probei grupul arată public ca grup real —
   **rebifează-l imediat după**. Membrii marcați „Exemplu" în interior își păstrează badge-ul lor;
   acela stă pe profil, nu pe grup.

4. **Butonul „Invită" apare doar dacă ești membru/admin în grupul ales** (`grup-details.html:1707`).
   Debifarea de la Demo **nu** te face admin. De verificat înainte de orice: intri în grup și vezi
   dacă ai butonul. Dacă nu, alegem alt grup.

5. **Curățenie după probă:** contul nou apare pe `/utilizatori` ca utilizator real și dă o
   notificare pe Slack `#app_events`. Se poate marca „Demo" din `admin-utilizatori.html`. Scoți
   membrul de test din grup și **rebifezi „Demo"** pe grup.

## Traseul de urmărit, pas cu pas

| Pas | Ce faci | Ce trebuie să vezi |
|---|---|---|
| 1 | Din grup → „Invită", pui adresa nouă → **copiază linkul** | Link de forma `accept-invite.html?token=…` |
| 2 | Deschizi linkul în **incognito** | Pagina invitației cu numele grupului + „Creează cont" |
| 3 | Creezi contul | Ecranul „Verifică-ți emailul" |
| 4 | **Clic pe linkul de confirmare din email** | ⚠️ **`profile-edit-new.html?welcome=1&redirect=…`** — nu pagina invitației. **Ăsta e punctul 1.** |
| 5 | Completezi și salvezi profilul | Te întoarce singur pe `accept-invite` |
| 6 | Accepți invitația | Intri în grup |

## Restul probelor, după punctul 1

- **(b)** cont existent cu profil gol + link de invitație → ecranul **„A mai rămas un pas"**
  (`accept-invite.html:360-373`), nu pagina grupului.
- **(c)** cont cu profil complet → traseul vechi, neschimbat.

## Reperele din cod, dacă ceva nu merge

- `frontend/js/register.js:466-481` — orice `?redirect=` e împachetat în
  `profile-edit-new.html?welcome=1&redirect=<destinație>` (linkul din emailul de confirmare).
- `frontend/js/register.js:485,557` — retrimiterea emailului păstrează aceeași destinație.
- `frontend/js/register.js:739-741` — butonul „Am confirmat" trece tot prin profil.
- `frontend/accept-invite.html:360-373` — plasa a doua, pentru cine e deja logat cu profil gol.
- `frontend/js/profile-edit-new.js:809` — `destinatiaDupaSalvare()` acceptă **doar căi interne**;
  de aia toate redirecturile sunt relative.
