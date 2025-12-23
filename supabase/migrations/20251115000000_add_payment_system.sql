-- Create virtual_accounts table
CREATE TABLE IF NOT EXISTS public.virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT 'Lamido Bank',
  account_number TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on virtual_accounts
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for virtual_accounts
CREATE POLICY "Users can view own virtual accounts"
  ON public.virtual_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own virtual accounts"
  ON public.virtual_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all virtual accounts
CREATE POLICY "Admins can view all virtual accounts"
  ON public.virtual_accounts
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add reference and virtual_account_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS virtual_account_id UUID REFERENCES public.virtual_accounts(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user_id ON public.virtual_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_account_number ON public.virtual_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_reference ON public.virtual_accounts(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_virtual_account_id ON public.transactions(virtual_account_id);

-- Function to generate fake account number (for testing)
CREATE OR REPLACE FUNCTION public.generate_fake_account_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  account_num TEXT;
BEGIN
  -- Generate a 10-digit account number
  account_num := LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
  
  -- Check if it already exists
  WHILE EXISTS (SELECT 1 FROM public.virtual_accounts WHERE account_number = account_num) LOOP
    account_num := LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
  END LOOP;
  
  RETURN account_num;
END;
$$;

-- Function to create virtual account
CREATE OR REPLACE FUNCTION public.create_virtual_account(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number TEXT;
  v_reference TEXT;
  v_account_name TEXT;
  v_virtual_account_id UUID;
  v_profile_name TEXT;
BEGIN
  -- Get user's name
  SELECT name INTO v_profile_name
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF v_profile_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Check if user already has an active virtual account
  SELECT id INTO v_virtual_account_id
  FROM public.virtual_accounts
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
  
  -- If account exists, return it
  IF v_virtual_account_id IS NOT NULL THEN
    SELECT 
      json_build_object(
        'id', id,
        'account_number', account_number,
        'bank_name', bank_name,
        'account_name', account_name,
        'reference', reference,
        'status', status
      )
    INTO v_reference
    FROM public.virtual_accounts
    WHERE id = v_virtual_account_id;
    
    RETURN v_reference;
  END IF;
  
  -- Generate new account number
  v_account_number := public.generate_fake_account_number();
  
  -- Generate reference
  v_reference := 'LAMIDO-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || p_user_id::TEXT) FROM 1 FOR 12));
  
  -- Set account name
  v_account_name := UPPER(REPLACE(v_profile_name, ' ', ''));
  
  -- Create virtual account
  INSERT INTO public.virtual_accounts (
    user_id,
    bank_name,
    account_number,
    account_name,
    reference,
    status
  ) VALUES (
    p_user_id,
    'Lamido Bank',
    v_account_number,
    v_account_name,
    v_reference,
    'active'
  ) RETURNING id INTO v_virtual_account_id;
  
  -- Create pending deposit transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    reference,
    virtual_account_id
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'pending',
    v_reference,
    v_virtual_account_id
  );
  
  -- Return virtual account details
  RETURN json_build_object(
    'id', v_virtual_account_id,
    'account_number', v_account_number,
    'bank_name', 'Lamido Bank',
    'account_name', v_account_name,
    'reference', v_reference,
    'status', 'active'
  );
END;
$$;

-- Function to process payment webhook (for testing, can be updated for real integration)
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_reference TEXT,
  p_status TEXT,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_user_id UUID;
  v_transaction_amount NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Find transaction by reference
  SELECT id, user_id, amount INTO v_transaction_id, v_user_id, v_transaction_amount
  FROM public.transactions
  WHERE reference = p_reference AND type = 'deposit'
  LIMIT 1;
  
  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- Use provided amount or transaction amount
  IF p_amount IS NOT NULL THEN
    v_transaction_amount := p_amount;
  END IF;
  
  -- Update transaction status
  UPDATE public.transactions
  SET 
    status = p_status,
    date = CASE WHEN p_status = 'completed' THEN now() ELSE date END
  WHERE id = v_transaction_id;
  
  -- If payment successful, update user balance
  IF p_status = 'completed' THEN
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Update balance
    UPDATE public.profiles
    SET balance = COALESCE(v_current_balance, 0) + v_transaction_amount
    WHERE id = v_user_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'status', p_status
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_virtual_account(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, TEXT, NUMERIC) TO authenticated;

