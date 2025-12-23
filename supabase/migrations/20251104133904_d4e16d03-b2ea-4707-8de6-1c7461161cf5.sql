-- Add balance column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN balance numeric DEFAULT 0 NOT NULL;

-- Add RLS policies for admin to delete records
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete investments"
ON public.investments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update existing admin policies to allow all operations
CREATE POLICY "Admins can insert investments"
ON public.investments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Add index for better performance on balance lookups
CREATE INDEX idx_profiles_balance ON public.profiles(balance);