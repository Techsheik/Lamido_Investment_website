-- Fix search_path for update_settings_timestamp function
DROP TRIGGER IF EXISTS update_platform_settings_timestamp ON public.platform_settings;
DROP FUNCTION IF EXISTS update_settings_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_platform_settings_timestamp
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION update_settings_timestamp();