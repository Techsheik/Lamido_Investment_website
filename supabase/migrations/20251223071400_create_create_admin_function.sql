-- Create function to allow admins to create new admin profiles
-- This function runs with SECURITY DEFINER to bypass RLS checks

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
  -- Check if current user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create new admin profiles';
  END IF;
  
  -- Insert the profile
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_admin_profile(UUID, TEXT, TEXT) TO authenticated;
