-- Add new profile fields to profiles table
-- This migration adds the requested fields: nume, varsta, profesie, tip_apartament_cauta, zona

-- Add the new columns to the profiles table
ALTER TABLE profiles 
ADD COLUMN varsta INTEGER CHECK (varsta >= 18 AND varsta <= 120),
ADD COLUMN profesie VARCHAR(100),
ADD COLUMN tip_apartament_cauta VARCHAR(50),
ADD COLUMN zona VARCHAR(100);

-- Add indexes for better query performance on the new fields
CREATE INDEX idx_profiles_varsta ON profiles(varsta);
CREATE INDEX idx_profiles_profesie ON profiles(profesie);
CREATE INDEX idx_profiles_tip_apartament_cauta ON profiles(tip_apartament_cauta);
CREATE INDEX idx_profiles_zona ON profiles(zona);

-- Add comments for documentation
COMMENT ON COLUMN profiles.varsta IS 'Age of the user (18-120 years)';
COMMENT ON COLUMN profiles.profesie IS 'Profession/occupation of the user';
COMMENT ON COLUMN profiles.tip_apartament_cauta IS 'Type of apartment the user is looking for';
COMMENT ON COLUMN profiles.zona IS 'Area/zone where the user wants to find an apartment';

-- Update the updated_at trigger to work with the new fields
-- The existing trigger should already handle this automatically
