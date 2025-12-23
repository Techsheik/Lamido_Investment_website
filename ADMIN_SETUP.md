# Admin Setup Guide

## Creating the Main/First Admin Account

Since the admin creation feature requires an existing admin, you need to manually create the first admin account using Supabase.

### Step 1: Access Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Authentication** → **Users** (or use **SQL Editor**)

### Step 2: Create Admin User (via SQL Editor - Recommended)

Go to **SQL Editor** and run this query (replace values with your admin details):

```sql
-- 1. Create the admin user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token,
  email_change,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  banned_until,
  is_sso_user
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',  -- CHANGE THIS TO YOUR ADMIN EMAIL
  crypt('adminpassword', gen_salt('bf')),  -- CHANGE THIS TO YOUR ADMIN PASSWORD
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Admin Name"}',  -- CHANGE THIS TO YOUR ADMIN NAME
  false,
  NULL,
  false
) RETURNING id;
```

This will return the `id` of the newly created user. **Copy this ID**.

### Step 3: Create Admin Profile

Run this query in SQL Editor (replace `USER_ID_HERE` with the ID from Step 2):

```sql
INSERT INTO public.profiles (id, name, email, account_status)
VALUES (
  'USER_ID_HERE',  -- PASTE THE ID FROM STEP 2
  'Admin Name',    -- CHANGE THIS
  'admin@example.com',  -- CHANGE THIS
  'active'
)
ON CONFLICT DO NOTHING;
```

### Step 4: Assign Admin Role

Run this query (replace `USER_ID_HERE` with the ID from Step 2):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT DO NOTHING;
```

### Step 5: Test Admin Login

1. Go to http://localhost:8080/admin/login
2. Enter the email and password you created in Step 2
3. You should be redirected to `/admin/dashboard`

---

## After Creating the Main Admin

Once you have the main admin account, you can use the **Admin Management** section to create additional admins:

1. Log in as admin at http://localhost:8080/admin/login
2. Go to **Admin Management** (in the sidebar)
3. Click **Add Admin**
4. Fill in the form and submit
5. The new admin will be created automatically

---

## Password Reset

If you forget your admin password:

1. Go to http://localhost:8080/admin/login
2. Click **Forgot password?**
3. Enter your admin email
4. Check your email for a password reset link
5. Click the link and set a new password

---

## Notes

- Make sure to change the email and password to your actual admin credentials in Step 2
- The first admin must be created manually via Supabase SQL Editor
- After the first admin exists, you can use the app to create more admins
- Admin passwords are hashed using bcrypt for security
