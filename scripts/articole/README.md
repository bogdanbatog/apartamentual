# Publicarea articolelor fără admin

Scriptul `publica-articol.js` trimite un fișier-articol edge function-ului
`publica-articol` (din `supabase/functions/`), care creează sau modifică
articolul în tabela `articles`. Nimic altceva nu e atins.

## Pașii, mereu în ordinea asta

```powershell
# 1. Proba: nu trimite nimic; verifică textul, scrie previzualizarea în local/
node scripts/articole/publica-articol.js "cale/articol.md"

# 2. Ciorna: articolul apare doar în admin
$env:ARTICOLE_SECRET="..."; node scripts/articole/publica-articol.js "cale/articol.md" --ciorna

# 3. Publicare (tot așa se trimit și corecturile unui articol publicat)
$env:ARTICOLE_SECRET="..."; node scripts/articole/publica-articol.js "cale/articol.md" --publica
```

Formatul fișierului e descris în capul scriptului. Exemplu complet:
`calendar postari si episoade/20260901 exemplul 2 Berlin Neukölln/articol-site-neukolln.md`.

## De știut

- **Parola** (`ARTICOLE_SECRET`) stă doar în Supabase (nu se poate citi înapoi) și la Lucian.
  Dacă se pierde, se face una nouă și se pune cu `npx supabase secrets set ARTICOLE_SECRET=...`
  din `C:\Users\lucia\supabase`; cea veche nu mai merge din clipa aceea.
- **Deploy:** `npx supabase functions deploy publica-articol --no-verify-jwt` (fără
  `--no-verify-jwt`, Supabase refuză cererile scriptului).
- **Articolele urcate așa nu se mai salvează din admin:** adminul le schimbă slug-ul
  când se editează titlul și le rescrie data publicării la fiecare salvare.
- Slug-ul se alege o dată și nu se mai schimbă: linkurile din postări duc acolo.
- Un articol publicat nu se poate retrage în ciornă din script; se retrage din admin.
- O poză nouă pe un articol care are deja una cere `--imagine-noua`.
- Categoriile `ghiduri` și `primarii` sunt noi: dacă `articles.category` are un CHECK
  în baza de date, salvarea lor dă eroare până se lărgește lista.
