-- ═══════════════════════════════════════════════════════════════════════
-- Cronologia pașilor: de la 27 de bife mărunte la 11 casete
-- 22 august 2026
--
-- CE FACE: mută notele și atașamentele puse pe pașii vechi pe cheia casetei
--          din care face parte pasul acela, ca să nu dispară din pagină.
--
-- CE NU FACE: nu șterge nimic. Bifele vechi din `grup_checklist` rămân în
--             tabelă exact cum sunt, doar că pagina nu le mai citește. Sunt
--             plasa de siguranță dacă ne răzgândim. Bifele NU se convertesc
--             în bife de casetă: „am bifat 2 pași din 6" nu înseamnă „grupul
--             a trecut de casetă", iar decizia asta o iau grupurile, nu noi.
--
-- SE RULEAZĂ: manual, în Supabase SQL Editor, de Lucian.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Înainte: ce există acum ────────────────────────────────────────
-- Rulează întâi asta singură, ca să ai poza de dinainte.
select 'INAINTE note'    as ce, step_key, count(*) as cate
  from grup_checklist_notes group by step_key
union all
select 'INAINTE fisiere', step_key, count(*)
  from grup_checklist_files group by step_key
order by 1, 3 desc;


-- ── 2. Harta pașilor vechi către cele 11 casete ───────────────────────
-- Se folosește de două ori mai jos, o dată pentru note, o dată pentru fișiere.
-- Cheile noi sunt c1...c11, la fel ca în CHECKLIST_BOXES din grup-details.html.
--
--   c1  Comunicarea cu cei din grup
--   c2  Organizarea pe terenuri și apartamente
--   c3  Verificarea terenului
--   c4  Analiza detaliată
--   c5  Contractul de asociere
--   c6  Cumpărați terenul
--   c7  Începeți proiectarea
--   c8  Șantierul
--   c9  Ieșirea din asociere (nu primește nimic, nu era pas)
--   c10 Recepția și apartamentarea
--   c11 Mutarea (pas nou, n-are trecut)

-- ── 3. Mutarea propriu-zisă ───────────────────────────────────────────
-- Rulează blocul întreg, de la `with` până la `;`, pentru fiecare din cele două.

-- 3a. Notele
with harta(vechi, nou) as (values
    ('f1_in_formare','c1'), ('f1_regulament','c1'), ('f1_principii','c1'), ('f1_grup_format','c1'),
    ('f2_identificare','c2'), ('f2_analiza_generala','c2'),
    ('f2_vizite','c3'), ('f2_extras_cf','c3'), ('f2_istoric_notar','c3'),
        ('f2_cert_urbanism','c3'), ('f2_studiu_geo','c3'),
    ('f2_analiza_complexa','c4'),
    ('f2_contract_asociere','c5'),
    ('f2_achizitionare','c6'), ('f2_alte_note','c6'),
    ('f3_echipa','c7'), ('f3_concept','c7'), ('f3_cert_construire','c7'), ('f3_avize','c7'),
        ('f3_proiect_tehnic','c7'), ('f3_dtac','c7'), ('f3_detalii_exec','c7'), ('f3_alte_note','c7'),
    ('f4_oferte','c8'), ('f4_constructor','c8'), ('f4_structura','c8'),
        ('f4_instalatii','c8'), ('f4_finisaje','c8'), ('f4_alte_note','c8'),
    ('f4_receptie','c10')
)
update grup_checklist_notes n
   set step_key = h.nou
  from harta h
 where n.step_key = h.vechi;

-- 3b. Atașamentele
-- Atenție: `storage_path` rămâne neschimbat, cu cheia veche în el. E corect,
-- fișierul chiar acolo stă în storage, iar calea se citește din coloană.
with harta(vechi, nou) as (values
    ('f1_in_formare','c1'), ('f1_regulament','c1'), ('f1_principii','c1'), ('f1_grup_format','c1'),
    ('f2_identificare','c2'), ('f2_analiza_generala','c2'),
    ('f2_vizite','c3'), ('f2_extras_cf','c3'), ('f2_istoric_notar','c3'),
        ('f2_cert_urbanism','c3'), ('f2_studiu_geo','c3'),
    ('f2_analiza_complexa','c4'),
    ('f2_contract_asociere','c5'),
    ('f2_achizitionare','c6'), ('f2_alte_note','c6'),
    ('f3_echipa','c7'), ('f3_concept','c7'), ('f3_cert_construire','c7'), ('f3_avize','c7'),
        ('f3_proiect_tehnic','c7'), ('f3_dtac','c7'), ('f3_detalii_exec','c7'), ('f3_alte_note','c7'),
    ('f4_oferte','c8'), ('f4_constructor','c8'), ('f4_structura','c8'),
        ('f4_instalatii','c8'), ('f4_finisaje','c8'), ('f4_alte_note','c8'),
    ('f4_receptie','c10')
)
update grup_checklist_files f
   set step_key = h.nou
  from harta h
 where f.step_key = h.vechi;


-- ── 4. După: ce a ieșit ───────────────────────────────────────────────
-- Aștept să vezi doar chei de forma c1...c11. Dacă mai apare vreo cheie
-- veche, înseamnă că a rămas un pas nemapat în harta de sus.
select 'DUPA note'    as ce, step_key, count(*) as cate
  from grup_checklist_notes group by step_key
union all
select 'DUPA fisiere', step_key, count(*)
  from grup_checklist_files group by step_key
order by 1, 3 desc;
