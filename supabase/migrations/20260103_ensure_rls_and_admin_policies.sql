-- Ensure RLS is enabled on all core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add missing admin policy for investment_plans if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'investment_plans' AND policyname = 'Admins can view all plans'
    ) THEN
        CREATE POLICY "Admins can view all plans"
        ON public.investment_plans
        FOR SELECT
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Fix potentially missing delete policies for admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'investments' AND policyname = 'Admins can delete investments'
    ) THEN
        CREATE POLICY "Admins can delete investments"
        ON public.investments
        FOR DELETE
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
