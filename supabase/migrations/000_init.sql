

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_approve_group_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Automatically add the group owner as an approved member
    INSERT INTO grup_membership (grup_id, user_id, status, role, approved_at)
    VALUES (NEW.id, NEW.owner_user_id, 'approved', 'admin', NOW())
    ON CONFLICT (grup_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_approve_group_owner"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_approve_group_owner"() IS 'Trigger function to automatically approve group owner as a member';



CREATE OR REPLACE FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT public.is_group_owner(grup_id_param, user_id_param) OR public.is_super_admin();
$$;


ALTER FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid") IS 'Check if a user can manage a group (owner or super admin)';



CREATE OR REPLACE FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT COUNT(*)::INTEGER FROM grup_membership 
    WHERE grup_id = grup_id_param 
    AND status = 'approved';
$$;


ALTER FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") IS 'Get the current number of approved members in a group';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, is_super_admin, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.is_super_admin, false),
        NEW.created_at,
        NEW.updated_at
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates a profile when a new user is created in auth.users';



CREATE OR REPLACE FUNCTION "public"."is_group_full"("grup_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT public.get_group_member_count(grup_id_param) >= (
        SELECT max_members FROM grup WHERE id = grup_id_param
    );
$$;


ALTER FUNCTION "public"."is_group_full"("grup_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_group_full"("grup_id_param" "uuid") IS 'Check if a group has reached its maximum member limit';



CREATE OR REPLACE FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM grup_membership 
        WHERE grup_id = grup_id_param 
        AND user_id = user_id_param 
        AND status = 'approved'
    );
$$;


ALTER FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid") IS 'Check if a user is an approved member of a group';



CREATE OR REPLACE FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM grup 
        WHERE id = grup_id_param 
        AND owner_user_id = user_id_param
        AND is_disabled = false
    );
$$;


ALTER FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid") IS 'Check if a user is the owner of a group';



CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM profiles WHERE user_id = auth.uid()),
        false
    );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_super_admin"() IS 'Security definer function to check if current user is super admin by checking profiles table';



