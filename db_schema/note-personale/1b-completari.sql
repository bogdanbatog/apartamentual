-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETĂRI la `1-baza.sql` — ce n-a intrat din prima, 17 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE UNDE VINE FIȘIERUL ĂSTA: BLOC 6 din `1-baza.sql` a ieșit cu tabela și
-- RLS-ul în regulă, dar cu două lipsuri și un exces:
--
--   LIPSĂ 1  politica de UPDATE (ieșiseră doar `select` și `insert`).
--            ⚠️ Fără ea, prima salvare a notei ar fi trecut și A DOUA ar fi
--            fost refuzată. Adică defectul s-ar fi văzut abia după publicare,
--            la al doilea om care își editează nota.
--   LIPSĂ 2  triggerul de `updated_at` (secțiunea „e. trigger" lipsea din
--            rezultat, deci BLOC 3 n-a intrat). Fără el, ora „Salvat la ..."
--            ar fi rămas ora primei scrieri, pe veci.
--   EXCES    `authenticated` are pe tabelă și DELETE, TRUNCATE, REFERENCES,
--            TRIGGER. Nu le-am dat noi: sunt drepturile implicite pe care
--            Supabase le pune pe ORICE tabelă nouă, iar `grant select, insert,
--            update` n-avea ce să mai adauge peste ele.
--
-- ⚠️ RULEAZĂ TOT FIȘIERUL DINTR-UN FOC („Run"), nu pe bucăți selectate cu
--    mouse-ul. Exact selecția pe bucăți a tăiat `$$`-ul triggerului prima
--    dată. Fișierul n-are BEGIN/ROLLBACK, deci se poate rula întreg în
--    siguranță, și e scris să poată fi rulat de mai multe ori fără efect.
--
-- ⚠️ ZERO atingeri în afara tabelei `user_notes`. `user_teren_notes` (sora ei,
--    cu notele pe terenuri) NU e atinsă aici, deși are aceleași drepturi în
--    exces pentru `anon` — aia e o treabă separată, trecută în NOTES.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC A — Triggerul care pune ora salvării (LIPSA 2)
-- ───────────────────────────────────────────────────────────────────────────
-- Ora de sub textarea („Salvat la 14:32") trebuie să fie ora la care baza a
-- primit textul, nu ora ceasului din calculatorul omului. Triggerul suprascrie
-- orice valoare venită de la client, deci pagina nici nu trimite coloana.

create or replace function public.user_notes_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_user_notes_touch on public.user_notes;

create trigger trg_user_notes_touch
    before insert or update on public.user_notes
    for each row execute function public.user_notes_touch();


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC B — Politica de UPDATE (LIPSA 1)
-- ───────────────────────────────────────────────────────────────────────────
-- `using` = pe care rânduri am voie să pun mâna.
-- `with check` = cum au voie să arate DUPĂ modificare. Fără al doilea, cineva
-- ar putea muta nota lui pe `user_id`-ul altcuiva și i-ar scrie peste ea.

drop policy if exists user_notes_update_own on public.user_notes;
create policy user_notes_update_own on public.user_notes
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC C — Ușile care nu folosesc nimănui (EXCESUL)
-- ───────────────────────────────────────────────────────────────────────────
-- De ce merită scoase, deși azi nu e nimic stricat:
--
--   • DELETE  e oprit oricum de RLS (nu există politică de ștergere), deci
--     revocarea e a doua poartă, nu prima. Golirea notei se face prin UPDATE
--     cu text gol.
--   • TRUNCATE ⚠️ NU E ATINS DE RLS. Politicile lucrează pe rânduri, TRUNCATE
--     lucrează pe toată tabela dintr-o dată și trece pe deasupra lor. Prin
--     PostgREST nu se poate cere (nu există verb pentru asta), deci azi nu e o
--     gaură deschisă. Dar e singurul drept de aici care, dacă ar ajunge
--     vreodată la îndemână, ar șterge notele TUTUROR, nu ale unuia.
--   • REFERENCES și TRIGGER n-au ce căuta la un utilizator logat.
--
-- `revoke` pe drepturi pe care oricum nu le folosește nimeni nu poate rupe
-- nimic în pagini — spre deosebire de revocările de pe `profiles` din august,
-- unde politicile RLS citeau coloanele revocate.

revoke delete, truncate, references, trigger on public.user_notes from authenticated;

-- Repetate din `1-baza.sql`, ca fișierul să poată fi rulat și singur, pe un
-- proiect unde n-a rulat celălalt.
revoke all on public.user_notes from anon;
revoke all on public.user_notes from public;

grant select, insert, update on public.user_notes to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC D — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Aceeași formă ca BLOC 6 din `1-baza.sql`, plus legătura cu contul, care
-- lipsea de acolo.

select 'a. politici'               as sectiune,
       policyname::text            as nume,
       cmd::text                   as detaliu,
       coalesce(qual, with_check, '')::text as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'user_notes'

union all

select 'b. drepturi'               as sectiune,
       grantee::text               as nume,
       privilege_type::text        as detaliu,
       ''                          as detaliu2
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'user_notes'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')

union all

select 'c. trigger'                as sectiune,
       t.tgname::text              as nume,
       'activ'                     as detaliu,
       ''                          as detaliu2
from pg_trigger t
where t.tgrelid = 'public.user_notes'::regclass
  and not t.tgisinternal

union all

select 'd. legatura cu contul'     as sectiune,
       conname::text               as nume,
       'exista'                    as detaliu,
       ''                          as detaliu2
from pg_constraint
where conrelid = 'public.user_notes'::regclass
  and contype = 'f'

order by sectiune, nume, detaliu;

-- ⚠️ AICI NU SE PROBEAZĂ CĂ TRIGGERUL CHIAR FUNCȚIONEAZĂ, doar că există.
--    O probă pe viu ar cere o scriere, iar o scriere de aici ar fi făcută ca
--    `postgres`, deci n-ar spune nimic nici despre RLS. Ambele se dovedesc
--    dintr-un foc în pasul B din `2-proba-impersonare.sql`, pe un cont real:
--    acolo se scrie fără să se trimită `updated_at`, iar dacă în rezultat
--    coloana e completată, triggerul lucrează.

-- AȘTEPTAT:
--   a. TREI politici: insert / select / update, toate pe `(user_id = auth.uid())`
--   b. `authenticated` cu EXACT trei linii: SELECT, INSERT, UPDATE.
--      `anon` să nu apară deloc. `service_role` poate avea de toate, e rolul
--      serverului și oricum ocolește RLS.
--   c. `trg_user_notes_touch`
--   d. `user_notes_user_fk` — sau LIPSĂ, dacă ai sărit BLOC 2 din `1-baza.sql`
--      (era opțional). Spune-mi care din două, ca să știu ce se întâmplă cu
--      nota unui cont șters.
