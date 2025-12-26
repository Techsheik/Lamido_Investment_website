-- Add referral_code to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE NOT NULL DEFAULT '';

-- Create referrals table to track referral relationships
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referree_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_amount NUMERIC DEFAULT 1000,
  reward_given BOOLEAN DEFAULT false,
  reward_given_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referrer_id, referree_id)
);

-- Enable RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referree_id);

CREATE POLICY "Anyone can create referrals"
  ON public.referrals
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all referrals"
  ON public.referrals
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update referrals"
  ON public.referrals
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referree_id ON public.referrals(referree_id);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_given ON public.referrals(reward_given);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_user_email TEXT;
  v_counter INT := 0;
BEGIN
  SELECT email INTO v_user_email FROM public.profiles WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  v_code := UPPER(SUBSTRING(SPLIT_PART(v_user_email, '@', 1), 1, 3)) || 
            LPAD((EXTRACT(EPOCH FROM now())::INT % 10000)::TEXT, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) LOOP
    v_counter := v_counter + 1;
    v_code := UPPER(SUBSTRING(SPLIT_PART(v_user_email, '@', 1), 1, 3)) || 
              LPAD((EXTRACT(EPOCH FROM now())::INT % 10000 + v_counter)::TEXT, 4, '0');
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Function to process referral on user signup
CREATE OR REPLACE FUNCTION public.process_referral(
  p_new_user_id UUID,
  p_referral_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_record_id UUID;
BEGIN
  IF p_referral_code IS NULL OR p_referral_code = '' THEN
    RETURN json_build_object('success', true, 'referral_processed', false, 'message', 'No referral code provided');
  END IF;
  
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Referral code not found');
  END IF;
  
  IF v_referrer_id = p_new_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Cannot use your own referral code');
  END IF;
  
  INSERT INTO public.referrals (referrer_id, referree_id)
  VALUES (v_referrer_id, p_new_user_id)
  RETURNING id INTO v_referral_record_id;
  
  RETURN json_build_object(
    'success', true,
    'referral_processed', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral recorded successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_referral_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral(UUID, TEXT) TO authenticated;

-- Update profiles table to generate referral code for existing users
UPDATE public.profiles
SET referral_code = public.generate_referral_code(id)
WHERE referral_code IS NULL OR referral_code = '';

-- Create trigger to generate referral code for new users
CREATE OR REPLACE FUNCTION public.generate_referral_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code(NEW.id)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_referral_code_trigger ON public.profiles;

CREATE TRIGGER generate_referral_code_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code_on_insert();
