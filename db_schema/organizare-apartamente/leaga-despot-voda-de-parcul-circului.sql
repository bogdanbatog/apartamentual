-- ═══════════════════════════════════════════════════════════════════════════
-- LEGAREA TERENULUI „Despot Vodă 30” DE GRUPUL „Parcul Circului”
--
-- DE CE MANUAL. Butonul „Adaugă la favoritele grupului” de pe pagina terenului
-- se arată numai membrilor grupului. Lucian nu e membru în niciun grup, iar
-- steagul de superadmin nu-i deschide butonul acela. Deci rândul se scrie aici.
--
-- CE ATINGE. O singură tabelă, `terenuri_likes_grupuri`, un singur rând.
-- Nu atinge analiza, nu atinge grupul, nu atinge terenul, nu atinge drepturi.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă” anulează
--    tăcut și inserarea de deasupra lui.
--
-- ⚠️ RULEAZĂ BLOC 0 ÎNTÂI ȘI CITEȘTE-L. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0 · VERIFICARE. Nu schimbă nimic.
--
-- Cele patru secțiuni ies într-un singur tabel, prin UNION ALL: editorul SQL
-- din Supabase arată doar rezultatul ULTIMEI interogări dintr-un tab, deci
-- patru SELECT-uri separate ar da o singură tabelă și trei necitite.
-- ═══════════════════════════════════════════════════════════════════════════

