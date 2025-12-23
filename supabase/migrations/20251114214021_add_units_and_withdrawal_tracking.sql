-- Add units column to investments table
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS units INTEGER DEFAULT 1 NOT NULL;

-- Add last_withdrawal_date to profiles table for tracking weekly withdrawals
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_withdrawal_date TIMESTAMP WITH TIME ZONE;

-- Update investment_plans to have a single unit-based plan
-- First, deactivate all existing plans
UPDATE public.investment_plans SET is_active = false;

-- Insert new unit-based cryptocurrency plan
INSERT INTO public.investment_plans (name, description, min_amount, max_amount, roi_percentage, duration_days, risk_level, is_active) 
VALUES (
  'Cryptocurrency Investment',
  'Invest in cryptocurrency with our unit-based system. $70 = 1 unit. Buy as many units as you want. Withdraw accrued returns weekly.',
  70,
  NULL,
  10,
  7,
  'medium',
  true
) ON CONFLICT DO NOTHING;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_investments_units ON public.investments(units);
CREATE INDEX IF NOT EXISTS idx_profiles_last_withdrawal ON public.profiles(last_withdrawal_date);

