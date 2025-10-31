-- Many-to-many link between grup and terenuri
-- Creates table, constraints, indexes, and SELECT-only RLS policies

BEGIN;

CREATE TABLE IF NOT EXISTS public.grup_terenuri (
    grup_id uuid NOT NULL,
    teren_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user uuid,
    removed_by_user uuid,
    removed_at timestamptz,
    CONSTRAINT grup_terenuri_pkey PRIMARY KEY (grup_id, teren_id),
    CONSTRAINT grup_terenuri_grup_id_fkey FOREIGN KEY (grup_id)
        REFERENCES public.grup(id) ON DELETE CASCADE,
    CONSTRAINT grup_terenuri_teren_id_fkey FOREIGN KEY (teren_id)
        REFERENCES public.terenuri(id) ON DELETE CASCADE,
    CONSTRAINT grup_terenuri_created_by_user_fkey FOREIGN KEY (created_by_user)
        REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT grup_terenuri_removed_by_user_fkey FOREIGN KEY (removed_by_user)
        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.grup_terenuri IS 'Many-to-many mapping between groups and terrains';
COMMENT ON COLUMN public.grup_terenuri.grup_id IS 'FK to grup.id';
COMMENT ON COLUMN public.grup_terenuri.teren_id IS 'FK to terenuri.id';
COMMENT ON COLUMN public.grup_terenuri.created_by_user IS 'User who created the association';
COMMENT ON COLUMN public.grup_terenuri.removed_by_user IS 'User who removed the association';
COMMENT ON COLUMN public.grup_terenuri.removed_at IS 'Timestamp when the association was removed';

CREATE INDEX IF NOT EXISTS idx_grup_terenuri_grup_id ON public.grup_terenuri USING btree (grup_id);
CREATE INDEX IF NOT EXISTS idx_grup_terenuri_teren_id ON public.grup_terenuri USING btree (teren_id);
CREATE INDEX IF NOT EXISTS idx_grup_terenuri_created_by_user ON public.grup_terenuri USING btree (created_by_user);
CREATE INDEX IF NOT EXISTS idx_grup_terenuri_removed_by_user ON public.grup_terenuri USING btree (removed_by_user);

-- Enable RLS and allow SELECT for public and authenticated users
ALTER TABLE public.grup_terenuri ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'grup_terenuri' AND policyname = 'Anyone can read grup_terenuri'
    ) THEN
        CREATE POLICY "Anyone can read grup_terenuri" ON public.grup_terenuri
            FOR SELECT
            USING (true);
    END IF;
END$$;

-- Allow grup owners and super admins to insert associations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'grup_terenuri' AND policyname = 'Group owners and super admins can insert grup_terenuri'
    ) THEN
        CREATE POLICY "Group owners and super admins can insert grup_terenuri" ON public.grup_terenuri
            FOR INSERT
            TO authenticated
            WITH CHECK (
                public.can_manage_group(grup_id)
            );
    END IF;
END$$;

-- Allow grup owners and super admins to update (for soft delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'grup_terenuri' AND policyname = 'Group owners and super admins can update grup_terenuri'
    ) THEN
        CREATE POLICY "Group owners and super admins can update grup_terenuri" ON public.grup_terenuri
            FOR UPDATE
            TO authenticated
            USING (
                public.can_manage_group(grup_id)
            )
            WITH CHECK (
                public.can_manage_group(grup_id)
            );
    END IF;
END$$;

COMMIT;


