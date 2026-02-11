// ══════════════════════════════════════════════════════════════
// FAQ COMPONENT — ApartamenTUal
// Single source of truth. Include on any page with <div id="faq-container"></div>
// ══════════════════════════════════════════════════════════════

(function() {

const faqItems = [
    {
        question: "Ce este un Baugruppen?",
        answer: "Baugruppen (în germană „grup de construcție") este un model de dezvoltare imobiliară în care un grup de viitori proprietari se unesc pentru a-și construi împreună clădirea, controlând costurile și calitatea. Fiecare membru participă la decizii și își personalizează locuința."
    },
    {
        question: "Cum mă pot alătura unui grup?",
        answer: "După ce îți creezi un cont și completezi profilul cu preferințele tale, poți explora grupurile existente și solicita să te alături celor care îți corespund. Algoritmul nostru îți va sugera și grupuri compatibile bazat pe zona, bugetul și stilul de viață dorit."
    },
    {
        question: "Ce costuri implică participarea?",
        answer: "Utilizarea platformei ApartamenTUal este gratuită. Costurile efective apar doar când grupul decide să avanseze cu un proiect concret: achiziția terenului, proiectare, autorizații și construcție. Acestea sunt împărțite proporțional între membrii grupului."
    },
    {
        question: "Este legal în România?",
        answer: "Da, modelul Baugruppen este perfect legal în România. Grupurile se pot organiza sub diverse forme juridice (asociație, cooperativă, SRL) în funcție de specificul proiectului. Oferim ghiduri și recomandări de specialiști în drept imobiliar pentru fiecare etapă."
    }
];

function renderFAQ() {
    const container = document.getElementById('faq-container');
    if (!container) return;

    container.innerHTML = faqItems.map((item, i) => `
        <div class="faq-item border border-gray-200 rounded-xl overflow-hidden" style="border-color: #e2e8f0;">
            <button class="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors" onclick="toggleFaq(this)" style="cursor:pointer; background:none; border:none; font-family:inherit;">
                <span style="font-weight:600; font-size:16px; color:#0f172a;">${item.question}</span>
                <span class="faq-icon" style="color:#f97316; font-size:22px; transition:transform 0.3s;">+</span>
            </button>
            <div class="faq-content" style="max-height:0; overflow:hidden; transition:max-height 0.3s ease-out; padding:0 24px;">
                <p style="padding-bottom:20px; color:#475569; font-size:14px; line-height:1.7;">${item.answer}</p>
            </div>
        </div>
    `).join('');
}

// Toggle function (global)
window.toggleFaq = function(button) {
    const faqItem = button.parentElement;
    const content = faqItem.querySelector('.faq-content');
    const icon = faqItem.querySelector('.faq-icon');
    const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

    // Close all
    document.querySelectorAll('.faq-content').forEach(c => c.style.maxHeight = '0px');
    document.querySelectorAll('.faq-icon').forEach(i => { i.textContent = '+'; i.style.transform = ''; });

    // Open clicked if was closed
    if (!isOpen) {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '×';
        icon.style.transform = 'rotate(45deg)';
    }
};

document.addEventListener('DOMContentLoaded', renderFAQ);

})();
