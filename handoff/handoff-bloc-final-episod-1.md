# Handoff: Bloc final Episodul 1, teaser corectat + link automat spre Episodul 2

## Context

Repo: bogdanbatog/apartamentual. Frontend Vanilla JS/HTML/CSS, hostat pe Render cu auto-deploy la push. Articolele News sunt încărcate din Supabase (project ID: glbvbbgmcobtswwlktic) prin JavaScript.

La finalul articolelor de tip episod există un bloc cu formular de newsletter (implementat într-un handoff anterior). Pe articolul Episodului 1 (titlu: "Acordul vecinilor: cum i-am convins, unul câte unul"), textul de deasupra formularului anunță:

> "Episodul 2 vine în curând: luna în care autorizația s-a blocat și nu mai știam dacă proiectul mai merge înainte."

PROBLEMĂ: Episodul 2 real este "Grupul: cum ne-am găsit (de două ori)", despre formarea grupului, NU despre autorizație. Episodul despre autorizație va fi un episod ulterior. Episodul 2 există deja în admin ca ciornă, cu slug pe tiparul `judetului-housing-episodul-2-...`, și va fi publicat sâmbătă, 18 iulie 2026, în jurul orei 08:00.

OBIECTIV: dintr-un singur deploy, blocul final al Episodului 1 să fie corect în ambele momente:
1. Cât Episodul 2 e ciornă: teaser corectat, despre grup.
2. După publicarea Episodului 2: link direct spre articol, generat automat, fără un al doilea deploy.

## Reguli de limbaj (obligatorii în orice text afișat)

- Fără em-dash (—). Folosește virgulă, două puncte sau paranteze.
- Diacritice românești corecte peste tot.
- "Județului Housing", formă fixă, invariabilă.
- "bloc", nu "mic bloc".
- Interzis "fără dezvoltator" în texte afișate.
- Fără procente de economie, fără cifre de cost.

---

## FAZA 1: AUDIT

1. Localizează blocul final de episod (teaser + formular newsletter): în ce fișier e definit (HTML static, componentă JS, sau conținut per-articol în DB)? Unde anume e textul teaser cu autorizația?
2. Identifică structura articolelor News în Supabase: numele tabelului, câmpurile relevante (slug, titlu, status publicat/ciornă, dată, categorie/serie dacă există).
3. Verifică dacă există deja o logică de "articol următor/anterior" (blocul "← Episodul 0" de pe pagina Episodului 1 sugerează că da). Dacă da, descrie cum funcționează.
4. Confirmă slug-ul exact al ciornei Episodului 2 din DB.

**STOP 1: Raportează constatările și așteaptă confirmarea lui Lucian înainte de a planifica.**

Caz special: dacă textul teaser se dovedește a fi conținut editabil din admin (stocat în DB per articol, nu în cod), NU e nevoie de modificări de cod pentru text. Raportează asta explicit și oprește-te: Lucian îl corectează din admin. Continuă doar cu partea de link automat, dacă Lucian o confirmă.

---

## FAZA 2: PLAN

Propune implementarea pe baza auditului. Comportamentul dorit:

La randarea blocului final pe pagina Episodului 1:
- Interoghează articolele publicate după slug care începe cu `judetului-housing-episodul-2` (sau după câmpul de serie/episod, dacă auditul a găsit unul mai robust).
- **Dacă articolul există și e publicat:** afișează în locul teaser-ului un rând de tip link:
  > "Episodul 2 e aici: [titlul articolului] →"
  cu link spre articol. Formularul de newsletter rămâne dedesubt, neschimbat, cu textul lui existent ("Primește episoadele direct pe email" sau echivalentul actual, adaptat dacă e nevoie, dar fără a-i schimba funcționalitatea sau evenimentul Plausible).
- **Dacă articolul nu există sau e ciornă:** afișează teaser-ul static corectat:
  > "Episodul 2 vine în curând: povestea grupului, cum s-au găsit câteva familii de străini pe o pagină de Facebook și de ce a trebuit să se găsească încă o dată."

Constrângeri:
- Nu modifica logica formularului de newsletter și nici evenimentul Plausible asociat.
- Nu afecta blocul de navigare "← Episodul 0" existent.
- Soluția trebuie să degradeze elegant: dacă interogarea eșuează (eroare de rețea), se afișează teaser-ul static, niciodată un link mort.
- Nu introduce dependențe noi.

**STOP 2: Prezintă planul, fișierele afectate și textele finale. Așteaptă aprobarea lui Lucian.**

---

## FAZA 3: IMPLEMENTARE

Implementează conform planului aprobat. Respectă strict regulile de limbaj de mai sus în orice string afișat.

---

## FAZA 4: TEST

1. Local/preview cu Episodul 2 în status ciornă: blocul afișează teaser-ul corectat (fără autorizație în text).
2. Simulează starea publicată (temporar, într-un mediu care nu atinge producția, sau prin mock): blocul afișează linkul cu titlul corect și URL-ul corect.
3. Verifică pagina Episodului 0 și un articol care nu e episod: blocul nu apare eronat sau nu se strică acolo unde nu trebuie să existe.
4. Verifică fallback-ul de eroare: cu interogarea blocată, se afișează teaser-ul static.
5. Verifică mobil: blocul se așază corect pe ecran îngust.

**STOP 3: Raportează rezultatele testelor. Așteaptă confirmarea lui Lucian.**

---

## FAZA 5: COMMIT

Mesaj de commit propus:

```
fix(serial): corecteaza teaserul episodului 2 in blocul final al episodului 1 si adauga link automat dupa publicare
```

**STOP 4: NU face push fără aprobarea explicită a lui Lucian. Push-ul declanșează auto-deploy pe Render (~2 min), efect live imediat.**

---

## Notă de timing

Ideal, deploy-ul se face vineri seara (17 iulie) sau sâmbătă dimineața devreme, ÎNAINTE de ora 08:00, când se publică Episodul 2 și pornesc postările de social media. Cât Episodul 2 e ciornă, deploy-ul e sigur: se afișează doar teaser-ul corectat.
