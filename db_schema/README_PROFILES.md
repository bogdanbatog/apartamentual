# Profiles Table Migration

This document describes the creation of a profiles table that has a 1:1 relationship with `auth.users` and includes the required fields.

## Files Created

### 1. `005_create_profiles_table.sql`
Creates the `profiles` table with:
- `user_id` (UUID, Primary Key) - References `auth.users(id)` with CASCADE delete
- `email` (VARCHAR) - Denormalized from `auth.users` for easier access
- `is_super_admin` (BOOLEAN) - Flag for super admin privileges
- Additional fields: `first_name`, `last_name`, `phone`
- Timestamps: `created_at`, `updated_at`
- Proper indexes and RLS policies
- `is_super_admin()` security definer function to avoid RLS recursion

### 2. `006_migrate_auth_users_to_profiles.sql`
Data migration script that:
- Populates the `profiles` table with existing `auth.users` data
- Creates triggers to automatically create profiles for new users
- Creates triggers to sync profile data when `auth.users` is updated
- Handles conflicts gracefully with `ON CONFLICT DO NOTHING`

### 3. `007_update_terenuri_policies_for_profiles.sql`
Updates existing RLS policies to:
- Use the new `profiles` table instead of directly accessing `auth.users`
- Add comprehensive admin policies for super admins
- Allow super admins to manage all terenuri operations including soft-deleted records

### 4. `008_fix_profiles_rls_recursion.sql`
Fixes infinite recursion in profiles RLS policies by:
- Creating `is_super_admin()` security definer function
- Updating policies to use the function instead of querying profiles table
- Adding policy for users to insert their own profiles

### 5. `009_fix_terenuri_policies_recursion.sql`
Updates terenuri policies to use the `is_super_admin()` function to avoid recursion

## Key Features

### 1:1 Relationship
- Each user in `auth.users` has exactly one corresponding record in `profiles`
- Foreign key constraint ensures referential integrity
- CASCADE delete ensures profiles are deleted when users are deleted

### Automatic Synchronization
- New users automatically get a profile created via trigger
- Profile data stays in sync with `auth.users` via update trigger
- Email changes in `auth.users` are automatically reflected in `profiles`

### Security (RLS Policies)
- Users can only view/update their own profile
- Super admins can view and manage all profiles
- Super admins have full control over terenuri records
- Proper permissions granted to different user roles

### Data Migration
- Existing users are automatically migrated
- No data loss during migration
- Handles edge cases with conflict resolution

## Usage

To apply these migrations, run them in order:
1. `005_create_profiles_table.sql`
2. `006_migrate_auth_users_to_profiles.sql`
3. `007_update_terenuri_policies_for_profiles.sql`
4. `008_fix_profiles_rls_recursion.sql` (if you encounter recursion errors)
5. `009_fix_terenuri_policies_recursion.sql` (if you encounter recursion errors)

## Query Examples

```sql
-- Get user profile with admin status
SELECT p.*, u.created_at as user_created_at
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE p.user_id = auth.uid();

-- Check if current user is super admin
SELECT is_super_admin 
FROM profiles 
WHERE user_id = auth.uid();

-- Get all super admins
SELECT p.email, p.first_name, p.last_name
FROM profiles p
WHERE p.is_super_admin = true;
```
