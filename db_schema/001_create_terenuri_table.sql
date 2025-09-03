-- Create terenuri table for ApartamenTUal platform
-- This table stores land listings with analysis status and details

CREATE TABLE IF NOT EXISTS terenuri (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User who created the listing (foreign key to auth.users)
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Basic land information
    titlu VARCHAR(255) NOT NULL,
    descriere TEXT,
    poza BYTEA, -- Binary data for image storage
    data_adaugat TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- General analysis fields
    analiza_generala_status VARCHAR(50) DEFAULT 'pending' CHECK (analiza_generala_status IN ('pending', 'in_progress', 'completed', 'rejected')),
    analiza_generala_text TEXT,
    
    -- Specific analysis fields
    analiza_specifica_status VARCHAR(50) DEFAULT 'pending' CHECK (analiza_specifica_status IN ('pending', 'in_progress', 'completed', 'rejected')),
    analiza_specifica_text TEXT,
    
    -- Property specifications
    nr_apartamente_min INTEGER CHECK (nr_apartamente_min > 0),
    nr_apartamente_max INTEGER CHECK (nr_apartamente_max >= nr_apartamente_min),
    zona VARCHAR(255),
    suprafata INTEGER CHECK (suprafata > 0), -- in square meters
    pret_pe_mp DECIMAL(10,2) CHECK (pret_pe_mp >= 0), -- price per square meter in EUR
    
    -- Status of the listing
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold', 'reserved', 'under_review')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX idx_terenuri_created_by ON terenuri(created_by_user_id);
CREATE INDEX idx_terenuri_zona ON terenuri(zona);
CREATE INDEX idx_terenuri_status ON terenuri(status);
CREATE INDEX idx_terenuri_data_adaugat ON terenuri(data_adaugat DESC);
CREATE INDEX idx_terenuri_analiza_generala ON terenuri(analiza_generala_status);
CREATE INDEX idx_terenuri_analiza_specifica ON terenuri(analiza_specifica_status);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to automatically update updated_at column
CREATE TRIGGER update_terenuri_updated_at 
    BEFORE UPDATE ON terenuri 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE terenuri ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy 1: Anyone can view active listings
CREATE POLICY "Anyone can view active terenuri" ON terenuri
    FOR SELECT USING (status = 'active');

-- Policy 2: Authenticated users can view all listings
CREATE POLICY "Authenticated users can view all terenuri" ON terenuri
    FOR SELECT TO authenticated USING (true);

-- Policy 3: Users can insert their own listings
CREATE POLICY "Users can create their own terenuri" ON terenuri
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = created_by_user_id);

-- Policy 4: Users can update their own listings
CREATE POLICY "Users can update their own terenuri" ON terenuri
    FOR UPDATE TO authenticated 
    USING (auth.uid() = created_by_user_id)
    WITH CHECK (auth.uid() = created_by_user_id);

-- -- Policy 5: Users can delete their own listings
-- CREATE POLICY "Users can delete their own terenuri" ON terenuri
--     FOR DELETE TO authenticated 
--     USING (auth.uid() = created_by_user_id);

-- Policy 6: Admins can do everything (assuming you have an admin role)
-- Note: This assumes you have a profiles table with role column
-- CREATE POLICY "Admins can manage all terenuri" ON terenuri
--     FOR ALL TO authenticated 
--     USING (
--         EXISTS (
--             SELECT 1 FROM profiles 
--             WHERE user_id = auth.uid() AND role = 'admin'
--         )
--     );

-- Add comments for documentation
COMMENT ON TABLE terenuri IS 'Land listings for Baugruppen construction groups';
COMMENT ON COLUMN terenuri.id IS 'Primary key UUID';
COMMENT ON COLUMN terenuri.created_by_user_id IS 'User who created this listing';
COMMENT ON COLUMN terenuri.titlu IS 'Title/name of the land listing';
COMMENT ON COLUMN terenuri.descriere IS 'Detailed description of the land';
COMMENT ON COLUMN terenuri.poza IS 'Binary image data for the land photo';
COMMENT ON COLUMN terenuri.data_adaugat IS 'Date when listing was added';
COMMENT ON COLUMN terenuri.analiza_generala_status IS 'Status of general analysis: pending, in_progress, completed, rejected';
COMMENT ON COLUMN terenuri.analiza_generala_text IS 'Results/notes from general analysis';
COMMENT ON COLUMN terenuri.analiza_specifica_status IS 'Status of specific analysis: pending, in_progress, completed, rejected';
COMMENT ON COLUMN terenuri.analiza_specifica_text IS 'Results/notes from specific analysis';
COMMENT ON COLUMN terenuri.nr_apartamente_min IS 'Minimum number of apartments possible';
COMMENT ON COLUMN terenuri.nr_apartamente_max IS 'Maximum number of apartments possible';
COMMENT ON COLUMN terenuri.zona IS 'Area/neighborhood location';
COMMENT ON COLUMN terenuri.suprafata IS 'Land area in square meters';
COMMENT ON COLUMN terenuri.pret_pe_mp IS 'Price per square meter in EUR';
COMMENT ON COLUMN terenuri.status IS 'Listing status: active, inactive, sold, reserved, under_review';

-- Insert some sample data for testing (optional)
-- INSERT INTO terenuri (
--     created_by_user_id, 
--     titlu, 
--     descriere, 
--     zona, 
--     suprafata, 
--     pret_pe_mp, 
--     nr_apartamente_min, 
--     nr_apartamente_max,
--     analiza_generala_status,
--     analiza_generala_text
-- ) VALUES (
--     auth.uid(), -- This will need to be replaced with actual user UUID
--     'Teren București - Sector 2',
--     'Teren de 2000 mp în zona Colentina, aproape de transport public. Acces la toate utilitățile.',
--     'București, Sector 2',
--     2000,
--     150.00,
--     8,
--     12,
--     'completed',
--     'Analiza generală confirmă potențialul pentru dezvoltare rezidențială. Zonare compatibilă, acces la utilități confirmat.'
-- );