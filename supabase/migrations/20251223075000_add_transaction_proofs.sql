-- Create transaction_proofs table to store uploaded receipts
CREATE TABLE IF NOT EXISTS public.transaction_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  reference TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own proofs"
  ON public.transaction_proofs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload proofs"
  ON public.transaction_proofs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all proofs"
  ON public.transaction_proofs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "Admins can update proofs"
  ON public.transaction_proofs
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::text));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_user_id ON public.transaction_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_status ON public.transaction_proofs(status);
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_reference ON public.transaction_proofs(reference);
