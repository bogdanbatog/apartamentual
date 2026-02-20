(function() {

var faqItems = [
    // === CONCEPT (5) ===
    { question: "Ce este un Baugruppen?", answer: 'Baugruppen (in germana „grup de constructie") este un model de dezvoltare imobiliara in care un grup de viitori proprietari se unesc pentru a-si construi impreuna cladirea cu apartamente, controland costurile si calitatea. Fiecare membru participa la decizii si isi personalizeaza locuinta. Modelul este foarte raspandit in Germania, Austria si Elvetia.' },
    { question: "Cu cat e mai ieftin fata de un apartament de la dezvoltator?", answer: "In functie de proiect, economia poate fi de 15-30% fata de pretul de piata al unui apartament similar, deoarece se elimina marja de profit a dezvoltatorului. Important este faptul ca banii care in mod normal ar fi profitul dezvoltatorului raman in buzunarul membrilor sau pot fi redirectionati catre calitate superioara a materialelor si finisajelor." },
    { question: "Cum se personalizeaza apartamentele?", answer: "Fiecare membru poate alege finisajele, distributia interioara si dotarile propriului apartament, in limitele structurii comune stabilite de grup si arhitect. De exemplu, poti alege configuratia bucatariei, pozitiile geamurilor, pozitionarea peretilor despartitori, dimensiunile si tipurile usilor, tipul de pardoseala si multe altele." },
    { question: "Ce avantaje are fata de cumpararea unui apartament gata facut?", answer: "Pe langa pretul mai accesibil, ai control total asupra calitatii materialelor si finisajelor, poti personaliza complet locuinta, cunosti din start vecinii cu care vei locui, participi la toate deciziile si ai transparenta totala asupra costurilor. Practic, iti construiesti exact locuinta pe care ti-o doresti, nu un apartament standard." },
    { question: "Exista proiecte Baugruppen realizate deja in Romania?", answer: 'Modelul este la inceput in Romania, dar exista deja un proiect pilot care se apropie de finalizare, Judetului Housing, proiect initiat si asistat prin consultanta de ApartamenTUal. Platforma ApartamenTUal a fost creata tocmai pentru a facilita si accelera adoptarea acestui model, oferind instrumentele necesare pentru organizarea grupurilor. Sectiunea „Prototip" de pe platforma prezinta studiul de caz concret al Judetului Housing.' },

    // === PLATFORMA (16) ===
    { question: "Ce este platforma ApartamenTUal?", answer: "ApartamenTUal este o platforma online creata de biroul de arhitectura LTFB Studio care faciliteaza formarea grupurilor de constructie colaborativa in Romania. Platforma ofera instrumente pentru gasirea de parteneri cu interese similare, descoperirea terenurilor disponibile, gestionarea proiectului si accesul la informatii juridice si financiare." },
    { question: "Este ApartamenTUal un dezvoltator imobiliar?", answer: "Nu, ApartamenTUal nu este un dezvoltator imobiliar. Este o platforma digitala creata de biroul de arhitectura LTFB Studio care pune la dispozitie instrumentele necesare pentru ca grupuri de oameni sa se organizeze si sa isi construiasca impreuna locuintele. LTFB Studio ofera consultanta de arhitectura si coordonare de proiect, dar nu dezvolta si nu vinde apartamente. Viitorii proprietari sunt cei care iau toate deciziile si controleaza intregul proces." },
    { question: "Cat costa utilizarea platformei?", answer: 'Crearea contului, completarea profilului, explorarea grupurilor si a terenurilor sunt complet gratuite. Platforma isi propune sa faca accesibil modelul de constructie colaborativa in Romania, oferind instrumentele necesare pentru organizarea grupurilor. Analizele de terenuri, generala si complexa, au costuri expuse pe platforma. De asemenea, consultanta de arhitect este supusa unor costuri in functie de complexitate/durata. Pentru a cere o consultanta de specialitate de la un arhitect sau despre platforma, apasa butonul „Cere consultanta" din dreapta jos.' },
    { question: "Cum ar trebui sa parcurg platforma ApartamenTUal?", answer: "Mai intai poti vizualiza platforma chiar si fara sa ai cont, cu anumite limitari. Dupa ce iti faci un cont de utilizator poti parcurge si filtra lista de terenuri, poti adauga terenurile preferate la profil si cere o analiza generala sa vezi cate apartamente se pot construi acolo, poti vedea grupurile sau alti utilizatori interesati de acele terenuri, te poti alatura acelor grupuri sau poti forma chiar tu un grup. In interiorul grupului poti parcurge checklistul recomandat de LTFB Studio pentru ca intr-un final sa puteti cumpara terenul si sa incepeti proiectarea si constructia." },
    { question: "Cum ma pot alatura unui grup existent?", answer: "Dupa ce iti creezi un cont si completezi profilul cu preferintele tale (zona dorita, buget, numar de camere, interese), poti explora grupurile existente. Daca gasesti un grup care iti corespunde, trimiti o cerere de alaturare. In functie de statusul grupului, esti acceptat direct (grup deschis) sau dupa aprobarea administratorului (grup cu aprobare)." },
    { question: "Pot sa imi creez propriul grup?", answer: "Da, oricine cu un cont pe platforma poate crea un grup nou. Stabilesti numele, descrierea, zona de interes, numarul maxim de membri si statusul (deschis sau cu aprobare). Apoi inviti prieteni sau astepti ca alti utilizatori interesati sa se alature." },
    { question: 'Ce inseamna „Deschis" si „Cu aprobare" la statusul unui grup?', answer: 'Un grup „Deschis" permite oricui sa se alature direct, fara aprobare. Un grup „Cu aprobare" necesita ca administratorul sa accepte fiecare cerere de alaturare — util cand grupul doreste sa selecteze membrii pe baza unor criterii specifice (buget, zona preferata, viziune compatibila).' },
    { question: "Cine este LTFB Studio?", answer: "LTFB Studio este biroul de arhitectura din Bucuresti care a creat si administreaza platforma ApartamenTUal. Echipa ofera atat suportul tehnic al platformei, cat si consultanta de arhitectura si coordonare de proiect pentru grupurile care doresc sa avanseze cu un proiect concret de constructie colaborativa." },
    { question: "Cum functioneaza matching-ul intre utilizatori sau intre utilizatori si grupuri?", answer: "Platforma analizeaza profilul tau — zonele preferate si interesele selectate — si le compara cu cele ale altor utilizatori si grupuri. Pe pagina de utilizatori si de grupuri vei vedea un scor de compatibilitate bazat pe zonele si interesele comune. Cu cat profilul tau este mai complet, cu atat sugestiile sunt mai relevante." },
    { question: "Pot vedea interesele sau zonele preferate ale altor utilizatori sau grupuri?", answer: "Da, profilurile utilizatorilor sunt publice si afiseaza zonele preferate, interesele (tag-urile selectate) si informatiile de baza (profesie, numar de camere dorit). Grupurile afiseaza zona de interes, membrii, statusul si descrierea. Astfel poti evalua compatibilitatea inainte de a solicita alaturarea." },
    { question: "Ce este un administrator al unui grup si ce face?", answer: "Administratorul este membrul care a creat grupul sau care a fost desemnat de grup sa coordoneze activitatea pe platforma. Administratorul poate aproba sau respinge cereri de alaturare, edita detaliile grupului, propune terenuri si gestiona checklistul de etape al proiectului. Orice grup poate avea unul sau mai multi administratori." },
    { question: "Cum pot intra in legatura cu membrii unui grup sau cu un utilizator?", answer: 'Deocamdata, comunicarea directa intre membri se face in afara platformei (WhatsApp, email etc.), dupa ce te-ai alaturat unui grup. Pentru intrebari generale sau consultanta, poti folosi butonul „Cere consultanta" care te pune in legatura cu echipa LTFB Studio. Functionalitatea de mesagerie interna este planificata pentru o versiune viitoare.' },
    { question: "Ce tipuri de conturi exista pe platforma?", answer: "Pe platforma exista doua tipuri de conturi: cont de utilizator activ (persoane care cauta un grup sau vor sa construiasca colaborativ — completeaza preferinte de apartament, zone dorite si interese) si cont de agentie imobiliara (agentii care pot propune terenuri si oferte pentru grupurile de pe platforma). Ambele tipuri pot accesa toate resursele platformei, dar functionalitatile sunt adaptate fiecarui rol." },
    { question: "Pot cere o consultanta daca nu inteleg ceva din platforma?", answer: 'Da, apasa butonul „Cere consultanta" din coltul din dreapta jos al oricarei pagini. Selecteaza categoria „Functionare platforma" si descrie intrebarea ta. Echipa ApartamenTUal va reveni cu un raspuns in cateva ore.' },
    { question: "Pot cere consultanta de specialitate de la un arhitect legat de terenuri sau procesul de construire?", answer: 'Da, prin acelasi buton „Cere consultanta" poti solicita o consultanta de arhitectura. Selecteaza categoria „Consultanta arhitectura" sau „Fezabilitate proiect" si descrie situatia ta. Un arhitect din echipa LTFB Studio te va contacta pentru a discuta detaliile si eventualele costuri implicate.' },
    { question: "Ce pot face dupa ce am intrat intr-un grup?", answer: "Dupa alaturare, poti vedea detaliile complete ale grupului: membrii, checklistul de etape (de la formare pana la constructie), terenurile propuse si documentele asociate. Poti participa la discutii, vota pe propuneri de terenuri si urmari progresul proiectului pe checklistul interactiv." },

    // === JURIDIC & FINANCIAR (6) ===
    { question: "Este legal modelul acesta in Romania?", answer: "Da, modelul este perfect legal. Cel mai frecvent, grupurile se organizeaza prin contract de asociere legalizat sau prin intermediul unui SRL. Platforma ofera ghiduri detaliate si modele de contracte pe pagina dedicata legislatiei." },
    { question: "Ce forme juridice pot folosi?", answer: 'Cele mai comune forme sunt: asocierea printr-un contract de asociere elaborat de avocat si legalizat la notar, SRL-ul (ofera personalitate juridica si structura clara de achizitii) si cooperativa de locuinte (potrivita pentru proiecte mai mari). Fiecare are avantaje si dezavantaje detaliate in sectiunea „Ce este" a platformei.' },
    { question: "Cum se finanteaza un proiect de constructie colaborativa?", answer: "Exista doua variante principale: finantarea din resurse proprii (membrii contribuie in transe pe masura avansarii proiectului) sau finantarea mixta cu credit bancar (fiecare membru contracteaza individual un credit ipotecar). In ambele cazuri, contributiile sunt proportionale cu suprafata apartamentului ales." },
    { question: "Ce se intampla daca un membru vrea sa se retraga?", answer: "Contractul de asociere prevede clar procedura de retragere. De regula, membrul care se retrage isi recupereaza contributiile (minus eventuale penalitati), iar locul sau este preluat de un nou membru aprobat de grup. Cu cat retragerea are loc mai devreme in proiect, cu atat este mai simpla." },
    { question: "Am nevoie de avocat sau notar?", answer: "Da, este recomandat. Contractul de asociere trebuie redactat cu ajutorul unui avocat specializat in drept imobiliar, iar actele de achizitie a terenului si cele legate de constructie necesita forma autentica notariala. Platforma ofera modele orientative, dar fiecare grup ar trebui sa aiba propriul consilier juridic." },
    { question: "Ce garantii am ca banii mei sunt in siguranta?", answer: "Contributiile membrilor sunt gestionate printr-un cont dedicat al societatii (SRL) sau prin reguli clare stabilite in contractul de asociere — plati pe parcursul procesului (in cazul asocierii prin contract de asociere). Toate platile sunt documentate, iar deciziile financiare majore necesita acordul tuturor membrilor. In cazul unor grupuri mai mari sau SRL este recomandat si angajarea unui contabil care sa tina evidenta financiara." },

    // === PROCES PRACTIC (6) ===
    { question: "Cat dureaza un proiect de la formare la mutare?", answer: "In medie, un proiect dureaza intre 2 si 4 ani: formarea grupului si gasirea terenului (4-6 luni), proiectare si autorizare (6-12 luni), constructie (12-18 luni). Durata variaza in functie de complexitatea proiectului, dimensiunea grupului si viteza de luare a deciziilor." },
    { question: "Cati membri are de obicei un grup?", answer: "Un grup tipic are intre 4 si 20 de membri (familii sau persoane individuale). Grupurile mici (4-8) iau decizii mai rapid dar au costuri fixe mai mari per membru. Grupurile mai mari (10-20) beneficiaza de economii de scara dar necesita o organizare mai riguroasa." },
    { question: "Cine coordoneaza proiectul?", answer: "De obicei, grupul angajeaza un birou de arhitectura care coordoneaza intregul proces: de la proiectare la selectia constructorului si supravegherea lucrarilor. Biroul de arhitectura LTFB Studio, creatorul platformei, ofera si servicii de consultanta si coordonare pentru grupurile interesate prin experienta acumulata din prototipul Judetului Housing." },
    { question: "Cum se iau deciziile in grup?", answer: "Deciziile curente se iau prin vot majoritar, iar cele majore (achizitia terenului, alegerea constructorului, instalatii, finisaje, modificari contractuale) necesita de regula unanimitate sau o majoritate calificata. Regulile exacte sunt stabilite in contractul de asociere, inainte de inceperea proiectului." },
    { question: "Ce se intampla daca apar neintelegeri in grup?", answer: "Contractul de asociere prevede o procedura de solutionare a disputelor, de obicei prin mediere urmata de arbitraj. Rolul arhitectului coordonator este si acela de a facilita comunicarea si de a propune solutii tehnice care sa satisfaca toate partile. Grupurile bine organizate, cu reguli clare de la inceput, intampina rar probleme majore." },
    { question: "Trebuie sa am experienta in constructii?", answer: "Nu. Rolul platformei si al echipei de arhitectura este tocmai de a ghida membrii prin fiecare etapa. Arhitectul coordonator se ocupa de aspectele tehnice, iar membrii participa la decizii in functie de preferinte, nu de experienta tehnica. Tot ce ai nevoie este dorinta de a te implica si de a colabora." },

    // === TEREN & CONSTRUCTIE (6) ===
    { question: "Cum gasim un teren potrivit?", answer: "Platforma ofera o sectiune dedicata propunerilor de terenuri, unde membrii pot propune si evalua terenuri disponibile. La evaluarea unui teren se ia in considerare: zona preferata; suprafata (de exemplu Judetului Housing are 6 apartamente de 2-3 camere pe un teren de 460 mp) — pentru grupuri mici (4-5 familii) se recomanda terenuri de minim 500 mp, frontul la strada minim 10-12 m; numarul de calcane vecine pe limita de proprietate (de preferat maxim 1-2 calcane — calcanele pot fi o oportunitate de eficientizare a terenului prin lipirea constructiei noi la ele); forma terenului sa nu fie extrem de neregulata. Se poate cere o analiza generala de pe platforma pentru a vedea ce se poate construi pe un anumit teren — suprafete construite, utile, regim de inaltime, retrageri fata de limitele de proprietate, numar aproximativ de apartamente." },
    { question: "In ce orase functioneaza platforma?", answer: "In prezent, platforma acopera cele mai mari orase din Romania: Bucuresti, Cluj-Napoca, Timisoara, Iasi si Brasov, cu cartierele si zonele lor principale. Lista se extinde pe masura ce comunitatea creste si apar grupuri interesate si in alte orase." },
    { question: "Cine alege constructorul?", answer: "Grupul alege constructorul impreuna, pe baza ofertelor colectate si a recomandarilor arhitectului coordonator. De obicei se solicita minimum 3 oferte de la constructori verificati, iar decizia finala se ia prin vot sau de comun acord in cadrul grupului. Arhitectul poate superviza calitatea lucrarilor pe tot parcursul constructiei." },
    { question: "Ce se intampla dupa finalizarea constructiei?", answer: "La finalizarea constructiei, fiecare membru devine proprietar individual al apartamentului sau, cu intabulare in cartea funciara. In cazul SRL-ului, acesta se dizolva, iar membrii formeaza o asociatie de proprietari pentru administrarea spatiilor comune, ca in orice bloc de locuinte." },
    { question: "Pot participa daca nu sunt din Romania?", answer: "Da, platforma este deschisa oricui doreste sa construiasca in Romania. Multi romani din diaspora sunt interesati de acest model, fie pentru a-si construi o locuinta la care sa se intoarca, fie ca investitie." },
    { question: "Se pot construi si case, nu doar blocuri?", answer: "Da, modelul Baugruppen poate fi aplicat si pentru ansambluri de case (townhouse-uri sau case cuplate). Principiul e acelasi: un grup de oameni cumpara impreuna un teren mai mare si construiesc mai multe locuinte individuale, beneficiind de economii de scara la infrastructura comuna (drum, utilitati, amenajari exterioare)." }
];

function renderFAQ() {
    var container = document.getElementById('faq-container');
    if (!container) return;

    var html = '';
    for (var i = 0; i < faqItems.length; i++) {
        var item = faqItems[i];
        html += '<div class="faq-item" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; margin-bottom:12px;">';
        html += '<button onclick="toggleFaq(this)" style="width:100%; padding:18px 24px; display:flex; align-items:center; justify-content:space-between; text-align:left; cursor:pointer; background:none; border:none; font-family:inherit; transition:background 0.2s;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'none\'">';
        html += '<span style="font-weight:600; font-size:16px; color:#0f172a;">' + item.question + '</span>';
        html += '<span class="faq-icon" style="color:#f97316; font-size:22px; transition:transform 0.3s; flex-shrink:0; margin-left:16px;">+</span>';
        html += '</button>';
        html += '<div class="faq-content" style="max-height:0; overflow:hidden; transition:max-height 0.3s ease-out; padding:0 24px;">';
        html += '<p style="padding-bottom:20px; color:#475569; font-size:14px; line-height:1.7;">' + item.answer + '</p>';
        html += '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

window.toggleFaq = function(button) {
    var faqItem = button.parentElement;
    var content = faqItem.querySelector('.faq-content');
    var icon = faqItem.querySelector('.faq-icon');
    var isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

    var allContents = document.querySelectorAll('.faq-content');
    var allIcons = document.querySelectorAll('.faq-icon');
    for (var j = 0; j < allContents.length; j++) {
        allContents[j].style.maxHeight = '0px';
    }
    for (var k = 0; k < allIcons.length; k++) {
        allIcons[k].textContent = '+';
        allIcons[k].style.transform = '';
    }

    if (!isOpen) {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = String.fromCharCode(215);
        icon.style.transform = 'rotate(45deg)';
    }
};

document.addEventListener('DOMContentLoaded', renderFAQ);

})();
