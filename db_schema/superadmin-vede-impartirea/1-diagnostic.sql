-- ═══════════════════════════════════════════════════════════════════════════
-- CE POLITICI DE CITIRE EXISTĂ PE TABELELE PAGINII DE ÎMPĂRȚIRE
-- STRICT SELECT pe catalog. Nu schimbă nimic. Rulabil oricând.
-- 2 septembrie 2026
--
-- ÎNTREBAREA. Superadminul vrea să vadă împărțirea apartamentelor pe orice
-- teren, al oricărui grup. Azi nu poate: politicile de pe `analiza_teren` &
-- co. cer să fii membru activ sau fondator, iar superadminul nu e membru
-- nicăieri. Rezultatul nu e „acces refuzat”, ci LISTĂ GOALĂ, fără eroare și
-- fără nimic în consolă.
--
-- ⚠️ E A PATRA OARĂ ACELAȘI TIPAR: `grup_checklist_files` (25 iulie),
--    `grup_anunturi` (13 august), butonul de ștergere a anunțurilor. De aceea
--    se citește starea ÎNAINTE de a scrie vreo politică nouă.
--
-- ⚠️ Un singur rezultat: editorul SQL din Supabase arată doar ultima
--    interogare dintr-un tab.
-- ═══════════════════════════════════════════════════════════════════════════

with tabele(nume, la_ce_e) as (values
  ('analiza_teren',          'analiza'),
  ('analiza_varianta',       'analiza'),
  ('analiza_nivel',          'analiza'),
  ('analiza_apartament',     'analiza'),
  ('apartament_suprafata',   'suprafețele mutate de oameni'),
  ('apartament_interes',     'cine s-a înscris pe apartament'),
  ('grup_membru_preferinte', 'preferințele membrilor'),
  ('grup_teren_checklist',   'bifele de pe teren'),
  ('grup_checklist_notes',   'notele pașilor'),
  ('grup_teren_comments',    'jurnalul terenului'),
  ('teren_atasamente',       'documentele'),
  ('grup_membri',            'lista de membri')
)
select
  t.nume                                        as tabela,
  t.la_ce_e                                     as la_ce_e,
  case when c.oid is null              then '⚠️ TABELA NU EXISTĂ'
       when not c.relrowsecurity       then '⚠️ RLS OPRIT'
       else 'RLS pornit' end                    as rls,
  coalesce(p.policyname, '(nicio politică de citire)')      as politica,
  coalesce(p.cmd, '')                                        as comanda,
  coalesce(array_to_string(p.roles, ', '), '')               as roluri,
  -- Cheia întrebării: apare superadminul undeva în condiția politicii?
  case when p.qual ilike '%super%' then '✅ DA' else 'nu' end as vede_superadminul
from tabele t
left join pg_class c
       on c.relname = t.nume
      and c.relnamespace = 'public'::regnamespace
left join pg_policies p
       on p.schemaname = 'public'
      and p.tablename  = t.nume
      and p.cmd in ('SELECT', 'ALL')
order by t.nume, p.policyname nulls first;

-- CUM SE CITEȘTE:
--   • fiecare tabelă cu „nu” pe toate rândurile are nevoie de o politică nouă;
--   • o tabelă care are deja „✅ DA” se lasă în pace, nu i se mai adaugă una;
--   • „⚠️ RLS OPRIT” ar însemna că tabela e deschisă oricui, adică o problemă
--     mai mare decât cea pe care o rezolvăm azi. Spune-mi imediat dacă apare.
--   • „⚠️ TABELA NU EXISTĂ” înseamnă că am scris eu numele greșit aici.
