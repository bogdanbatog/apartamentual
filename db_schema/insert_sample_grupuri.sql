-- Insert sample grupuri data based on the hardcoded content in grupuri.html
-- Note: You'll need to replace the owner_user_id values with actual user UUIDs from your profiles table

INSERT INTO grup (
    owner_user_id,
    nume,
    descriere,
    zona,
    nr_apartamente_dorite,
    buget_max_per_apartament,
    data_incepere_proiect,
    data_finalizare_proiect,
    status,
    is_public,
    max_members,
    created_at
) VALUES 
-- Grup 1: București Central (În formare)
(
    '01b1acd7-0079-4633-a3b7-28e653e37bc4', -- Replace with actual user UUID
    'Grup București Central',
    'Căutăm 4 familii pentru un proiect de apartamente sustenabile în centrul capitalei. Accent pe spații comune și eficiență energetică.',
    'București, Sector 1',
    8,
    1500.00,
    '2024-06-01',
    '2026-12-31',
    'active',
    true,
    8,
    '2024-01-15 10:00:00+00'
),

-- Grup 2: Cluj Verde (Opțiune teren)
(
    '01b1acd7-0079-4633-a3b7-28e653e37bc4', -- Replace with actual user UUID
    'Grup Cluj Verde',
    'Grup complet cu opțiune pe un teren de 3000mp. Proiect de case pasive cu grădină comunitară și spații comune.',
    'Cluj, zona Florești',
    6,
    1000.00,
    '2024-03-01',
    '2026-06-30',
    'active',
    true,
    6,
    '2023-12-03 14:30:00+00'
),

-- Grup 3: Timișoara Seniors (Proiectare)
(
    '01b1acd7-0079-4633-a3b7-28e653e37bc4', -- Replace with actual user UUID
    'Grup Timișoara Seniors',
    'Grup pentru persoane 55+ cu focus pe design accesibil și servicii de proximitate. În faza de proiectare.',
    'Timișoara',
    8,
    1100.00,
    '2024-09-01',
    '2027-03-31',
    'active',
    true,
    8,
    '2023-10-20 09:15:00+00'
),

-- Grup 4: Iași Students (În formare)
(
    '01b1acd7-0079-4633-a3b7-28e653e37bc4', -- Replace with actual user UUID
    'Grup Iași Students',
    'Căutăm tineri profesioniști (25-35 ani) pentru un proiect modern cu spații de co-working și tech amenities.',
    'Iași, zona Copou',
    6,
    900.00,
    '2024-08-01',
    '2026-10-31',
    'active',
    true,
    6,
    '2024-02-08 16:45:00+00'
);

-- Insert group memberships for the owners (placeholder memberships)
-- Note: These will need to be updated with actual user UUIDs and proper membership data
INSERT INTO grup_membership (
    grup_id,
    user_id,
    status,
    role,
    joined_at,
    approved_at
) VALUES 
-- Owner memberships for each group
(
    (SELECT id FROM grup WHERE nume = 'Grup București Central'),
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'approved',
    'admin',
    '2024-01-15 10:00:00+00',
    '2024-01-15 10:00:00+00'
),
(
    (SELECT id FROM grup WHERE nume = 'Grup Cluj Verde'),
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'approved',
    'admin',
    '2023-12-03 14:30:00+00',
    '2023-12-03 14:30:00+00'
),
(
    (SELECT id FROM grup WHERE nume = 'Grup Timișoara Seniors'),
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'approved',
    'admin',
    '2023-10-20 09:15:00+00',
    '2023-10-20 09:15:00+00'
),
(
    (SELECT id FROM grup WHERE nume = 'Grup Iași Students'),
    '2ca5421c-0258-4773-a719-dfdbf173dd06', -- Replace with actual user UUID
    'approved',
    'admin',
    '2024-02-08 16:45:00+00',
    '2024-02-08 16:45:00+00'
);

-- Show inserted data for verification
SELECT 
    g.nume,
    g.zona,
    g.nr_apartamente_dorite,
    g.buget_max_per_apartament,
    g.status,
    g.max_members,
    COUNT(gm.id) as current_members,
    g.created_at
FROM grup g
LEFT JOIN grup_membership gm ON g.id = gm.grup_id AND gm.status = 'approved'
GROUP BY g.id, g.nume, g.zona, g.nr_apartamente_dorite, g.buget_max_per_apartament, g.status, g.max_members, g.created_at
ORDER BY g.created_at DESC;
