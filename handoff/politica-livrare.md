# Handoff Claude Code — Pagina „Politica de livrare" + link în footer

## Context
Netopia cere o „Politică de livrare comandă" ca document distinct (checkbox separat
de Politica de retur). Site-ul nu are încă o pagină dedicată. O creăm acum, clonând
structura vizuală din `politica-retur.html`, și adăugăm link în footer-ul LEGAL.

Nu modifica J-ul. Site-ul folosește `J2007012417402` (oficializat la ONRC) și rămâne așa.

Lucrează în 5 faze cu STOP-uri. Nu face commit și nu da push fără confirmarea mea
explicită (push declanșează auto-deploy pe Render).

---

## FAZA 1 — AUDIT (fără modificări)
1. Deschide `politica-retur.html` și identifică-i scheletul: `<head>` (CSS, fonturi,
   meta), header/nav, structura de hero, structura cardurilor/secțiunilor, footer.
   Pe astea le reutilizăm identic, ca pagina nouă să arate la fel.
2. Identifică în footer blocul LEGAL (Termeni și condiții / GDPR / Politica de retur /
   FAQ / Ghid platformă / Contact). Notează-mi în CÂTE fișiere apare footer-ul
   (probabil pe toate paginile sau printr-un include comun) și cum e structurat
   link-ul „Politica de retur" (href, clasă), ca să adaug „Politica de livrare"
   în același tipar, imediat după.
3. Confirmă-mi numele fișierului paginii de retur și convenția de denumire, ca pagina
   nouă să se numească consistent (propunere: `politica-livrare.html`).

**STOP. Așteaptă confirmarea mea înainte de Faza 2.**

---

## FAZA 2 — PLAN
1. Listează-mi exact ce fișiere creezi/modifici:
   - fișier nou: `politica-livrare.html`
   - footer: lista fișierelor (sau include-ul comun) unde adaugi link-ul LEGAL
2. Confirmă plasarea link-ului: în secțiunea LEGAL, imediat DUPĂ „Politica de retur".

**STOP. Așteaptă confirmarea mea.**

---

## FAZA 3 — IMPLEMENTARE
1. Creează `politica-livrare.html` folosind EXACT scheletul din `politica-retur.html`
   (head, nav, footer, aceleași clase și structură de card/secțiune). Schimbă doar:
   - titlul paginii și `<title>` / meta în „Politica de livrare"
   - conținutul din corp cu secțiunile de mai jos
2. Conținut (păstrează tonul calm, diacritice, fără em-dash-uri):

   TITLU: Politica de livrare
   SUBTITLU: Reguli clare privind livrarea rapoartelor de analiză.

   CASETĂ „Pe scurt":
   Analizele ApartamenTUal sunt servicii digitale. Primești raportul în format PDF,
   pe email, la adresa folosită la facturare. Nu există livrare fizică, deci nu se
   percep costuri de transport. Termen: 3-5 zile lucrătoare pentru analiza preliminară,
   stabilit prin contract pentru analiza detaliată.

   1. Ce livrăm
   ApartamenTUal livrează servicii digitale: rapoarte de analiză de teren, elaborate
   de biroul de arhitectură, în format PDF. Nu livrăm produse fizice. Nu se percep
   taxe de livrare, ambalare sau transport.

   2. Modalitatea de livrare
   Raportul se transmite electronic, prin email, la adresa indicată în datele de
   facturare la momentul comenzii. Asigură-te că adresa de email este corectă,
   fiindcă acolo primești atât factura, cât și raportul.

   3. Termenul de livrare
   Analiză preliminară: în maximum 3-5 zile lucrătoare de la confirmarea plății.
   Analiză detaliată: termenul se stabilește prin contract, de comun acord, în funcție
   de complexitatea proiectului, fiindcă acest tip de analiză se elaborează la cerere.
   Termenul curge din momentul în care plata este confirmată, cu condiția ca datele
   necesare (în special numărul cadastral) să fie complete și corecte.

   4. Date insuficiente sau incorecte
   Dacă, după plată, datele furnizate sunt incomplete sau neclare (de exemplu un număr
   cadastral care nu poate fi identificat), termenul de livrare se suspendă până la
   clarificare. În acest caz te contactăm prin email în maximum 24 de ore lucrătoare,
   ai la dispoziție 7 zile lucrătoare pentru a transmite clarificările, iar după
   primirea datelor corecte termenul repornește. Detaliile complete sunt în Politica
   de retur, secțiunea „Date insuficiente pentru identificarea terenului".

   5. Întârzieri și imposibilitate de livrare
   Dacă, din motive care țin exclusiv de noi (indisponibilitate tehnică sau a echipei),
   nu putem livra raportul în termenul agreat și nici într-un termen rezonabil ulterior,
   ai dreptul la refund integral, conform Politicii de retur, secțiunea „Cazuri
   excepționale de refund integral".

   6. Confirmarea livrării
   Raportul este considerat livrat în momentul în care îți este transmis pe email, în
   format PDF, la adresa folosită la comandă.

   7. Contact
   Pentru orice întrebare legată de livrarea unei analize: office@ltfbstudio.ro.
   Răspundem în maximum 24 de ore în zilele lucrătoare.

   BLOC FIRMĂ (la final, ca în retur):
   SC LTFB Studio SRL · CUI RO22004992 · Reg. Com.: J2007012417402 ·
   Str. Popa Petre 23, Sector 2, București
   Ultima actualizare: 29 iunie 2026

3. Adaugă în footer-ul LEGAL link „Politica de livrare" -> `politica-livrare.html`,
   imediat după „Politica de retur", în toate fișierele identificate la Faza 1.

---

## FAZA 4 — TEST
1. Deschide `politica-livrare.html` și confirmă-mi că se randează identic ca retur
   (header, footer, stiluri), fără secțiuni rupte.
2. Verifică din footer că link-ul „Politica de livrare" duce corect la pagină.
3. Rulează un grep ca să confirmi că link-ul a fost adăugat în toate fișierele cu footer:
   grep -rln "politica-livrare.html" .
   și arată-mi rezultatul.

---

## FAZA 5 — COMMIT
1. Pregătește commit cu mesaj:
   "Adăugare Politica de livrare (pagina + link footer LEGAL) pentru cerința Netopia"
2. NU da push. Arată-mi diff-ul complet și așteaptă OK-ul meu explicit înainte de
   orice push/deploy.
