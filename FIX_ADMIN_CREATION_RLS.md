# Fix: Admin Creation RLS Policy Error

## Problem
When clicking "Create Admin" in the admin panel, you get the error:
```
new row violates row-level security policy for table "profiles"
```

This happens because admins can't insert profiles for other users due to RLS policies.

## Solution
Two migration files have been created to fix this issue. You need to apply them to your Supabase database via the SQL Editor.

### Step 1: Go to Supabase SQL Editor
1. Open https://app.supabase.com
2. Navigate to your project
3. Go to **SQL Editor** in the left sidebar
4. Create a new query

### Step 2: Run the First Migration
Copy and paste this SQL into the SQL Editor and execute it:

```sql
-- Add RLS policies to allow admins to create and update profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
```

### Step 3: Run the Second Migration
After the first migration succeeds, create a new query and run this SQL:

```sql
-- Create function to allow admins to create new admin profiles
CREATE OR REPLACE FUNCTION public.create_admin_profile(
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create new admin profiles';
  END IF;
  
  INSERT INTO public.profiles (
    id,
    name,
    email,
    account_status
  ) VALUES (
    p_user_id,
    p_name,
    p_email,
    'active'
  ) ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_admin_profile(UUID, TEXT, TEXT) TO authenticated;
```

### Step 4: Test the Fix
1. Go back to your admin panel
2. Click **Admin Management** → **Add Admin**
3. Fill in the form and click **Create Admin**
4. The new admin should be created successfully

## What Changed
- Modified `src/components/admin/AddAdminDialog.tsx` to use the new `create_admin_profile()` function
- The function runs with elevated privileges (SECURITY DEFINER) to bypass RLS checks
- Includes admin-only authorization check inside the function
- Created two migration files in `supabase/migrations/` for future deployments
