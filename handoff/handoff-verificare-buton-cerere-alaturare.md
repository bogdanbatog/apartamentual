# Handoff: verificare buton „Cere alăturarea" (semnalat pe Facebook)

**Data:** 2026-07-24
**Rezultat pe scurt:** butonul funcționează corect în toate stările. **Nu s-a modificat niciun cod.** Semnalarea de pe Facebook s-a explicat prin faptul că persoana avea un cont neactivat / profil necompletat.

## Context

Comentariu pe Facebook: „SA STITI CA NU ESTE ACTIVAT BUTONUL PT CERERE ALATURARE. verifica".

Am verificat integral fluxul de alăturare la grup, live pe `apartamentual.ro`, cu unelte de browser.

## Ce s-a verificat (live) și concluzia

Pagina live folosită de site este `grup-details.html` (cu „s"), cu JS inline — **nu** `grup-detail.html`/`js/grup-detail.js`, care par a fi versiunea veche (folosesc tabela veche `grup_membership` și coloana `max_members`). Pagina live scrie în tabela `grup_membri` și folosește coloana `max_membri`.

Butonul se randează corect în toate stările:

| Situație vizitator | Ce vede | Stare |
|---|---|---|
| Nelogat, pe pagina grupului | „Conectează-te pentru a te alătura" → `openLoginModal()` | OK — modalul (`login-modal-overlay`) se deschide corect (`display:flex`) |
| Nelogat, pe lista de grupuri | „Creează cont pentru detalii" → register | OK |
| Logat, utilizator normal | „Cere alăturarea" → `requestJoinGroup()` | OK |
| Cont de agenție (`account_type='profesional'`) | „Conturile de agenție nu pot intra în grupuri" (fără buton) | intenționat |
| Grup exemplu (`is_demo=true`) | „Pornește un grup ca acesta" (fără buton de alăturare) | intenționat |

Verificări suplimentare:
- Toate funcțiile există și rulează: `requestJoinGroup`, `joinGroup`, `showToast`, `notifyAdmins`, `openLoginModal`.
- `normalizeStatus` face fallback pe `deschis`, deci mereu rezultă un buton valid (nu „dispare" din cauza unui status necunoscut).
- **Test RLS pe viu:** logat cu un cont **normal** (`luta.lucian.m@gmail.com`, `is_super_admin=false`, non-agenție, non-membru), am făcut exact insertul pe care-l face butonul (`grup_membri` cu `status='pending'`) pe un **grup demo** — a **reușit**. Rândul de test a fost **șters imediat** (efect net zero pe date). Deci RLS permite unui utilizator obișnuit să trimită cererea.

## Cauza reală a semnalării

Persoana care a comentat era un utilizator cu **cont neactivat / profil necompletat** (apărea „fără nume" în lista de utilizatori; emailul era apropiat de numele real). Cel mai probabil nu era logat / nu confirmase emailul, deci nu vedea butonul „Cere alăturarea" (care apare doar pentru utilizatori logați).

## Rezolvare cu utilizatorul

I s-a răspuns public (comentariu) și apoi privat, îndrumându-l:
1. Să confirme emailul pentru a activa contul (login: `https://apartamentual.ro/index.html?login=1`).
2. Să-și completeze profilul cu zone de interes și preferințe de locuire (`https://apartamentual.ro/profile-edit-new.html`), pentru potrivire cu vecini.

## Observație / posibil de urmărit (nu urgent)

Pentru un vizitator **nelogat** pe pagina unui grup, butonul „Conectează-te pentru a te alătura" doar deschide login-ul — nu duce direct la o acțiune de alăturare. E corect tehnic, dar poate fi citit de un om ca „butonul nu face nimic". Dacă se repetă feedback-ul, se poate reformula textul butonului sau adăuga un pas explicativ. Nu s-a modificat nimic acum.
