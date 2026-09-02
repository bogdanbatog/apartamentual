# Email „memento webinar" — 2 septembrie 2026

Trimis cu o zi înainte de a doua ediție a webinarului (joi, 3 septembrie 2026, 11:30).
Către toți cei cu cont viu pe platformă. Textul e scris de Lucian; sursa de adevăr
pentru ce pleacă efectiv e `scripts/emailuri-webinar-septembrie/trimite-emailuri-webinar-septembrie.js`
(funcția `continut`). Fișierul ăsta e pentru citit și pentru corectat înainte de trimitere.

**Un singur fel de email pentru toată lumea.** Singura diferență e salutul: cine n-are
pseudonim primește „Salut," simplu. Butonul duce la Luma, deci nu contează dacă omul are
profilul terminat, grup sau teren.

---

## Subiect

**Varianta 1 (implicită):** Mâine dimineață, la 11:30: primii pași, explicați live

Variante de rezervă, dacă vrei alt ton:

2. Mâine, 3 septembrie: primii pași în construcția în grup
3. Ai cont pe ApartamenTUal și nu știi ce urmează? Mâine îți explicăm

**Preheader:** A doua ediție a webinarului, online și gratuit. De la formarea grupului
până la teren, asociere și bani.

---

## Corpul emailului

> Salut, [Nume],
>
> Mâine, 3 septembrie, de la 11:30, ținem a doua ediție a webinarului nostru despre
> construcția în grup. E online, durează cam o oră, participarea e gratuită.
>
> Îți scriu și pentru că mulți dintre voi v-ați făcut cont pe platformă și v-ați oprit
> acolo, ceea ce e cât se poate de normal: nu e clar de la început ce urmează. Exact
> despre asta vorbim mâine, primii pași. Chiar dacă nu ești hotărât să mergi pe drumul
> acesta și ești doar curios, îți explicăm:
>
> - cum se formează un grup și cum intri într-unul
> - cum alegi terenul și ce verifici înainte
> - ce formă de asociere folosești și ce se întâmplă dacă cineva se retrage
> - cum se plătește, pe etape, și ce spun băncile
>
> Aducem și ceva nou: i-am întrebat direct pe arhitecții unui proiect din Berlin,
> construit acum zece ani de 24 de familii, cum au rezolvat ei asocierea, cumpărarea
> terenului și finanțarea. Ne-au răspuns în detaliu și povestim mâine ce am aflat.
>
> La prima ediție, partea cea mai bună au fost întrebările voastre. Dacă ai una, poți
> să mi-o trimiți din timp, ca răspuns la acest mail, sau s-o pui live.
>
> **[ Înscrie-te la webinar ]** → https://luma.com/00ig0k40
> *joi, 3 septembrie, ora 11:30, online*
>
> Dacă nu poți fi prezent la ora aceea, înscrie-te oricum: îți trimitem înregistrarea
> după. Iar dacă te-ai înscris deja, ne vedem mâine.
>
> Lucian
> ApartamenTUal / LTFB Studio

**Subsol:** Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal. Îți scriem rar,
doar când se schimbă ceva ce te privește direct. Dacă nu vrei să mai primești astfel de
mesaje, răspunde cu „stop".

---

## Ce s-a schimbat față de ciorna lui Lucian

1. Prima bulină era „cum poți să afli mai multe dacă te alături unui grup", mai vagă decât
   celelalte trei, care sunt concrete. A devenit „cum se formează un grup și cum intri
   într-unul".
2. S-a adăugat „Iar dacă te-ai înscris deja, ne vedem mâine." Lista de înscriși e la Luma,
   nu în baza noastră, deci nu-i putem scoate din lot; o propoziție rezolvă ce filtrul nu
   poate.
3. Linkul Luma, care în ciornă era `[link Luma]`, a devenit buton: `https://luma.com/00ig0k40`.

## De verificat înainte de fiecare trimitere

- **Data și ora.** Joi, 3 septembrie 2026, 11:30. Aceleași trei locuri ca de obicei:
  `frontend/index.html`, constanta `WEBINAR` din `supabase/functions/notify-admins/index.ts`
  și pagina de pe Luma. Un grep prin repo NU acoperă Luma.
- **Linkul Luma.** Fiecare ediție are alt URL. Septembrie 2026 = `00ig0k40`.
- **Fără liniuță lungă** în tot textul citit de om (regula din CLAUDE.md).
- **Fără procente de economie.** Nu sunt și nu se adaugă.
- **„a doua ediție"** e o afirmație despre trecut, nu despre calendar. Cine refolosește
  textul luna viitoare schimbă și cifra.
