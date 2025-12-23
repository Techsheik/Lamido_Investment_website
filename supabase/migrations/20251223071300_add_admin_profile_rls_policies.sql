-- Add RLS policies to allow admins to create and update profiles
-- This fixes the "new row violates row-level security policy" error when creating new admin accounts

-- Policy: Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