CREATE OR REPLACE FUNCTION "public"."sync_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update the corresponding profile record
    UPDATE public.profiles 
    SET 
        email = NEW.email,
        updated_at = NEW.updated_at
    WHERE user_id = NEW.id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_profile"() IS 'Syncs profile data when auth.users is updated';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_membership_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only allow users to leave groups if they're currently pending or approved
    IF NEW.status = 'left' AND OLD.status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'Cannot leave group with status: %', OLD.status;
    END IF;
    
    -- Only allow setting status to 'removed' if user is not the group owner
    IF NEW.status = 'removed' AND EXISTS (
        SELECT 1 FROM grup WHERE id = NEW.grup_id AND owner_user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Group owners cannot be removed from their own groups';
    END IF;
    
    -- Only allow group owners or super admins to change status to 'removed'
    IF NEW.status = 'removed' AND NOT public.can_manage_group(NEW.grup_id) THEN
        RAISE EXCEPTION 'Only group owners or super admins can remove members';
    END IF;
    
    -- Only allow users to change their own status to 'left'
    IF NEW.status = 'left' AND NEW.user_id != auth.uid() THEN
        RAISE EXCEPTION 'Users can only leave groups in their own name';
    END IF;
    
    -- Set left_at timestamp when leaving
    IF NEW.status = 'left' AND OLD.status != 'left' THEN
        NEW.left_at = NOW();
    END IF;
    
    -- Set approved_at timestamp when approving
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
        NEW.approved_by_user_id = auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_membership_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_membership_status_change"() IS 'Trigger function to validate membership status changes and enforce business rules';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."grup" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "nume" character varying(255) NOT NULL,
    "descriere" "text",
    "poza" "bytea",
    "zona" character varying(255),
    "nr_apartamente_dorite" integer,
    "buget_max_per_apartament" numeric(12,2),
    "data_incepere_proiect" "date",
    "data_finalizare_proiect" "date",
    "status" character varying(50) DEFAULT 'active'::character varying,
    "is_public" boolean DEFAULT true,
    "max_members" integer DEFAULT 20,
    "is_disabled" boolean DEFAULT false NOT NULL,
    "disabled_at" timestamp with time zone,
    "disabled_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    CONSTRAINT "grup_buget_max_per_apartament_check" CHECK (("buget_max_per_apartament" > (0)::numeric)),
    CONSTRAINT "grup_max_members_check" CHECK (("max_members" > 0)),
    CONSTRAINT "grup_nr_apartamente_dorite_check" CHECK (("nr_apartamente_dorite" > 0)),
    CONSTRAINT "grup_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'full'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."grup" OWNER TO "postgres";


COMMENT ON TABLE "public"."grup" IS 'Groups for Baugruppen construction projects';



COMMENT ON COLUMN "public"."grup"."id" IS 'Primary key UUID';



COMMENT ON COLUMN "public"."grup"."owner_user_id" IS 'User who owns/created this group';



COMMENT ON COLUMN "public"."grup"."nume" IS 'Group name';



COMMENT ON COLUMN "public"."grup"."descriere" IS 'Detailed description of the group and project';



COMMENT ON COLUMN "public"."grup"."poza" IS 'Binary image data for the group photo';



COMMENT ON COLUMN "public"."grup"."zona" IS 'Preferred area/neighborhood for the project';



COMMENT ON COLUMN "public"."grup"."nr_apartamente_dorite" IS 'Desired number of apartments in the project';



COMMENT ON COLUMN "public"."grup"."buget_max_per_apartament" IS 'Maximum budget per apartment in EUR';



COMMENT ON COLUMN "public"."grup"."data_incepere_proiect" IS 'Expected project start date';



COMMENT ON COLUMN "public"."grup"."data_finalizare_proiect" IS 'Expected project completion date';



COMMENT ON COLUMN "public"."grup"."status" IS 'Group status: active, inactive, full, completed, cancelled';



COMMENT ON COLUMN "public"."grup"."is_public" IS 'Whether group is visible to all users';



COMMENT ON COLUMN "public"."grup"."max_members" IS 'Maximum number of group members';



COMMENT ON COLUMN "public"."grup"."is_disabled" IS 'Soft delete flag - disabled groups are hidden';



COMMENT ON COLUMN "public"."grup"."disabled_at" IS 'Timestamp when group was disabled';



COMMENT ON COLUMN "public"."grup"."disabled_by_user_id" IS 'User who disabled the group';



COMMENT ON COLUMN "public"."grup"."image_url" IS 'URL of the group image stored in Supabase Storage';



CREATE TABLE IF NOT EXISTS "public"."grup_membership" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grup_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "role" character varying(50) DEFAULT 'member'::character varying,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    "approved_by_user_id" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "grup_membership_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['member'::character varying, 'admin'::character varying, 'moderator'::character varying])::"text"[]))),
    CONSTRAINT "grup_membership_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'left'::character varying, 'removed'::character varying])::"text"[])))
);


ALTER TABLE "public"."grup_membership" OWNER TO "postgres";


COMMENT ON TABLE "public"."grup_membership" IS 'Many-to-many relationship between groups and users - RLS policies fixed to prevent recursion';



COMMENT ON COLUMN "public"."grup_membership"."id" IS 'Primary key UUID';



COMMENT ON COLUMN "public"."grup_membership"."grup_id" IS 'Foreign key to grup table';



COMMENT ON COLUMN "public"."grup_membership"."user_id" IS 'Foreign key to profiles table';



COMMENT ON COLUMN "public"."grup_membership"."status" IS 'Membership status: pending, approved, rejected, left, removed';



COMMENT ON COLUMN "public"."grup_membership"."role" IS 'User role in the group: member, admin, moderator';



COMMENT ON COLUMN "public"."grup_membership"."joined_at" IS 'When user joined the group';



