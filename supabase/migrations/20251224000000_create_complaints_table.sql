-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for complaints
CREATE POLICY "Users can view own complaints"
  ON public.complaints
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create complaints"
  ON public.complaints
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own complaints"
  ON public.complaints
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all complaints
CREATE POLICY "Admins can view all complaints"
  ON public.complaints
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::text));

-- Admins can update all complaints
CREATE POLICY "Admins can update all complaints"
  ON public.complaints
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::text));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at);
