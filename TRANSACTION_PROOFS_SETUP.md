# Transaction Proofs Feature Setup

## Overview
This feature allows users to upload payment receipts (PDF or images) with their payment proof, and allows admins to review and approve/reject them.

## What Changed

### Frontend Changes
1. **Payment.tsx**
   - Displays Transaction ID from the latest transaction
   - Added file upload input for receipts (PDF/JPG)
   - Shows file preview before submission
   - Transaction proof and file are submitted together

2. **New Admin Page: AdminTransactionProofs.tsx**
   - Lists all uploaded proofs with user information
   - Download button to view receipts
   - Approve/Reject buttons for pending proofs
   - Status badges showing proof status

3. **Admin Sidebar**
   - Added "Transaction Proofs" menu item

## Required Setup Steps

### Step 1: Run Database Migration
Go to Supabase SQL Editor and run:

```sql
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_user_id ON public.transaction_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_status ON public.transaction_proofs(status);
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_reference ON public.transaction_proofs(reference);
```

### Step 2: Create Storage Bucket
Go to Supabase Dashboard → Storage and create a new bucket:
- **Bucket name**: `transaction-proofs`
- **Make it private**: Yes (uncheck public)

### Step 3: Set Storage Policies
Go to Storage → transaction-proofs bucket → Policies and add:

```sql
-- Users can upload their own files
CREATE POLICY "Users can upload their own proofs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'transaction-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own files
CREATE POLICY "Users can read their own proofs"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'transaction-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all files
CREATE POLICY "Admins can read all proofs"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'transaction-proofs'
    AND public.has_role(auth.uid(), 'admin'::text)
  );
```

## User Flow

1. User goes to **Payment** page
2. Sees their **Transaction ID** (can copy it)
3. Transfers money to bank account
4. Takes screenshot of receipt
5. **Uploads receipt file** (PDF or JPG)
6. **Provides payment details** (optional text description)
7. Clicks **Submit Proof**
8. File is uploaded and proof record is created

## Admin Flow

1. Admin goes to **Admin Panel** → **Transaction Proofs**
2. Sees table of all submitted proofs
3. Can **download** receipt files to review
4. Clicks **Approve** if payment is valid
   - Sets status to "approved"
   - Updates associated transaction status to "completed"
5. Or clicks **Reject** if payment is invalid
   - Sets status to "rejected"

## File Format Support
- PDF (.pdf)
- JPEG (.jpg, .jpeg)
- PNG (.png)
- Maximum file size: 5MB

## Status Flow
- `pending` → Initial state when proof is uploaded
- `approved` → Admin approved the payment
- `rejected` → Admin rejected the payment
