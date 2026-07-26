-- ============================================================================
-- 035_notification_log_error.sql
-- ============================================================================
-- CE FACE: adaugÄƒ o coloanÄƒ `error` Ã®n tabelul `notification_log`, Ã®n care
-- edge function-ul `notify-admins` va scrie motivul exact pentru care o
-- notificare nu a plecat.
--
-- DE CE: pe 26.07.2026, la aprobarea a doi membri Ã®n grupul â€žParcul Circului",
-- 18 emailuri au eÈ™uat Ã®ntr-un singur minut. ÃŽn panoul de admin apÄƒreau doar
-- ca â€žEroare", fÄƒrÄƒ niciun indiciu â€” cauza (prea multe cereri simultane cÄƒtre
-- Resend) a trebuit dedusÄƒ din tiparul orelor. Cu aceastÄƒ coloanÄƒ, data
-- viitoare motivul se citeÈ™te direct din tabel.
--
-- RISC: minim. AdaugÄƒ o coloanÄƒ opÈ›ionalÄƒ (NULL implicit) Ã®ntr-un tabel de
-- jurnalizare. Nu atinge date existente, nu schimbÄƒ nicio politicÄƒ RLS, nu
-- afecteazÄƒ plÄƒÈ›ile sau utilizatorii. RÃ¢ndurile vechi rÄƒmÃ¢n cu error = NULL.
--
-- ORDINEA CORECTÄ‚:
--   1. Rulezi ACEST script Ã®n Supabase SQL Editor.
--   2. Abia apoi faci deploy la edge function-ul notify-admins.
-- DacÄƒ inversezi ordinea, funcÈ›ia va Ã®ncerca sÄƒ scrie Ã®ntr-o coloanÄƒ care nu
-- existÄƒ È™i jurnalizarea va eÈ™ua Ã®n tÄƒcere (trimiterea emailurilor merge
-- oricum â€” logarea e best-effort, prinsÄƒ Ã®n try/catch).
-- ============================================================================

-- Coloana propriu-zisÄƒ. IF NOT EXISTS => scriptul se poate rula de douÄƒ ori
-- fÄƒrÄƒ sÄƒ dea eroare.
ALTER TABLE public.notification_log
    ADD COLUMN IF NOT EXISTS error text;

-- DocumentÄƒm coloana direct Ã®n bazÄƒ, ca sÄƒ se Ã®nÈ›eleagÄƒ la ce e peste un an.
COMMENT ON COLUMN public.notification_log.error IS
    'Motivul eÈ™ecului, completat de edge function-ul notify-admins cÃ¢nd status = ''error'' (ex: codul HTTP È™i mesajul Ã®ntors de Resend, plus numÄƒrul de Ã®ncercÄƒri). NULL pentru notificÄƒrile trimise cu succes È™i pentru rÃ¢ndurile de dinainte de iulie 2026.';

-- ============================================================================
-- VERIFICARE (opÈ›ional â€” ruleazÄƒ dupÄƒ, ca sÄƒ confirmi cÄƒ a mers)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'notification_log'
--   AND column_name = 'error';
--
-- Trebuie sÄƒ Ã®ntoarcÄƒ un rÃ¢nd: error | text | YES
-- ============================================================================

