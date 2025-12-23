-- Create app_role enum for role management
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create investment_plans table
CREATE TABLE public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  min_amount NUMERIC NOT NULL,
  max_amount NUMERIC,
  roi_percentage NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  risk_level TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on investment_plans
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;

-- RLS policy: Everyone can view active plans
CREATE POLICY "Anyone can view active plans"
ON public.investment_plans
FOR SELECT
USING (is_active = true);

-- RLS policy: Admins can manage plans
CREATE POLICY "Admins can insert plans"
ON public.investment_plans
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans"
ON public.investment_plans
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for investment_plans updated_at
CREATE TRIGGER update_investment_plans_updated_at
BEFORE UPDATE ON public.investment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add plan_id to investments table
ALTER TABLE public.investments
ADD COLUMN plan_id UUID REFERENCES public.investment_plans(id);

-- RLS policy: Admins can view all investments
CREATE POLICY "Admins can view all investments"
ON public.investments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy: Admins can update all investments
CREATE POLICY "Admins can update all investments"
ON public.investments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy: Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default investment plans
INSERT INTO public.investment_plans (name, description, min_amount, max_amount, roi_percentage, duration_days, risk_level) VALUES
('Starter Plan', 'Perfect for beginners looking to start their investment journey', 1000, 10000, 8, 90, 'low'),
('Growth Plan', 'Balanced plan for steady portfolio growth', 10000, 50000, 12, 180, 'medium'),
('Premium Plan', 'High returns for experienced investors', 50000, 200000, 18, 365, 'high'),
('Elite Plan', 'Exclusive plan with maximum returns', 200000, NULL, 25, 365, 'high');