-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE NU RĂSPUNDE `is_super_admin()` DIN BROWSER
-- STRICT SELECT pe catalog. Nu schimbă nimic. 2 septembrie 2026
--
-- CONTEXT. Politicile de citire sunt puse și verificate, dar pagina tot spune
-- „Doar pentru membrii grupului”. Pagina află cine e superadmin chemând
-- `sb.rpc('is_super_admin')`. Nicio altă pagină din platformă n-o cheamă așa:
-- toate citesc coloana `is_super_admin` din `profiles_visible`. Deci prima
-- bănuială e că funcția nu e apelabilă prin PostgREST.
-- ═══════════════════════════════════════════════════════════════════════════

select p.proname                                        as functia,
       pg_get_function_identity_arguments(p.oid)        as argumente,
       pg_get_function_result(p.oid)                    as intoarce,
       p.prosecdef                                      as security_definer,
       coalesce(array_to_string(p.proacl, '  |  '),
                '(implicit: execute pentru toată lumea)') as drepturi_de_executie
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'is_super_admin';

-- CUM SE CITEȘTE:
--   • `argumente` GOL înseamnă că `rpc('is_super_admin')` fără parametri e
--     apelul corect. Dacă scrie ceva acolo (de pildă `uid uuid`), apelul meu
--     e greșit: PostgREST răspunde 404, nu găsește funcția fără argumente.
--   • `drepturi_de_executie` trebuie să conțină `authenticated=X`. Dacă scrie
--     „implicit”, atunci oricine o poate executa și nu asta e cauza.
--   • dacă funcția NU apare deloc în rezultat, ea e în altă schemă decât
--     `public` și PostgREST n-o expune.
