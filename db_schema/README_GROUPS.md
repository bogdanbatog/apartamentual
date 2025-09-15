# Groups Functionality Database Schema

This document describes the database schema for the groups functionality in the ApartamenTUal platform.

## Overview

The groups functionality allows users to create and manage Baugruppen (construction groups) for collaborative apartment building projects. Each group has an owner and can have multiple members.

## Tables

### 1. `grup` Table

The main groups table that stores group information.

**Key Features:**
- Each group has an owner (`owner_user_id` references `profiles.user_id`)
- Soft delete functionality (`is_disabled` flag)
- Group details including name, description, preferred area, budget, etc.
- Status management (active, inactive, full, completed, cancelled)
- Public/private visibility control
- Maximum member limit

**Important Columns:**
- `id`: Primary key (UUID)
- `owner_user_id`: Group owner (foreign key to profiles)
- `nume`: Group name
- `descriere`: Group description
- `zona`: Preferred area/neighborhood
- `nr_apartamente_dorite`: Desired number of apartments
- `buget_max_per_apartament`: Maximum budget per apartment (EUR)
- `data_incepere_proiect`: Expected project start date
- `data_finalizare_proiect`: Expected project completion date
- `status`: Group status (active, inactive, full, completed, cancelled)
- `is_public`: Whether group is visible to all users
- `max_members`: Maximum number of group members
- `is_disabled`: Soft delete flag
- `disabled_at`: When group was disabled
- `disabled_by_user_id`: Who disabled the group

### 2. `grup_membership` Table

Manages the many-to-many relationship between groups and users.

**Key Features:**
- Tracks membership status (pending, approved, rejected, left, removed)
- Role management (member, admin, moderator)
- Approval workflow
- Join/leave timestamps

**Important Columns:**
- `id`: Primary key (UUID)
- `grup_id`: Foreign key to grup table
- `user_id`: Foreign key to profiles table
- `status`: Membership status
- `role`: User role in the group
- `joined_at`: When user joined
- `left_at`: When user left
- `approved_by_user_id`: Who approved the membership
- `approved_at`: When membership was approved

## Helper Functions

### Permission Functions
- `is_group_member(grup_id, user_id)`: Check if user is an approved member
- `is_group_owner(grup_id, user_id)`: Check if user owns the group
- `can_manage_group(grup_id, user_id)`: Check if user can manage group (owner or super admin)

### Utility Functions
- `get_group_member_count(grup_id)`: Get current member count
- `is_group_full(grup_id)`: Check if group has reached max members

## Row Level Security (RLS) Policies

### Group Table Policies

1. **Public Access**: Anyone can view active, public groups
2. **Authenticated Access**: Authenticated users can view all non-disabled groups
3. **Group Creation**: Users can create groups (they become the owner)
4. **Group Editing**: Users can update groups they own
5. **Super Admin Access**: Super admins can view and manage all groups
6. **Group Management**: Super admins can disable/enable groups

### Membership Table Policies

1. **Membership Viewing**: Users can view memberships for groups they belong to
2. **Owner Access**: Group owners can view all memberships for their groups
3. **Super Admin Access**: Super admins can view all memberships
4. **Membership Requests**: Users can create their own membership requests
5. **Membership Management**: Group owners can approve/reject membership requests
6. **Leaving Groups**: Users can leave groups (update their own status)
7. **Member Removal**: Group owners can remove members (but not themselves)
8. **Super Admin Management**: Super admins can manage all memberships

## Business Rules

### Group Creation
- Users can create groups and automatically become the owner
- Group owners are automatically added as approved members with admin role
- Groups are created as active and public by default

### Membership Management
- Users can request to join groups
- Group owners must approve membership requests
- Users can only join active, non-disabled groups
- Groups have a maximum member limit
- Users cannot join groups that are full

### Group Management
- Only group owners can edit group details
- Super admins can manage any group
- Super admins can disable/enable groups
- Group owners cannot be removed from their own groups

### Security
- All operations are protected by RLS policies
- Users can only manage their own memberships
- Group owners have full control over their groups
- Super admins have system-wide access

## Usage Examples

### Creating a Group
```sql
INSERT INTO grup (owner_user_id, nume, descriere, zona, nr_apartamente_dorite, buget_max_per_apartament)
VALUES (auth.uid(), 'My Baugruppe', 'Building apartments in Bucharest', 'Sector 2', 12, 150000);
```

### Joining a Group
```sql
INSERT INTO grup_membership (grup_id, user_id, status)
VALUES ('group-uuid', auth.uid(), 'pending');
```

### Approving a Membership
```sql
UPDATE grup_membership 
SET status = 'approved', approved_by_user_id = auth.uid(), approved_at = NOW()
WHERE grup_id = 'group-uuid' AND user_id = 'user-uuid';
```

### Leaving a Group
```sql
UPDATE grup_membership 
SET status = 'left', left_at = NOW()
WHERE grup_id = 'group-uuid' AND user_id = auth.uid();
```

## Migration Files

1. `013_create_grup_table.sql` - Creates the main groups table
2. `014_create_grup_membership_table.sql` - Creates the membership table
3. `015_add_grup_helper_functions.sql` - Adds helper functions and triggers
4. `016_enhance_grup_policies.sql` - Enhances policies and adds constraints

## Dependencies

- Requires `profiles` table (migration 005)
- Requires `is_super_admin()` function (migration 012)
- Requires `update_updated_at_column()` function (migration 001)
