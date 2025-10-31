// Shared terrain card renderer
// Exposes global createTerrainCard(teren)

(function () {
    const statusMapping = {
        'active': { text: 'Disponibil', class: 'bg-green-100 text-green-800' },
        'under_review': { text: 'În analiză', class: 'bg-yellow-100 text-yellow-800' },
        'reserved': { text: 'Rezervat', class: 'bg-blue-100 text-blue-800' },
        'sold': { text: 'Vândut', class: 'bg-gray-100 text-gray-800' },
        'inactive': { text: 'Inactiv', class: 'bg-red-100 text-red-800' }
    };

    // Analysis badges removed from card UI

    function createTerrainCard(teren) {
        const status = statusMapping[teren.status] || { text: teren.status, class: 'bg-gray-100 text-gray-800' };
        // Analysis badges removed from card UI

        const apartamenteRange = teren.nr_apartamente_min && teren.nr_apartamente_max
            ? `${teren.nr_apartamente_min}-${teren.nr_apartamente_max}`
            : 'N/A';

        const isDisabled = teren.deleted_at !== null;
        const imageUrl = teren.image_url || null;
        const imageOpacity = isDisabled ? 'opacity-50' : '';
        const imageSection = imageUrl ?
            `<div class="mb-3">
                <img src="${imageUrl}" alt="${teren.titlu}" class="w-full h-32 object-cover rounded-lg ${imageOpacity}" onerror="this.style.display='none';">
            </div>` : '';

        const cardClass = isDisabled ? 'card card-disabled' : 'card';
        const contentOpacity = isDisabled ? 'opacity-75' : '';
        const disabledLabel = isDisabled ?
            `<div class="mb-3">
                <span class="badge bg-red-100 text-red-800">Dezactivat</span>
            </div>` : '';

        return `
            <div class="${cardClass}">
                ${disabledLabel}
                ${imageSection}
                <div class="flex justify-between items-start mb-3 ${contentOpacity}">
                    <h3 class="text-lg">${teren.titlu || 'Teren fără titlu'}</h3>
                    <span class="badge ${status.class}">${status.text}</span>
                </div>
                <p class="subtitle mb-4 ${contentOpacity}">${teren.descriere || 'Fără descriere disponibilă'}</p>
                <div class="grid grid-cols-2 gap-2 text-sm mb-4 ${contentOpacity}">
                    <div><strong>Suprafață:</strong> ${teren.suprafata ? teren.suprafata + ' mp' : 'N/A'}</div>
                    <div><strong>Zonă:</strong> ${teren.zona || 'N/A'}</div>
                    <div><strong>Preț:</strong> ${teren.pret_pe_mp ? teren.pret_pe_mp + ' €/mp' : 'N/A'}</div>
                    <div><strong>Apartamente:</strong> ${apartamenteRange}</div>
                </div>
                
                <div class="mt-4 ${contentOpacity}">
                    <a href="/teren-details.html?id=${teren.id}" class="text-blue-600 hover:underline">Vezi detalii →</a>
                </div>
            </div>
        `;
    }

    window.createTerrainCard = createTerrainCard;
})();


