-- Migrare 030 — adaugă numărul cadastral la comenzile de analiză preliminară
--
-- CONTEXT / DE CE:
--   Formularul de comandă (comanda-analiza.html) cere clientului numărul
--   cadastral al terenului — este câmp OBLIGATORIU și e singurul lucru care
--   identifică exact terenul de analizat. Din greșeală, edge function-ul
--   `creeaza-proforma-oblio` nu salva această valoare, deci numărul cadastral
--   se pierdea complet (nu ajungea nici în DB, nici în notificarea către admin).
--
--   Această migrare adaugă coloana lipsă. După rularea ei, versiunile noi ale
--   edge functions vor scrie numărul cadastral la fiecare comandă nouă.
--
-- SIGURANȚĂ:
--   - `IF NOT EXISTS` => scriptul e idempotent; îl poți rula de mai multe ori
--     fără efecte secundare.
--   - Coloana e nullable (fără NOT NULL), ca să nu blocheze eventualele comenzi
--     vechi care nu au această valoare. Comenzile noi o vor avea mereu completată
--     (validare atât în frontend cât și în backend).
--   - Nu atinge date existente, nu schimbă RLS, nu afectează fluxul de plată.

ALTER TABLE public.comenzi_analize
  ADD COLUMN IF NOT EXISTS nr_cadastral text;

COMMENT ON COLUMN public.comenzi_analize.nr_cadastral
  IS 'Numărul cadastral al terenului de analizat, completat obligatoriu de client în formularul de comandă.';
