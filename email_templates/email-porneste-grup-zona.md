# Email: „zonele tale au cerere, dar niciun grup"

⚠️ **Textul care se trimite efectiv este cel din
`scripts/emailuri-zone/trimite-emailuri-zone.js`** (funcția `continut()`). Fișierul de față
e versiunea de citit și de discutat; dacă schimbi ceva aici, schimbă și acolo.

**Sursa datelor:** `db_schema/analiza-zone/5-merge-multizona.sql` — un rând per persoană.
**Lot:** cei care au cel puțin o zonă fără grup cu 9+ oameni (38 de persoane la 27 iulie 2026,
minus „DeathArrow" scos manual = 37).

Câmpuri de merge (numele coloanelor din interogarea 5):

| Câmp | Ce conține | Exemplu |
|---|---|---|
| `{{nume}}` | pseudonimul, cu spațiile tăiate | `Andra` |
| `{{zona_1}}` | zona lui cu cea mai mare cerere | `Tineretului` |
| `{{oameni_1_text}}` | numărul, cu acord corect | `20 de oameni` |
| `{{zone_pentru_email}}` | blocul de 1-3 zone, gata formatat | vezi mai jos |
| `{{total_zone}}` | câte zone fără grup are în total | `5` |

⚠️ **NU folosi `{{prenume}}`** — `first_name` e gol la toți cei 38. Numele vine din `pseudonym`.

---

## Subiect (variante)

1. `{{zona_1}}: {{oameni_1_text}}, niciun grup` → *„Tineretului: 20 de oameni, niciun grup"*
2. ✅ **ALES** — `În {{zona_1}} nu s-a pornit încă niciun grup`
3. `Zonele în care cauți nu au încă niciun grup`

Preheader: `Ești unul dintre ei. Deocamdată nu v-ați întâlnit.`

---

## Corp

Salut, {{nume}},

Când ți-ai făcut contul pe ApartamenTUal ai bifat zonele în care ai vrea să locuiești.
Iată cum arată ele astăzi:

> {{zone_pentru_email}}

*(exemplu de cum se completează:*
> *Tineretului: 20 de oameni*
> *Aviației: 12 oameni*
> *Uranus: 11 oameni)*

*(dacă are mai mult de 3 zone, aici vine în loc rândul:*
> *Și încă 4 zone bifate, tot fără niciun grup.)*

În niciuna dintre ele nu există încă vreun grup.

Așa arată, de fapt, momentul dinaintea unui grup de construcție: câțiva oameni care vor
același lucru, în același loc, dar care nu s-au întâlnit încă. Noi am trecut exact prin
punctul ăsta la Județului Housing, câteva familii care la început nu se cunoșteau între ele.

**Un grup nu începe cu un teren. Începe cu o conversație.**

Când pornești un grup nu semnezi nimic și nu te angajezi la nimic. Deschizi un loc unde
ceilalți care caută în aceeași zonă pot cere să intre, iar tu, ca fondator, aprobi cine
intră. De acolo discutați ce fel de bloc vreți, ce buget aveți și dacă are sens să mergeți
mai departe împreună.

Grupul apare imediat pe platformă, iar ceilalți care caută în {{zona_1}} îl văd și pot cere
să intre. Primești o notificare la fiecare cerere.

👉 **[Pornește un grup](https://apartamentual.ro/grup-nou.html)** (durează vreo două minute)

Dacă preferi să nu-l pornești tu, e în regulă: rămâi cu zonele bifate și te anunțăm în
momentul în care apare un grup în vreuna dintre ele.

Un lucru pe care nu vrem să-l ascundem: drumul e lung. Găsit teren, autorizații, ani, nu
luni, și multe decizii luate împreună. În schimb, toți banii tăi rămân în apartamentul tău.

Lucian
ApartamenTUal / LTFB Studio

---

*Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal și ai bifat aceste zone ca zone
de interes. Dacă nu vrei să primești astfel de anunțuri, răspunde la acest email cu „stop"
și nu-ți mai scriem.*

---

## Variantă scurtă pentru cine are o singură zonă

Pentru cei cu `{{total_zone}} = 1`, blocul de listă arată sărăcăcios. Înlocuiește primul
paragraf cu:

> Ți-ai trecut **{{zona_1}}** printre zonele în care ai vrea să locuiești. Nu ești singurul:
> chiar acum sunt **{{oameni_1_text}}** care caută exact acolo. Și nu există încă niciun grup
> pentru zona asta.

Restul emailului rămâne identic.

---

## De verificat înainte de trimitere

- [ ] cifrele să fie re-rulate în ziua trimiterii (se schimbă de la o săptămână la alta)
- [x] CTA-ul: nelogat → modal de login pe aceeași pagină, rămâne pe formular după conectare
- [x] fără procente de economie în text
- [ ] pseudonimele-poreclă („DeathArrow", „Luce", „Stef") — arată ok în „Salut, X,"?
      dacă nu, pentru ele scoatem numele: doar „Salut,"
- [ ] test pe adresa ta înainte de lot