COMMENT ON COLUMN "public"."grup_membership"."left_at" IS 'When user left the group';



COMMENT ON COLUMN "public"."grup_membership"."approved_by_user_id" IS 'User who approved the membership';



COMMENT ON COLUMN "public"."grup_membership"."approved_at" IS 'When membership was approved';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "is_super_admin" boolean DEFAULT false NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100),
    "phone" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "varsta" integer,
    "profesie" character varying(100),
    "tip_apartament_cauta" character varying(50),
    "zona" character varying(100),
    "anul_nasterii" integer,
    CONSTRAINT "profiles_varsta_check" CHECK ((("varsta" >= 18) AND ("varsta" <= 120)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles with additional information beyond auth.users';



COMMENT ON COLUMN "public"."profiles"."user_id" IS 'Primary key referencing auth.users(id)';



COMMENT ON COLUMN "public"."profiles"."email" IS 'User email address (denormalized from auth.users)';



COMMENT ON COLUMN "public"."profiles"."is_super_admin" IS 'Flag indicating if user has super admin privileges';



COMMENT ON COLUMN "public"."profiles"."first_name" IS 'User first name';



COMMENT ON COLUMN "public"."profiles"."last_name" IS 'User last name';



COMMENT ON COLUMN "public"."profiles"."phone" IS 'User phone number';



COMMENT ON COLUMN "public"."profiles"."varsta" IS 'Age of the user (18-120 years)';



COMMENT ON COLUMN "public"."profiles"."profesie" IS 'Profession/occupation of the user';



COMMENT ON COLUMN "public"."profiles"."tip_apartament_cauta" IS 'Type of apartment the user is looking for';



COMMENT ON COLUMN "public"."profiles"."zona" IS 'Area/zone where the user wants to find an apartment';



CREATE TABLE IF NOT EXISTS "public"."terenuri" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "titlu" character varying(255) NOT NULL,
    "descriere" "text",
    "poza" "bytea",
    "data_adaugat" timestamp with time zone DEFAULT "now"() NOT NULL,
    "analiza_generala_status" character varying(50) DEFAULT 'pending'::character varying,
    "analiza_generala_text" "text",
    "analiza_specifica_status" character varying(50) DEFAULT 'pending'::character varying,
    "analiza_specifica_text" "text",
    "nr_apartamente_min" integer,
    "nr_apartamente_max" integer,
    "zona" character varying(255),
    "suprafata" integer,
    "pret_pe_mp" numeric(10,2),
    "status" character varying(50) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" character varying(500),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "terenuri_analiza_generala_status_check" CHECK ((("analiza_generala_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "terenuri_analiza_specifica_status_check" CHECK ((("analiza_specifica_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "terenuri_check" CHECK (("nr_apartamente_max" >= "nr_apartamente_min")),
    CONSTRAINT "terenuri_nr_apartamente_min_check" CHECK (("nr_apartamente_min" > 0)),
    CONSTRAINT "terenuri_pret_pe_mp_check" CHECK (("pret_pe_mp" >= (0)::numeric)),
    CONSTRAINT "terenuri_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'sold'::character varying, 'reserved'::character varying, 'under_review'::character varying])::"text"[]))),
    CONSTRAINT "terenuri_suprafata_check" CHECK (("suprafata" > 0))
);


ALTER TABLE "public"."terenuri" OWNER TO "postgres";


COMMENT ON TABLE "public"."terenuri" IS 'Land listings for Baugruppen construction groups';



COMMENT ON COLUMN "public"."terenuri"."id" IS 'Primary key UUID';



COMMENT ON COLUMN "public"."terenuri"."created_by_user_id" IS 'User who created this listing';



COMMENT ON COLUMN "public"."terenuri"."titlu" IS 'Title/name of the land listing';



COMMENT ON COLUMN "public"."terenuri"."descriere" IS 'Detailed description of the land';



COMMENT ON COLUMN "public"."terenuri"."poza" IS 'Binary image data for the land photo';



COMMENT ON COLUMN "public"."terenuri"."data_adaugat" IS 'Date when listing was added';



COMMENT ON COLUMN "public"."terenuri"."analiza_generala_status" IS 'Status of general analysis: pending, in_progress, completed, rejected';



COMMENT ON COLUMN "public"."terenuri"."analiza_generala_text" IS 'Results/notes from general analysis';



COMMENT ON COLUMN "public"."terenuri"."analiza_specifica_status" IS 'Status of specific analysis: pending, in_progress, completed, rejected';



COMMENT ON COLUMN "public"."terenuri"."analiza_specifica_text" IS 'Results/notes from specific analysis';



COMMENT ON COLUMN "public"."terenuri"."nr_apartamente_min" IS 'Minimum number of apartments possible';



COMMENT ON COLUMN "public"."terenuri"."nr_apartamente_max" IS 'Maximum number of apartments possible';



COMMENT ON COLUMN "public"."terenuri"."zona" IS 'Area/neighborhood location';



COMMENT ON COLUMN "public"."terenuri"."suprafata" IS 'Land area in square meters';



COMMENT ON COLUMN "public"."terenuri"."pret_pe_mp" IS 'Price per square meter in EUR';



COMMENT ON COLUMN "public"."terenuri"."status" IS 'Listing status: active, inactive, sold, reserved, under_review';



COMMENT ON COLUMN "public"."terenuri"."image_url" IS 'Public URL to image stored in Supabase Storage terrain-images bucket';



COMMENT ON COLUMN "public"."terenuri"."deleted_at" IS 'Timestamp when the record was soft deleted. NULL means not deleted.';



ALTER TABLE ONLY "public"."grup_membership"
    ADD CONSTRAINT "grup_membership_grup_id_user_id_key" UNIQUE ("grup_id", "user_id");



ALTER TABLE ONLY "public"."grup_membership"
    ADD CONSTRAINT "grup_membership_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grup"
    ADD CONSTRAINT "grup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."terenuri"
    ADD CONSTRAINT "terenuri_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_grup_created_at" ON "public"."grup" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_grup_disabled_at" ON "public"."grup" USING "btree" ("disabled_at" DESC);



CREATE INDEX "idx_grup_image_url" ON "public"."grup" USING "btree" ("image_url") WHERE ("image_url" IS NOT NULL);



CREATE INDEX "idx_grup_is_disabled" ON "public"."grup" USING "btree" ("is_disabled");



CREATE INDEX "idx_grup_is_public" ON "public"."grup" USING "btree" ("is_public");



CREATE INDEX "idx_grup_membership_approved_at" ON "public"."grup_membership" USING "btree" ("approved_at" DESC);



CREATE INDEX "idx_grup_membership_grup_id" ON "public"."grup_membership" USING "btree" ("grup_id");



CREATE INDEX "idx_grup_membership_joined_at" ON "public"."grup_membership" USING "btree" ("joined_at" DESC);



CREATE INDEX "idx_grup_membership_role" ON "public"."grup_membership" USING "btree" ("role");



CREATE INDEX "idx_grup_membership_status" ON "public"."grup_membership" USING "btree" ("status");



CREATE INDEX "idx_grup_membership_user_id" ON "public"."grup_membership" USING "btree" ("user_id");



CREATE INDEX "idx_grup_owner" ON "public"."grup" USING "btree" ("owner_user_id");



CREATE INDEX "idx_grup_status" ON "public"."grup" USING "btree" ("status");



CREATE INDEX "idx_grup_zona" ON "public"."grup" USING "btree" ("zona");



CREATE INDEX "idx_profiles_created_at" ON "public"."profiles" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE UNIQUE INDEX "idx_profiles_email_unique" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_is_super_admin" ON "public"."profiles" USING "btree" ("is_super_admin");



CREATE INDEX "idx_profiles_profesie" ON "public"."profiles" USING "btree" ("profesie");



CREATE INDEX "idx_profiles_tip_apartament_cauta" ON "public"."profiles" USING "btree" ("tip_apartament_cauta");



CREATE INDEX "idx_profiles_varsta" ON "public"."profiles" USING "btree" ("varsta");



CREATE INDEX "idx_profiles_zona" ON "public"."profiles" USING "btree" ("zona");



CREATE INDEX "idx_terenuri_analiza_generala" ON "public"."terenuri" USING "btree" ("analiza_generala_status");



CREATE INDEX "idx_terenuri_analiza_specifica" ON "public"."terenuri" USING "btree" ("analiza_specifica_status");



CREATE INDEX "idx_terenuri_created_by" ON "public"."terenuri" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_terenuri_data_adaugat" ON "public"."terenuri" USING "btree" ("data_adaugat" DESC);



CREATE INDEX "idx_terenuri_deleted_at" ON "public"."terenuri" USING "btree" ("deleted_at");



CREATE INDEX "idx_terenuri_image_url" ON "public"."terenuri" USING "btree" ("image_url") WHERE ("image_url" IS NOT NULL);



CREATE INDEX "idx_terenuri_status" ON "public"."terenuri" USING "btree" ("status");



CREATE INDEX "idx_terenuri_zona" ON "public"."terenuri" USING "btree" ("zona");



CREATE OR REPLACE TRIGGER "auto_approve_group_owner_trigger" AFTER INSERT ON "public"."grup" FOR EACH ROW EXECUTE FUNCTION "public"."auto_approve_group_owner"();



CREATE OR REPLACE TRIGGER "update_grup_membership_updated_at" BEFORE UPDATE ON "public"."grup_membership" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_grup_updated_at" BEFORE UPDATE ON "public"."grup" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_terenuri_updated_at" BEFORE UPDATE ON "public"."terenuri" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_membership_status_change_trigger" BEFORE UPDATE ON "public"."grup_membership" FOR EACH ROW EXECUTE FUNCTION "public"."validate_membership_status_change"();



ALTER TABLE ONLY "public"."grup"
    ADD CONSTRAINT "grup_disabled_by_user_id_fkey" FOREIGN KEY ("disabled_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."grup_membership"
    ADD CONSTRAINT "grup_membership_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."grup_membership"
    ADD CONSTRAINT "grup_membership_grup_id_fkey" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grup_membership"
    ADD CONSTRAINT "grup_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grup"
    ADD CONSTRAINT "grup_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."terenuri"
    ADD CONSTRAINT "terenuri_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view active non-deleted terenuri" ON "public"."terenuri" FOR SELECT USING (((("status")::"text" = 'active'::"text") AND ("deleted_at" IS NULL)));



CREATE POLICY "Anyone can view active public groups" ON "public"."grup" FOR SELECT USING (((("status")::"text" = 'active'::"text") AND ("is_public" = true) AND ("is_disabled" = false)));



CREATE POLICY "Authenticated users can view active groups" ON "public"."grup" FOR SELECT TO "authenticated" USING ((("is_disabled" = false) AND ((("status")::"text" = 'active'::"text") OR "public"."is_group_member"("id") OR "public"."is_group_owner"("id") OR "public"."is_super_admin"())));



CREATE POLICY "Authenticated users can view all non-deleted terenuri" ON "public"."terenuri" FOR SELECT TO "authenticated" USING (("deleted_at" IS NULL));



CREATE POLICY "Comprehensive terenuri update policy" ON "public"."terenuri" FOR UPDATE TO "authenticated" USING (((("auth"."uid"() = "created_by_user_id") AND ("deleted_at" IS NULL)) OR "public"."is_super_admin"())) WITH CHECK (((("auth"."uid"() = "created_by_user_id") AND ("deleted_at" IS NULL)) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Comprehensive terenuri update policy" ON "public"."terenuri" IS 'Allows users to update their own non-deleted terenuri and super admins to update any terenuri including soft deletion';



CREATE POLICY "Group owners can manage their group memberships" ON "public"."grup_membership" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."grup" "g"
  WHERE (("g"."id" = "grup_membership"."grup_id") AND ("g"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."grup" "g"
  WHERE (("g"."id" = "grup_membership"."grup_id") AND ("g"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Group owners can remove members" ON "public"."grup_membership" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."grup" "g"
  WHERE (("g"."id" = "grup_membership"."grup_id") AND ("g"."owner_user_id" = "auth"."uid"())))) AND ("user_id" <> "auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."grup" "g"
  WHERE (("g"."id" = "grup_membership"."grup_id") AND ("g"."owner_user_id" = "auth"."uid"())))) AND ("user_id" <> "auth"."uid"()) AND (("status")::"text" = ANY ((ARRAY['removed'::character varying, 'left'::character varying])::"text"[]))));



CREATE POLICY "Group owners can view their group memberships" ON "public"."grup_membership" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."grup" "g"
  WHERE (("g"."id" = "grup_membership"."grup_id") AND ("g"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Super admins can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all memberships" ON "public"."grup_membership" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage group status" ON "public"."grup" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can update any group" ON "public"."grup" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."user_id" = "auth"."uid"()) AND ("profiles_1"."is_super_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."user_id" = "auth"."uid"()) AND ("profiles_1"."is_super_admin" = true)))));



COMMENT ON POLICY "Super admins can update any profile" ON "public"."profiles" IS 'Allows super admins to update any profile including admin status';



CREATE POLICY "Super admins can view all groups" ON "public"."grup" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all memberships" ON "public"."grup_membership" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all terenuri including deleted" ON "public"."terenuri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."is_super_admin" = true)))));



CREATE POLICY "Users can create groups" ON "public"."grup" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can create their own membership requests" ON "public"."grup_membership" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."grup"
  WHERE (("grup"."id" = "grup_membership"."grup_id") AND ("grup"."is_disabled" = false) AND (("grup"."status")::"text" = 'active'::"text"))))));