select * from (
  select 1 as ord, 'teren' as sectiune,
         t.id::text as id,
         t.titlu as detaliu,
         t.suprafata::text || ' mp' as extra
    from public.terenuri t
   where t.id = '8d320d3e-22b1-4c6c-b4dd-5a7afccc96c0'::uuid

  union all

  select 2, 'grup', g.id::text, g.nume, ''
    from public.grupuri g
   where g.nume ilike '%Parcul Circului%'

  union all

  -- Cine va figura ca autor al adăugării. `auth.uid()` e NULL în SQL Editor
  -- (memoria `functii-sql-verificate-abia-la-rulare`), deci contul se caută
  -- după steagul de superadmin, nu după cine rulează.
  select 3, 'va fi added_by', p.user_id::text,
         coalesce(p.pseudonym, '(fără pseudonim)'),
         'superadmin'
    from public.profiles p
   where coalesce(p.is_super_admin, false) = true

  union all

  -- Ce are grupul deja la favorite. Galvani 57 trebuie să apară aici.
  select 4, 'favorit deja existent', l.teren_id::text,
         coalesce(t.titlu, '⚠️ teren inexistent'),
         case when l.teren_id = '8d320d3e-22b1-4c6c-b4dd-5a7afccc96c0'::uuid
              then '⚠️ DESPOT VODĂ E DEJA LEGAT · ' || l.created_at::date::text
              else l.created_at::date::text end
    from public.terenuri_likes_grupuri l
    left join public.terenuri t on t.id = l.teren_id
   where l.grup_id in (select id from public.grupuri where nume ilike '%Parcul Circului%')
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • exact UN rând „teren”, și titlul lui să fie chiar Despot Vodă 30.
--     Dacă nu iese niciun rând, id-ul din link nu e al unui teren existent
--     și blocul 1 va scrie un rând orfan sau va crăpa pe cheia străină.
--   • exact UN rând „grup”. Dacă ies două, restrânge textul căutat în TOT
--     fișierul; blocul 1 crapă cu „more than one row returned by a subquery”.
--   • la „va fi added_by”: exact UN rând, și să fii TU. Dacă sunt mai multe
--     conturi de superadmin, scrie id-ul de mână în blocul 1, în locul
--     subinterogării, altfel iese aceeași eroare.
--   • la „favorit deja existent”: Luigi Galvani 57. Dacă apare și
--     „⚠️ DESPOT VODĂ E DEJA LEGAT”, nu mai rula blocul 1, e gata.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0b · POSIBIL DUPLICAT. Nu schimbă nimic. RULEAZĂ-L ÎNAINTE DE BLOC 1.
--
-- DE CE. Grupul are deja la favorite „Teren Tei - Ştefan cel Mare 415mp”, iar
-- parcela din analiză are 415,99 mp măsurați. Pe 12 august un candidat numit
-- „Tei / Ştefan cel Mare-Vasile Lascăr 420 mp” s-a dovedit a fi chiar Despot
-- Vodă 30, relistat de altă agenție sub alt cartier, demascat abia de releveu.
-- Acela a fost sărit la postare, dar terenul de aici a intrat la favorite pe
-- 3 august, adică ÎNAINTE de verificarea aceea.
--
-- Dacă e același teren fizic, grupul l-ar avea de două ori la favorite, sub
-- două nume, iar analiza ar sta pe unul dintre ele. Nu strică nimic în bază,
-- dar oamenii ar compara două fișe ale aceleiași parcele fără să știe.
--
-- Se citește cu ochiul: linkul sursă, prețul și prima parte a descrierii.
-- ═══════════════════════════════════════════════════════════════════════════

select t.titlu,
       t.zona,
       t.suprafata,
       t.pret_total,
       t.pret_pe_mp,
       t.link_sursa,
       left(coalesce(t.descriere, ''), 220) as inceput_descriere
  from public.terenuri t
 where t.id in (
         '8d320d3e-22b1-4c6c-b4dd-5a7afccc96c0'::uuid,  -- Despot Voda 30 - 420mp
         '42c7fb78-ef41-4c8a-be21-ce009d69024a'::uuid,  -- Teren Tei - Stefan cel Mare 415mp
         'daaf5f71-1136-47f2-91ff-149522a3a542'::uuid   -- Teren Tei - Barbu Vacarescu / Opanez 412mp
       )
 order by t.suprafata;

-- CE CAUȚI: aceeași stradă, același preț, sau două linkuri către același
-- anunț. Dacă cele două chiar sunt aceeași parcelă, spune-mi înainte de
-- BLOC 1: analiza se leagă atunci de un singur teren, iar celălalt se scoate
-- de la favorite.
--
-- ⚠️ Coloana de preț se cheamă `pret_total`, NU `pret`. Scris greșit prima
-- oară, pe 7 septembrie, și interogarea a crăpat cu „42703: column t.pret
-- does not exist”. Numele bune, citite din frontend: `pret_total`,
-- `pret_pe_mp`, `link_sursa`, `descriere`, `suprafata`, `zona`.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · LEGAREA. Scrie un rând.
--
-- `where not exists` face blocul rulabil de două ori fără să dubleze: a doua
-- oară scrie „INSERT 0 0” în loc să adauge un al doilea rând identic.
--
-- ⚠️ ID-URILE SUNT SCRISE DE MÂNĂ, din rezultatul BLOC 0 rulat pe 7 septembrie.
-- Subinterogările de dinainte ar fi crăpat: sunt DOUĂ conturi de superadmin,
-- `apartamenTUal` (5d0d6e30) și `Fabian` (61a1fa02). Ales primul, contul lui
-- Lucian; al doilea e al lui Liviu Fabian.
--
-- Despre `added_by`: pe platformă coloana asta nu se afișează nicăieri ca
-- nume. Singura ei treabă e în fluxul de noutăți de pe homepage, unde
-- `catePeGrup` sare peste rândurile scrise chiar de cel care se uită
-- (`index.html:5315`). Deci, trecut pe contul lui Lucian, terenul le apare
-- membrilor grupului ca noutate, ceea ce e exact ce vrem.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.terenuri_likes_grupuri (teren_id, grup_id, added_by)
select
  '8d320d3e-22b1-4c6c-b4dd-5a7afccc96c0'::uuid,
  '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid,
  '5d0d6e30-26d7-4f1e-a959-04bb54d58959'::uuid
where not exists (
  select 1 from public.terenuri_likes_grupuri
   where teren_id = '8d320d3e-22b1-4c6c-b4dd-5a7afccc96c0'::uuid
     and grup_id  = '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid
);

-- Trebuie să scrie „INSERT 0 1”.
-- „INSERT 0 0” înseamnă că legătura exista deja. Nu e o pagubă.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VERIFICARE FINALĂ. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════

select t.titlu       as teren,
       g.nume        as grup,
       coalesce(p.pseudonym, '(fără pseudonim)') as adaugat_de,
       l.created_at
  from public.terenuri_likes_grupuri l
  join public.terenuri t on t.id = l.teren_id
  join public.grupuri  g on g.id = l.grup_id
  left join public.profiles p on p.user_id = l.added_by
 where l.grup_id in (select id from public.grupuri where nume ilike '%Parcul Circului%')
 order by l.created_at;

-- Trebuie să vezi PATRU rânduri. Trei din 3 august, puse de membrii grupului:
-- Luigi Galvani 57, Teren Tei - Barbu Văcărescu / Opanez, Teren Tei - Ştefan
-- cel Mare. Al patrulea, Despot Vodă 30, cu data de azi și „apartamenTUal” la
-- `adaugat_de`. (Comentariul spunea „două rânduri” înainte de a ști ce are
-- grupul la favorite; BLOC 0 a arătat trei, nu unul.)
--
-- Abia acum are rost rulat `import-despot-voda-30.sql`.
