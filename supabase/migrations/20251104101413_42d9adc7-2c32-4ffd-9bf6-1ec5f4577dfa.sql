-- Add user_code column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN user_code TEXT UNIQUE;

-- Create function to generate user code
CREATE OR REPLACE FUNCTION public.generate_user_code(
  p_full_name TEXT,
  p_signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initials TEXT;
  v_date_part TEXT;
  v_serial_number INTEGER;
  v_user_code TEXT;
BEGIN
  -- Extract first two letters of full name (uppercase)
  v_initials := UPPER(LEFT(REGEXP_REPLACE(p_full_name, '[^a-zA-Z]', '', 'g'), 2));
  
  -- Format date as DDMMYY
  v_date_part := TO_CHAR(p_signup_date, 'DDMMYY');
  
  -- Get serial number (count of existing profiles + 1)
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_serial_number FROM public.profiles;
  
  -- Combine to create user code
  v_user_code := v_initials || v_date_part || LPAD(v_serial_number::TEXT, 2, '0');
  
  RETURN v_user_code;
END;
$$;

-- Update the handle_new_user function to generate user code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_user_code TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  v_user_code := public.generate_user_code(v_full_name, NOW());
  
  INSERT INTO public.profiles (
    id, 
    name, 
    email,
    first_name,
    surname,
    middle_name,
    phone,
    country,
    state,
    lga,
    user_code
  )
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    COALESCE(NEW.raw_user_meta_data->>'middle_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    COALESCE(NEW.raw_user_meta_data->>'state', ''),
    COALESCE(NEW.raw_user_meta_data->>'lga', ''),
    v_user_code
  );
  RETURN NEW;
END;
$$;