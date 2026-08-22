# Handoff, 22 august 2026: trimiterea newsletterului cu episodul 4

## ✅ ÎNCHIS: newsletterul a plecat pe 22 august

Trimis din Resend → Broadcasts, către cei 31 de abonați confirmați. Restul documentului
descrie cum s-a ajuns aici și rămâne util ca tipar pentru episodul 5.

**Titlul s-a schimbat în ziua trimiterii**, la cererea lui Lucian. Vechiul titlu,
„Spațiile comune: cum au apărut, deși nu le doream la început", a fost înlocuit
peste tot cu:

```
Cum am ajuns la spații comune fără să le căutăm
```

Adică: în articolul de pe platformă (din admin, **fără** să se atingă Slug-ul, care
a rămas `judetului-housing-episodul-4-spatiile-comune`), în șablonul de email
(`<title>` și titlul din corp) și în subiectul din Resend, care a devenit
`Episodul 4: cum am ajuns la spații comune fără să le căutăm`.

**Rezumatul de trei paragrafe din email a fost rescris de Lucian** înainte de trimitere.
Formulările „o cameră în care nu locuiește nimeni" și „pe o singură ușă", scrise pentru
email și care nu existau în articol, au ieșit. Textul trimis se termină cu „pentru astfel
de spații", „ar fi dus la destrămarea grupului" și „pe o ușă spectaculoasă".

**Cum s-a pus HTML-ul în Resend:** clic în corpul emailului, `Ctrl+A`, `Delete`, apoi
**upload de fișier** direct din `email_templates/`. Nu copy-paste. Merită ținut minte
pentru episodul 5, fiindcă lipirea HTML-ului brut într-un editor vizual dă cod vizibil,
iar editarea peste conținutul episodului anterior lasă resturi (poza veche, linkul vechi).

**Cele două reparații descrise mai jos erau deja făcute** când s-a reluat lucrul:
în bază E4 stă la `22:01:15` și E3 la `22:01:07`, deci ordinea e corectă, iar teaserul
din E3 e ultimul paragraf al conținutului, nu al patrulea bloc.

---

## Starea la închiderea sesiunii de aseară (istoric)

| | |
|---|---|
| Episodul 4 pe platformă | ✅ **publicat**, live acum |
| Emailul de newsletter | ✅ scris, cu poza completată |
| Trimis | ❌ **nu** |
| Episodul 3 | ⚠️ **stricat în două feluri**, vezi mai jos |

Articolul publicat, verificat în bază:

```
titlu    Spațiile comune: cum au apărut, deși nu le doream la început
slug     judetului-housing-episodul-4-spatiile-comune
categ.   prototip          status  published
poza     .../articles/main-1787348320082.jpg   (95.522 octeți, răspunde 200)
```

Poza urcată e exact fișierul micșorat, `episod-4-spatii-comune-900px.jpg`, 900×506.

---

## ⚠️ REPARAȚIA 1: teaserul din episodul 3 a căzut în mijlocul articolului

Paragraful adăugat aseară în E3 a ajuns **al patrulea bloc din 45**, imediat după
introducere și chiar înaintea titlului `<h2>Cum căutam</h2>`.

Cititorul primește, după trei paragrafe:

> În episodul următor: spațiile comune. Cum am ajuns să avem câteva, deși la început
> nu le voia nimeni.

și pe urmă articolul continuă încă 41 de blocuri. Trebuie mutat la **finalul** câmpului
Conținut, după fraza care se termină cu „Sperăm să își găsească terenul potrivit.\</p>".

Se taie de unde e și se lipește la sfârșit. Textul rămâne același.

---

## ⚠️ REPARAȚIA 2: episodul 3 apare ACUM deasupra episodului 4

```
2026-08-21T21:44:15   Terenul: cum am căutat golurile din oraș        ← E3
2026-08-21T21:39:40   Spațiile comune: cum au apărut, deși nu le...   ← E4
```

**Cauza**, în `admin.html`, la salvare:

```js
// Set published_at when publishing
if (articleData.status === 'published') {
    articleData.published_at = new Date().toISOString();
}
```

Data publicării se rescrie la **fiecare** salvare a unui articol publicat, nu doar la
prima. Reeditarea lui E3 aseară i-a pus data de aseară, cu cinci minute după E4, deci
în `/news.html` și în secțiunea News de pe homepage serialul apare în ordine greșită.

### ⚠️ ORDINEA REPARAȚIILOR CONTEAZĂ

Dacă repari teaserul, E3 sare **din nou** deasupra, fiindcă îl salvezi iar.

```
1. repari teaserul din E3 și salvezi        (E3 urcă în capul listei)
2. deschizi E4, nu schimbi nimic, Salvează   (E4 urcă deasupra lui E3)
3. verifici ordinea pe /news.html
```

Pasul 2 e o salvare goală, doar ca să-i actualizeze data. Nu atinge titlul și nu atinge
slug-ul (butonul „↻ Auto" regenerează slug-ul din titlu, vezi mai jos).

---

## Trimiterea, după reparații

Newsletterul **nu pleacă din platformă**. `admin-newsletter.html` doar arată abonații și
exportă un CSV. Trimiterea se face din **dashboard-ul Resend → Broadcasts**, decizie luată
la construirea newsletterului: nu s-a făcut editor de campanii (`handoff/HANDOFF-newsletter.md`).

1. Deschizi `email_templates/newsletter-episod-4-spatii-comune.html` și copiezi tot HTML-ul.
   **Linkul pozei e deja completat**, nu mai e nimic de înlocuit.
2. Resend → Broadcasts → duplici broadcast-ul de la episodul 3 sau faci unul nou.
3. Expeditor: `ApartamenTUal <apartamentual@ltfbstudio.ro>`
4. Subiect: `Episodul 4: cum am ajuns la spații comune fără să le căutăm`
   (varianta scrisă aseară, `Episodul 4: spațiile comune pe care nu le doream`, a fost
   înlocuită odată cu titlul)
5. Preheader: `La început nu voia nimeni un spațiu comun. Au apărut din două probleme pe care trebuia oricum să le rezolvăm.`
6. Dezabonarea e automată, prin `List-Unsubscribe`. Șablonul are deja
   `{{{RESEND_UNSUBSCRIBE_URL}}}` în subsol, nu-l scoate.

**Înainte de Send:** deschide
`https://apartamentual.ro/news.html#judetului-housing-episodul-4-spatiile-comune`
și vezi că se deschide chiar episodul 4. Slug-ul e verificat în bază, dar un email plecat
cu link greșit nu se mai repară.

**Verifică liniuța lungă** în orice text scris de tine în Resend. Regula permanentă din
CLAUDE.md. Șablonul din repo e curat, l-am scanat.

### Cine primește

Din 44 de abonați, **31 sunt confirmați** și doar ei primesc.
8 sunt `pending`, n-au apăsat niciodată linkul de confirmare. 5 sunt `unsubscribed`.

**Cei 5 dezabonați sunt toți adrese de test ale lui Lucian**, `luta.lucian.m+test01`
până la `+test05@gmail.com`, plecate pe 3 și 13 iulie. **Niciun abonat real nu s-a
dezabonat vreodată.**

---

## Fișierele episodului 4

```
continut/SERIALUL JUDETULUI/E4_SPATII COMUNE/
  Spatiile comune.docx                    sursa scrisă de Lucian
  curte-randare-etichetata.jpg            1920×1080, 559 KB, cu etichete
  episod-4-spatii-comune-900px.jpg        900×506, 93 KB  ← asta e urcată
  episod-4-articol.html                   textul pus în câmpul Conținut

email_templates/newsletter-episod-4-spatii-comune.html
```

### Ce s-a schimbat față de Word

- Titlul, adus la tiparul serialului (`Temă: cum…`). Al lui Lucian era „Spațiile comune,
  de la «niciun spațiu comun» la «mai bine unul comun decât deloc»"; a doua ghilimea nu
  apărea nicăieri în text.
- Două subtitluri `<h2>`, ca la E2 și E3: „Terasa de sus" și „Apartamentul cu curte, pe
  care nu l-am făcut".
- Cele două elemente decisive au devenit listă cu buline. `<ul>` și `<li>` sunt stilate
  în `.article-full-content`, verificat pe live.
- Trei paragrafe lungi tăiate în bucăți. Cuvintele sunt ale lui Lucian.
- Teaser la final, fără să numească subiectul lui E5, care nu e hotărât: „ce urmează după
  ce grupul s-a hotărât ce construiește". Când se știe, se schimbă a doua jumătate a frazei.

### Decizii de conținut

- **Fraza despre autorizație a fost scoasă din rezumat**, la cererea lui Lucian. A rămas
  în articol, în secțiunea „Terasa de sus". Am ocolit-o și în emailul de newsletter.
- **Numele lui Dragoș** apare în primul paragraf, cu un citat din profilul lui de pe
  platformă. Semnalat lui Lucian, lăsat de el.

---

## Capcane de ținut minte la orice articol

1. **Slug-ul nu vine din titlu.** În serial, slug-ul e `…episodul-N-temă` și nu seamănă cu
   titlul la niciunul din cele cinci episoade. Se scrie cu mâna, după titlu. Din clipa
   primei taste apăsate în câmpul Slug se ridică `slugManuallyEdited` și generarea automată
   se oprește. **Butonul „↻ Auto" coboară steagul și regenerează**, deci nu-l apăsa.
2. **`published_at` se rescrie la fiecare salvare.** Vezi REPARAȚIA 2. Orice reeditare a
   unui articol vechi îl aduce în capul listei.
3. **Articolele nu cer cPanel.** Stau în Supabase, iar `news.html` și homepage-ul le citesc
   la fiecare încărcare. Salvezi cu status `published` și sunt live pe loc.
4. **Rezumatul apare în două locuri**, cardul din `/news.html` și cardul de pe homepage.
   Nu apare în articolul deschis, nu apare în emailul de newsletter, nu apare în
   preview-ul de share. Dacă îl lași gol, `news.html` taie singur primele 150 de caractere
   din conținut; homepage-ul nu are rezervă și rămâne cu rândul gol.
5. Rezumatul lui E4, așa cum e salvat acum, are **două treceri la rând nou** în el, rămase
   din copierea din chat. HTML-ul le strânge la un spațiu, deci nu se vede nimic. Nu e de
   reparat, e de știut dacă cineva se uită în bază și se miră.
6. **`text de copiat la sf de episod pt newsletter.docx`** din folderul serialului e rămas
   de la E1 și promite „Episodul 2… autorizația s-a blocat". Nu se folosește. E3 publicat
   nu-l are nici el.

---

## Restul, ce era în lucru înainte

**Pasul 2 din planul de pe 21 august e închis**: pașii din Spațiul tău, commit `b8dad56`,
împins și publicat din cPanel, verificat pe live (consola curată, funcțiile noi prezente,
diacriticele intacte).

**Pasul 3 urmează, ca sesiune nouă și curată**: pagina grupului, reordonare plus cele 11
casete din Word. Atinge `grup-details.html` (176 KB) **și** cardul „Pașii până la recepție"
din `index.html`, în aceeași trecere. Motivul e scris în `NOTES.md`: cele două liste au
**exact aceleași 27 de chei**, scrise de mână în ambele fișiere. Dacă se schimbă doar una,
omul vede patru faze acasă și unsprezece casete în grup, peste aceleași bife.

**Găsit aseară, netratat:** grupul „Investiție Inteligentă – Bloc Boutique Central" are un
en dash (U+2013) în nume, iar numele apare acum în hero-ul fiecărui om care a bifat Zona
Centru Nord. Se repară din admin, e conținut, nu cod.
