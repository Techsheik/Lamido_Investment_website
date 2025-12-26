ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weekly_roi_percentage DECIMAL(5, 2) DEFAULT 10.00 NOT NULL;

UPDATE public.profiles SET weekly_roi_percentage = 10.00 WHERE weekly_roi_percentage IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_weekly_roi_percentage ON public.profiles(weekly_roi_percentage);
