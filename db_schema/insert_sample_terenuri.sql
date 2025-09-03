-- Insert sample terenuri data based on the hardcoded content in terenuri.html
-- Note: You'll need to replace the created_by_user_id values with actual user UUIDs from your auth.users table

INSERT INTO terenuri (
    created_by_user_id,
    titlu,
    descriere,
    zona,
    suprafata,
    pret_pe_mp,
    nr_apartamente_min,
    nr_apartamente_max,
    analiza_generala_status,
    analiza_generala_text,
    analiza_specifica_status,
    analiza_specifica_text,
    status
) VALUES 
-- Teren 1: București – Sector 2 (Available)
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'Teren București – Sector 2',
    'Teren de 2000 mp în zona Colentina, aproape de transport public. Acces la toate utilitățile. Zonare rezidențială compatibilă cu dezvoltarea de apartamente. Teren plan, fără restricții suplimentare.',
    'Sector 2',
    2000,
    150.00,
    8,
    12,
    'completed',
    'Analiza generală confirmă potențialul pentru dezvoltare rezidențială. Zonare compatibilă (Tr), coeficient de utilizare teritoriu 60%, regim de înălțime D+P+4E. Acces la toate utilitățile: electricitate, gaz metan, apă, canalizare. Transport public: stația de autobuz la 200m, metrou Colentina la 800m.',
    'in_progress',
    'Analiza specifică în curs de desfășurare. Studiu topografic finalizat, studiu geotehnic programat pentru luna următoare. Verificare compatibilitate cu PUZ în curs.',
    'active'
),

-- Teren 2: Cluj – Zona Sopor (În analiză)  
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'Teren Cluj – Zona Sopor',
    'Teren de 1500 mp în zona Sopor, cu acces la utilități. Zonă liniștită, aproape de pădurea Hoia. Potențial mare pentru dezvoltare sustenabilă cu vedere spre natură.',
    'Sopor',
    1500,
    120.00,
    6,
    8,
    'pending',
    NULL,
    'pending', 
    NULL,
    'under_review'
),

-- Teren 3: Timișoara – Zona Giroc (Aprobat)
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'Teren Timișoara – Zona Giroc',
    'Teren de 1800 mp în Giroc, cu toate autorizațiile necesare. Zonă în plină dezvoltare, aproape de noul centru comercial și școli. Infrastructura modernă, străzi asfaltate.',
    'Giroc',
    1800,
    100.00,
    8,
    10,
    'completed',
    'Analiza generală completă și favorabilă. Teren situat în zona rezidențială nouă cu infrastructură dezvoltată. PUZ aprobat pentru construcții rezidențiale cu regim D+P+2E. Utilitățile sunt disponibile la limita terenului.',
    'completed',
    'Analiza specifică confirmă fezabilitatea proiectului. Studii geotehnice favorable, sol stabil. Certificat de urbanism obținut. Toate documentele pentru autorizația de construire sunt pregătite. Teren liber de sarcini.',
    'active'
),

-- Teren 4: Iași – Zona Copou (Propunere)
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'Teren Iași – Zona Copou',
    'Teren de 1200 mp în zona Copou, aproape de universitate. Zonă istorică cu charme special, perfectă pentru un proiect de co-housing orientat către comunitatea academică.',
    'Copou',
    1200,
    80.00,
    4,
    6,
    'pending',
    NULL,
    'pending',
    NULL,
    'active'
);

-- Optional: Insert additional terenuri for more variety
INSERT INTO terenuri (
    created_by_user_id,
    titlu,
    descriere,
    zona,
    suprafata,
    pret_pe_mp,
    nr_apartamente_min,
    nr_apartamente_max,
    analiza_generala_status,
    analiza_generala_text,
    analiza_specifica_status,
    status
) VALUES 
-- Teren 5: București – Zona Kiseleff
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06',
    'Teren București – Zona Kiseleff',
    'Teren premium de 1800 mp în zona Kiseleff, cu vedere spre parc. Locație exclusivă pentru un proiect de lux cu accent pe spații verzi și calitatea vieții.',
    'Kiseleff',
    1800,
    220.00,
    6,
    9,
    'in_progress',
    'Analiza preliminară în curs. Zonă foarte atractivă cu potențial ridicat. Verificări în curs pentru compatibilitatea cu reglementările locale de urbanism.',
    'pending',
    'reserved'
),

-- Teren 6: Constanța – Zona Mamaia Nord
(
    '2ca5421c-0258-4773-a719-dfdbf173dd06',
    'Teren Constanța – Mamaia Nord',
    'Teren de 2500 mp în Mamaia Nord, la 500m de mare. Oportunitate unică pentru un proiect seasonal sau de vacanță pentru grupuri de construcție.',
    'Mamaia Nord',
    2500,
    95.00,
    10,
    15,
    'completed',
    'Analiza confirmă potențialul pentru dezvoltare. Zonă turistică cu cerere crescândă. Acces la utilități disponibil, aprobare de principiu pentru dezvoltare rezidențială.',
    'pending',
    'active'
);

-- Show inserted data for verification
SELECT 
    titlu,
    zona,
    suprafata,
    pret_pe_mp,
    nr_apartamente_min || '-' || nr_apartamente_max as apartamente,
    analiza_generala_status,
    analiza_specifica_status,
    status,
    data_adaugat
FROM terenuri 
ORDER BY data_adaugat DESC;