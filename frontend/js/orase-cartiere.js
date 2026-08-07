// Orașe și cartiere/zone disponibile pe platformă
// Numele trebuie să fie IDENTICE cu cele din tabelul `zones` din Supabase
// București: 61 cartiere PUG (zone IDs 101-161) + comune periurbane Ilfov (IDs 162+)
// Cluj-Napoca: 20 zone (IDs 201-220)
// Timișoara: 18 zone (IDs 301-318)
// Iași: 18 zone (IDs 401-418)
// Brașov: 19 zone (IDs 501-519)

const ORASE_CARTIERE = {
    "București": [
        "Pădurea Băneasa / Jandarmerie", "Băneasa", "Străulești", "București Noi",
        "Dămăroaia", "Pajura", "Dămăroaia / Petrom", "Chitila", "Chitila - Triaj",
        "Giulești Sârbi", "Giulești", "Crângași", "1 Mai", "Romexpo",
        "Domenii", "Kiseleff", "Griviţa", "Primăverii / Dorobanți",
        "Cartierul Francez", "Aviației", "Henri Coandă", "Pipera",
        "Floreasca", "Tei", "Ion Creangă / Andronache", "Fundeni",
        "Colentina", "Baicului", "Obor", "Iancului",
        "Vatra Luminoasă", "Pantelimon", "23 August", "Malaxa (1918)",
        "Policolor", "Balta Albă / Titan", "Sălăjan / Trapezului", "Dristor",
        "Vitan", "Unirii / Alba Iulia", "Centrul Vechi", "Zona Centru Nord",
        "Plevnei / Gara de Nord", "Politehnica", "Militari", "Drumul Taberei",
        "Valea Cascadelor", "Ghencea", "Rahova", "Ferentari",
        "Uranus", "Cotroceni", "13 Septembrie / Trafic Greu", "Carol",
        "Tineretului", "Văcărești", "Giurgiului", "Berceni",
        "Progresul", "Apărătorii Patriei", "IMGB",
        // Comune periurbane Ilfov — se adaugă pe măsură ce apar cereri reale.
        // Precedent: Florești/Baciu la Cluj, Dumbrăvița/Giroc la Timișoara.
        "Corbeanca"
    ],
    "Cluj-Napoca": [
        "Centru", "Mărăști", "Gheorgheni", "Mănăștur", "Zorilor", "Grigorescu",
        "Bună Ziua", "Europa", "Borhanci", "Dâmbul Rotund", "Între Lacuri",
        "Plopilor", "Andrei Mureșanu", "Someșeni", "Iris", "Gruia",
        "Becaș / Făget", "Sopor", "Florești", "Baciu"
    ],
    "Timișoara": [
        "Centru", "Iosefin", "Fabric", "Elisabetin", "Complexul Studențesc",
        "Lipovei", "Girocului", "Dâmbovița", "Mehala", "Freidorf",
        "Ghiroda", "Dumbrăvița", "Giroc", "Moșnița Nouă",
        "Soarelui", "Aradului", "Torontalului", "Buziașului"
    ],
    "Iași": [
        "Centru", "Copou", "Tătărași", "Alexandru cel Bun", "Podu Roș",
        "Podu de Fier", "Nicolina", "CUG", "Galata", "Bucium",
        "Dacia", "Pacurari", "Tudor Vladimirescu", "Moara de Vânt",
        "Ciric", "Mircea cel Bătrân", "Metalurgie", "Cantemir"
    ],
    "Brașov": [
        "Centru Vechi", "Blumăna", "Astra", "Tractorul", "Bartolomeu",
        "Noua", "Dârste", "Răcădău", "Stupini", "Poiana Brașov",
        "Schei", "Prund", "Triaj", "Florilor", "Saturn",
        "Craiter", "Ghimbav", "Sânpetru", "Cristian"
    ]
};

// Zone periurbane: comune din jurul orașului, nu cartiere ale lui.
// Se afișează într-un grup separat, la finalul listei, sub numele județului —
// altfel o comună s-ar pierde printre cartiere, unde nimeni n-o caută.
// Rămân în ORASE_CARTIERE de mai sus, fiindcă acolo e lista completă folosită
// la filtrarea utilizatorilor pe oraș (`utilizatori.js`); aici doar le marcăm.
const ZONE_PERIURBANE = {
    "București": { judet: "Ilfov", zone: ["Corbeanca"] }
};

// Helper: returnează lista de orașe
function getOrase() {
    return Object.keys(ORASE_CARTIERE);
}

// Helper: returnează cartierele pentru un oraș
function getCartiere(oras) {
    return ORASE_CARTIERE[oras] || [];
}

// Helper: populează un select cu orașe
function populateOrasSelect(selectElement, placeholder = "Alege orașul") {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    getOrase().forEach(oras => {
        const option = document.createElement('option');
        option.value = oras;
        option.textContent = oras;
        selectElement.appendChild(option);
    });
}

// Helper: împarte zonele unui oraș în grupurile în care se afișează.
// Întoarce o listă de forma:
//   [ { eticheta: null,    zone: [cartierele orașului, alfabetic] },
//     { eticheta: "Ilfov", zone: [comunele din jur, alfabetic]    } ]
// Grupul fără etichetă merge direct în select; celelalte, în <optgroup>.
function getCartiereGrupate(oras) {
    const toate = getCartiere(oras);
    if (toate.length === 0) return [];

    const sorteaza = lista => lista.slice().sort((a, b) =>
        a.localeCompare(b, 'ro', { sensitivity: 'base' })
    );

    const periurbane = ZONE_PERIURBANE[oras];
    const numePeriurbane = periurbane ? periurbane.zone : [];

    const grupuri = [{
        eticheta: null,
        zone: sorteaza(toate.filter(z => !numePeriurbane.includes(z)))
    }];

    const comune = sorteaza(toate.filter(z => numePeriurbane.includes(z)));
    if (comune.length > 0) {
        grupuri.push({ eticheta: periurbane.judet, zone: comune });
    }

    return grupuri;
}

// Helper: adaugă opțiunile de zone într-un <select> deja pregătit.
// NU șterge ce e în select — se apelează după ce s-a pus opțiunea implicită
// („Toate cartierele", „Alege zona"), care diferă de la o pagină la alta.
function appendCartiereOptions(selectElement, oras) {
    getCartiereGrupate(oras).forEach(grup => {
        let tinta = selectElement;

        if (grup.eticheta) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = grup.eticheta;
            selectElement.appendChild(optgroup);
            tinta = optgroup;
        }

        grup.zone.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona;
            option.textContent = zona;
            tinta.appendChild(option);
        });
    });
}

// Helper: populează un select cu cartiere pe baza orașului selectat
function populateCartierSelect(selectElement, oras, placeholder = "Alege zona / cartierul") {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    if (!oras) return;

    appendCartiereOptions(selectElement, oras);
}