CREATE POLICY "Users can create their own terenuri" ON "public"."terenuri" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by_user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can leave groups" ON "public"."grup_membership" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("status")::"text" = 'left'::"text")));



CREATE POLICY "Users can update their own groups" ON "public"."grup" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can update their own profile except admin status" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_super_admin" = ( SELECT "profiles_1"."is_super_admin"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."user_id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can update their own profile except admin status" ON "public"."profiles" IS 'Allows users to update their own profile but prevents modification of is_super_admin field';



CREATE POLICY "Users can view group owner profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."grup"
  WHERE (("grup"."owner_user_id" = "profiles"."user_id") AND ("grup"."is_public" = true) AND ("grup"."is_disabled" = false)))));



COMMENT ON POLICY "Users can view group owner profiles" ON "public"."profiles" IS 'Allows users to view profiles of group owners for public groups';



CREATE POLICY "Users can view their own memberships" ON "public"."grup_membership" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."grup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grup_membership" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terenuri" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_approve_group_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_approve_group_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_approve_group_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_group"("grup_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_group_member_count"("grup_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_full"("grup_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_full"("grup_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_full"("grup_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("grup_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_owner"("grup_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_membership_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_membership_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_membership_status_change"() TO "service_role";


















GRANT ALL ON TABLE "public"."grup" TO "anon";
GRANT ALL ON TABLE "public"."grup" TO "authenticated";
GRANT ALL ON TABLE "public"."grup" TO "service_role";



GRANT ALL ON TABLE "public"."grup_membership" TO "anon";
GRANT ALL ON TABLE "public"."grup_membership" TO "authenticated";
GRANT ALL ON TABLE "public"."grup_membership" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."terenuri" TO "anon";
GRANT ALL ON TABLE "public"."terenuri" TO "authenticated";
GRANT ALL ON TABLE "public"."terenuri" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























