-- Add investment_id to transactions table to track which investment created the transaction
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_investment_id ON public.transactions(investment_id);
