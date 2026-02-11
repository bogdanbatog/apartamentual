(function() {

var faqItems = [
    {
        question: "Ce este un Baugruppen?",
        answer: 'Baugruppen (in germana "grup de constructie") este un model de dezvoltare imobiliara in care un grup de viitori proprietari se unesc pentru a-si construi impreuna cladirea, controland costurile si calitatea. Fiecare membru participa la decizii si isi personalizeaza locuinta.'
    },
    {
        question: "Cum ma pot alatura unui grup?",
        answer: "Dupa ce iti creezi un cont si completezi profilul cu preferintele tale, poti explora grupurile existente si solicita sa te alaturi celor care iti corespund. Algoritmul nostru iti va sugera si grupuri compatibile bazat pe zona, bugetul si stilul de viata dorit."
    },
    {
        question: "Ce costuri implica participarea?",
        answer: "Utilizarea platformei ApartamenTUal este gratuita. Costurile efective apar doar cand grupul decide sa avanseze cu un proiect concret: achizitia terenului, proiectare, autorizatii si constructie. Acestea sunt impartite proportional intre membrii grupului."
    },
    {
        question: "Este legal in Romania?",
        answer: "Da, modelul Baugruppen este perfect legal in Romania. Grupurile se pot organiza sub diverse forme juridice (asociatie, cooperativa, SRL) in functie de specificul proiectului. Oferim ghiduri si recomandari de specialisti in drept imobiliar pentru fiecare etapa."
    }
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
