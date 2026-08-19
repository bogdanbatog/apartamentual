-- ═══════════════════════════════════════════════════════════════════════════
-- MUTAREA NOTIȚELOR VECHI DIN `profiles.notes` ÎN `user_notes`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE: pagina de profil (`profile-view-new.html`) avea o secțiune „Notițele
-- mele" care scria în coloana `profiles.notes`. Secțiunea a fost scoasă din
-- pagină pe 19 august 2026, fiindcă acum carnetul personal e pe homepage-ul
-- logat. Homepage-ul scrie însă în ALTĂ parte: tabela `user_notes`.
--
-- ⚠️ Deci textele scrise vreodată în profil NU se văd pe homepage. Nu s-a
--    pierdut nimic, coloana `profiles.notes` e neatinsă în bază, dar omul nu
--    mai are de unde ajunge la ea. Scriptul ăsta le mută.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un ROLLBACK pus „doar de probă"
--    anulează tăcut și ce e deasupra lui.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND. BLOC 0 doar se citește. Dacă întoarce zero
--    rânduri, nu are nimeni notițe vechi și BLOC 1 și 2 nu mai sunt necesare.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CE E DE MUTAT (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Coloana are trei feluri de rânduri: gol (NULL sau doar spații), text scris de
-- om, și text scris de om care ARE DEJA o notă pe homepage. Ultimul caz e
-- singurul delicat: acolo nu se suprascrie nimic, se lipește la sfârșit.
--
-- ⚠️ Interogările sunt unite cu UNION ALL dinadins: editorul SQL din Supabase
--    arată DOAR rezultatul ultimei interogări dintr-un tab.

select 'a. are notita in profil'          as sectiune,
       p.user_id::text                    as cine,
       char_length(p.notes)::text         as lungime,
       case when n.user_id is null then 'nu are nota pe homepage'
            when coalesce(n.content, '') = '' then 'are rand gol pe homepage'
            else 'ARE DEJA text pe homepage'
       end                                as situatie
from public.profiles p
left join public.user_notes n on n.user_id = p.user_id
where coalesce(btrim(p.notes), '') <> ''

union all

select 'b. total de mutat'                as sectiune,
       count(*)::text                     as cine,
       ''                                 as lungime,
       ''                                 as situatie
from public.profiles p
where coalesce(btrim(p.notes), '') <> '';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — MUTAREA propriu-zisă
-- ───────────────────────────────────────────────────────────────────────────
-- Regula: nu se pierde niciun caracter.
--   - cine n-are rând în `user_notes` → primește notița din profil ca atare
--   - cine are rândul gol             → primește notița din profil
--   - cine are deja text scris        → notița veche se lipește DEDESUBT, sub
--                                       un rând de despărțire, ca să vadă de
--                                       unde a venit
--
-- ⚠️ `updated_at` nu se trimite: îl pune triggerul din `1-baza.sql`, ca ora să
--    fie a serverului.
-- ⚠️ Plafonul de 10000 de caractere din `user_notes` e verificat de bază. Dacă
--    lipirea îl depășește, rândul acela crapă și scriptul se oprește — atunci
--    spune-mi, îl rezolvăm pe cazul acela, nu tăiem text automat.

insert into public.user_notes as n (user_id, content)
select p.user_id, btrim(p.notes)
from public.profiles p
where coalesce(btrim(p.notes), '') <> ''
on conflict (user_id) do update
set content = case
        when coalesce(btrim(n.content), '') = '' then excluded.content
        else n.content || E'\n\n--- notite mutate din profil ---\n' || excluded.content
    end;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — PROBA (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Fiecare om care avea notiță în profil trebuie să aibă acum text pe homepage.
-- Dacă întoarce vreun rând, mutarea nu s-a făcut complet.

select p.user_id::text                    as cine,
       char_length(p.notes)::text         as avea_in_profil,
       coalesce(char_length(n.content), 0)::text as are_pe_homepage
from public.profiles p
left join public.user_notes n on n.user_id = p.user_id
where coalesce(btrim(p.notes), '') <> ''
  and coalesce(btrim(n.content), '') = '';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — GOLIREA COLOANEI VECHI (OPȚIONAL, doar după ce BLOC 2 e curat)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Nu e obligatoriu. Coloana nu mai e citită de nicio pagină după 19 august
--    2026, deci poate rămâne acolo ca plasă de siguranță. Golește-o doar dacă
--    vrei să nu rămână text personal dublat în două locuri.
-- ⚠️ Nu rula blocul ăsta în aceeași zi cu mutarea. Lasă câteva zile, ca să ai
--    de unde recupera dacă apare ceva neașteptat.
--
-- update public.profiles
-- set notes = null
-- where coalesce(btrim(notes), '') <> '';
