// Orașe și cartiere/zone disponibile pe platformă
// Numele trebuie să fie IDENTICE cu cele din tabelul `zones` din Supabase
// București: 61 cartiere PUG (zone IDs 101-161)
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
        "Progresul", "Apărătorii Patriei", "IMGB"
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

// Helper: populează un select cu cartiere pe baza orașului selectat
function populateCartierSelect(selectElement, oras, placeholder = "Alege zona / cartierul") {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    if (!oras) return;
    
    const cartiereSortate = getCartiere(oras).slice().sort((a, b) => 
        a.localeCompare(b, 'ro', { sensitivity: 'base' })
    );
    
    cartiereSortate.forEach(cartier => {
        const option = document.createElement('option');
        option.value = cartier;
        option.textContent = cartier;
        selectElement.appendChild(option);
    });
}
