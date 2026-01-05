-- Add missing columns to profiles table to support admin management features
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_roi NUMERIC DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS roi_percentage NUMERIC DEFAULT 0 NOT NULL;

-- Ensure RLS is enabled for profiles (it should be, but let's be safe)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Re-verify or add admin policies for profiles if they are missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
    ) THEN
        CREATE POLICY "Admins can view all profiles"
        ON public.profiles
        FOR SELECT
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can update all profiles'
    ) THEN
        CREATE POLICY "Admins can update all profiles"
        ON public.profiles
        FOR UPDATE
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
