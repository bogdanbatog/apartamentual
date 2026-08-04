-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST ZILNIC DE ANUNȚURI — verificarea bazei, într-o singură interogare
-- ═══════════════════════════════════════════════════════════════════════════
--
-- De ce există fișierul ăsta separat: editorul SQL din Supabase afișează DOAR
-- rezultatul ULTIMEI interogări dintr-un script. Blocul 5 din `1-baza.sql` are
-- patru interogări, deci s-ar vedea una singură, iar celelalte trei ar trece
-- neobservate. Aici totul e un singur `union all`, cu o coloană „verificare".
--
-- Nu schimbă nimic. Se rulează DUPĂ `1-baza.sql`.
--
-- CE TREBUIE SĂ VEZI: coloana `rezultat` să se potrivească cu `asteptat` pe
-- primele șapte rânduri. Ultimele trei sunt informative (cât material există).

select verificare, rezultat, asteptat
from (

    -- 1. Coloana bifei există pe profiles?
    select 1 as ord,
           'coloana profiles.email_anunturi_grup' as verificare,
           coalesce(
               (select data_type || ' / null:' || is_nullable
                       || ' / implicit:' || coalesce(column_default, '—')
                from information_schema.columns
                where table_schema = 'public'
                  and table_name   = 'profiles'
                  and column_name  = 'email_anunturi_grup'),
               '❌ LIPSEȘTE') as rezultat,
           'boolean / null:NO / implicit:true' as asteptat

    union all

    -- 2. Utilizatorul logat își poate CITI bifa? (altfel pagina de profil
    --    n-are ce afișa în căsuță)
    select 2,
           'authenticated poate citi bifa',
           coalesce((select 'da'
                     from information_schema.column_privileges
                     where table_schema = 'public'
                       and table_name   = 'profiles'
                       and column_name  = 'email_anunturi_grup'
                       and grantee      = 'authenticated'
                       and privilege_type = 'SELECT'
                     limit 1), '❌ NU'),
           'da'

    union all

    -- 3. …și și-o poate SCHIMBA? Fără asta, bifa se salvează „cu succes" în
    --    aparență și nu se schimbă nimic (vezi memoria despre lista explicită
    --    de coloane cu UPDATE de pe profiles).
    select 3,
           'authenticated poate scrie bifa',
           coalesce((select 'da'
                     from information_schema.column_privileges
                     where table_schema = 'public'
                       and table_name   = 'profiles'
                       and column_name  = 'email_anunturi_grup'
                       and grantee      = 'authenticated'
                       and privilege_type = 'UPDATE'
                     limit 1), '❌ NU'),
           'da'

    union all

    -- 4. Tabela-jurnal a trimiterilor există?
    select 4,
           'tabela grup_anunturi_digest_log',
           coalesce((select 'există'
                     from information_schema.tables
                     where table_schema = 'public'
                       and table_name   = 'grup_anunturi_digest_log'), '❌ LIPSEȘTE'),
           'există'

    union all

    -- 5. RLS pornit pe jurnal?
    select 5,
           'RLS pornit pe jurnal',
           coalesce((select case when relrowsecurity then 'da' else '❌ NU' end
                     from pg_class
                     where relname = 'grup_anunturi_digest_log'
                       and relnamespace = 'public'::regnamespace), '❌ tabela lipsește'),
           'da'

    union all

    -- 6. Zero politici pe jurnal — intenționat: service_role ocolește RLS,
    --    restul nu văd nimic. Cel mai sigur tip de politică e cel care nu există.
    select 6,
           'politici pe jurnal (trebuie 0)',
           (select count(*)::text
            from pg_policies
            where schemaname = 'public'
              and tablename  = 'grup_anunturi_digest_log'),
           '0'

    union all

    -- 7. Nici drepturi de tabelă pentru anon/authenticated.
    select 7,
           'drepturi anon+authenticated pe jurnal (trebuie 0)',
           (select count(*)::text
            from information_schema.table_privileges
            where table_schema = 'public'
              and table_name   = 'grup_anunturi_digest_log'
              and grantee in ('anon', 'authenticated')),
           '0'

    union all

    -- 8. Câți oameni ar primi digestul, dacă azi ar scrie cineva pe fiecare grup.
    select 8,
           'ℹ️ destinatari posibili (membri activi, necenzurați de bifă)',
           (select count(distinct m.user_id)::text
            from public.grup_membri m
            join public.profiles p on p.user_id = m.user_id
            where m.status = 'activ'
              and coalesce(p.account_status, 'active') <> 'deleted'
              and p.email_anunturi_grup is true
              and coalesce(p.is_demo, false) is false),
           '(informativ)'

    union all

    -- 9-10. Cât material ar avea de trimis un prim digest.
    select 9,
           'ℹ️ anunțuri scrise în ultimele 24h',
           (select count(*)::text
            from public.grup_anunturi
            where created_at >= now() - interval '24 hours'),
           '(informativ)'

    union all

    select 10,
           'ℹ️ grupuri cu anunțuri în ultimele 7 zile',
           (select count(distinct grup_id)::text
            from public.grup_anunturi
            where created_at >= now() - interval '7 days'),
           '(informativ)'

) t
order by ord;
