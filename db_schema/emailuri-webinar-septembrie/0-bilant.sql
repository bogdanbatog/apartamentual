-- =============================================================================
-- 0. BILANȚ  „memento webinar, 3 septembrie 2026" (doar cifre, un singur rând)
-- =============================================================================
-- Se rulează ÎNAINTE de `1-lot-pentru-email.sql`, în ziua trimiterii.
-- Nu modifică nimic, doar SELECT.
--
-- La ce te uiți: dacă „lot_final" e mult mai mare sau mai mic decât te aștepți
-- (campania din 25 august a plecat către un lot construit cu EXACT aceleași
-- filtre), oprește-te și află de ce înainte să exporți CSV-ul.
--
-- ⚠️ Editorul SQL din Supabase arată doar rezultatul ULTIMEI interogări dintr-un
-- script. De aceea totul e o singură interogare, cu coloane, nu cinci SELECT-uri.
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din `1-lot-pentru-email.sql`. Dacă schimbi aici,
    -- schimbi și acolo, altfel cifra la care te-ai uitat nu e lotul care pleacă.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
       OR COALESCE(p.cont_intern, false)    = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',
              'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com',
              'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com',
              'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com',
              'livia.dila@yahoo.com'
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'
       OR LOWER(p.email) LIKE '%@ltfbstudio.ro'
),

dezabonati AS (
    SELECT LOWER(email) AS email
    FROM newsletter_subscribers
    WHERE status = 'unsubscribed'
),

toti AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        (p.user_id IN (SELECT user_id FROM exclusi))            AS e_exclus,
        (u.email_confirmed_at IS NULL)                          AS neconfirmat,
        (LOWER(p.email) IN (SELECT email FROM dezabonati))       AS dezabonat,
        (p.account_type = 'activ')                              AS cont_activ,
        (p.account_status IS NULL OR p.account_status = 'active') AS status_ok
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
),

lot AS (
    SELECT * FROM toti
    WHERE cont_activ AND status_ok AND NOT e_exclus AND NOT neconfirmat AND NOT dezabonat
)

SELECT
    (SELECT COUNT(*) FROM toti)                                   AS profile_in_total,
    (SELECT COUNT(*) FROM toti WHERE e_exclus)                    AS scosi_admin_demo_intern,
    (SELECT COUNT(*) FROM toti WHERE neconfirmat)                 AS scosi_email_neconfirmat,
    (SELECT COUNT(*) FROM toti WHERE dezabonat)                   AS scosi_dezabonati,
    (SELECT COUNT(*) FROM toti WHERE NOT cont_activ OR NOT status_ok) AS scosi_cont_inactiv,
    (SELECT COUNT(*) FROM lot)                                    AS lot_final,
    (SELECT COUNT(*) FROM lot WHERE nume IS NULL)                 AS fara_nume_afisat;
