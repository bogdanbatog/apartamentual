// Orașe și cartiere/zone disponibile pe platformă
// Folosit pentru dropdown-uri pe formulare (terenuri, grupuri, profil)

const ORASE_CARTIERE = {
    "București": [
        "Pădurea Băneasa / Jandarmerie", "Băneasa", "Străulești", "București Noi",
        "Dămăroaia", "Pajura", "Aviatorilor / Aviației", "Primăverii / Dorobanți Nord",
        "Floreasca", "Herăstrău / Nordului", "Pipera", "Voluntari / Ștefăneștii de Jos",
        "Aviatiei Est / Barbu Văcărescu Nord", "Tei / Plumbuita", "Colentina Nord",
        "Fundeni / Dobroești", "Pantelimon", "Baicului / Bucur Obor", "Obor / Ferdinand",
        "Moșilor / Carol", "Dacia / Eminescu / Universitate", "Cotroceni / Politehnica",
        "Drumul Taberei", "Militari", "Crângași / Giulești", "Grozăvești / Regie",
        "Ghencea", "Rahova", "Ferentari / Giurgiului", "Berceni",
        "Titan / Ozana / Nicolae Grigorescu", "Dristor / Mihai Bravu", "Vitan / Dudești",
        "Unirii / Piața Unirii", "Tineretului / Văcărești", "Timpuri Noi / Splaiul Unirii",
        "Dorobanți Sud / Piața Romană", "Calea Victoriei / Centru Vechi",
        "Cișmigiu / Izvor", "13 Septembrie / Panduri", "Apărătorii Patriei / Olteniței",
        "Prelungirea Ghencea", "Bragadiru / Cornetu", "Popești-Leordeni",
        "Chiajna / Roșu / Militari Residence", "Mogoșoaia / Otopeni",
        "Tunari / Dimieni", "Chitila / Rudeni", "1 Decembrie / Măgurele",
        "Iancului / Muncii", "Griviței / Basarab", "Domenii / Casin",
        "Kiseleff / Arcul de Triumf", "Victoriei / Guvern",
        "Ștefan cel Mare / Lizeanu", "Mihai Bravu / Dristor Sud",
        "Trapezului / Brâncoveanu", "Nerva Traian / Văcărești Sud",
        "Titan Sud / Technopolis", "Pallady / Saligny", "Metalurgiei / Nitu Vasile"
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
    
    getCartiere(oras).forEach(cartier => {
        const option = document.createElement('option');
        option.value = cartier;
        option.textContent = cartier;
        selectElement.appendChild(option);
    });
}
