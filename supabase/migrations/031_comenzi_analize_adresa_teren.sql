-- Migrare 031 — adaugă adresa exactă a terenului la comenzile de analiză
--
-- CONTEXT / DE CE:
--   La formularul de analiză preliminară, terenul poate fi identificat acum
--   prin CEL PUȚIN unul dintre: numărul cadastral (`nr_cadastral`) SAU adresa
--   exactă a terenului (`adresa_teren`). Dacă clientul nu are numărul cadastral,
--   dă adresa exactă, iar noi îl găsim pe geoportalul ANCPI.
--
--   Această coloană e complet separată de coloanele de adresă de FACTURARE
--   (`adresa`, `oras`, `judet`, `cod_postal`) — acelea sunt pentru factură,
--   `adresa_teren` e locația terenului de analizat.
--
-- SIGURANȚĂ:
--   - `IF NOT EXISTS` => scriptul e idempotent; se poate rula de mai multe ori.
--   - Coloana e nullable: o comandă are fie nr_cadastral, fie adresa_teren,
--     fie ambele (validarea „cel puțin unul" se face în frontend + backend).
--   - Nu atinge date existente, nu schimbă RLS, nu afectează fluxul de plată.

ALTER TABLE public.comenzi_analize
  ADD COLUMN IF NOT EXISTS adresa_teren text;

COMMENT ON COLUMN public.comenzi_analize.adresa_teren
  IS 'Adresa exactă a terenului de analizat (alternativă la nr_cadastral). Separată de adresa de facturare. Cu ea găsim nr. cadastral pe ANCPI.';
