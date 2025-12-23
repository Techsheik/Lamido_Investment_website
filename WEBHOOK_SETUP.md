# Payment Webhook Setup Guide

This document explains how to set up webhooks for payment processing with Flutterwave or Monnify.

## Database Functions

The payment system uses Supabase database functions:
- `create_virtual_account(user_id, amount)` - Creates a virtual account
- `process_payment_webhook(reference, status, amount)` - Processes payment webhooks

## Webhook Handler Options

### Option 1: Supabase Edge Function (Recommended)

Create a Supabase Edge Function at `supabase/functions/payment-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    
    // Verify webhook signature (important for production)
    // const signature = req.headers.get('x-flutterwave-signature')
    // verifySignature(payload, signature)
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Process webhook
    const { data, error } = await supabaseClient.rpc('process_payment_webhook', {
      p_reference: payload.data.tx_ref, // Flutterwave
      p_status: payload.data.status === 'successful' ? 'completed' : 'failed',
      p_amount: payload.data.amount
    })
    
    if (error) throw error
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
```

Deploy the function:
```bash
supabase functions deploy payment-webhook
```

### Option 2: External API Endpoint

If using a separate backend (Node.js, Python, etc.), create an endpoint:

**Node.js/Express Example:**
```javascript
app.post('/api/payments/webhook', async (req, res) => {
  try {
    const payload = req.body;
    
    // Verify webhook signature
    // verifyFlutterwaveSignature(payload, req.headers['x-flutterwave-signature']);
    
    // Process webhook using Supabase client
    const { data, error } = await supabase.rpc('process_payment_webhook', {
      p_reference: payload.data.tx_ref,
      p_status: payload.data.status === 'successful' ? 'completed' : 'failed',
      p_amount: payload.data.amount
    });
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Flutterwave Integration

1. **Get your webhook URL:**
   - Supabase Edge Function: `https://your-project.supabase.co/functions/v1/payment-webhook`
   - External API: `https://your-domain.com/api/payments/webhook`

2. **Configure in Flutterwave Dashboard:**
   - Go to Settings > Webhooks
   - Add webhook URL
   - Select events: `charge.completed`, `charge.failed`

3. **Webhook Payload Structure:**
```json
{
  "event": "charge.completed",
  "data": {
    "tx_ref": "LAMIDO-ABC123XYZ",
    "status": "successful",
    "amount": 1000,
    "currency": "NGN"
  }
}
```

## Monnify Integration

1. **Get your webhook URL** (same as above)

2. **Configure in Monnify Dashboard:**
   - Go to Settings > Webhooks
   - Add webhook URL
   - Select events: `SUCCESSFUL_TRANSACTION`, `FAILED_TRANSACTION`

3. **Webhook Payload Structure:**
```json
{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "eventData": {
    "transactionReference": "LAMIDO-ABC123XYZ",
    "amountPaid": "1000.00",
    "paymentStatus": "PAID"
  }
}
```

## Testing Webhooks

### Manual Testing

You can manually trigger webhook processing using the `processPaymentWebhook` function:

```typescript
import { processPaymentWebhook } from '@/lib/paymentService';

// Simulate successful payment
await processPaymentWebhook('LAMIDO-ABC123XYZ', 'completed', 1000);

// Simulate failed payment
await processPaymentWebhook('LAMIDO-ABC123XYZ', 'failed', 1000);
```

### Using Flutterwave Test Mode

1. Use Flutterwave test credentials
2. Make a test payment
3. Check webhook logs in Flutterwave dashboard
4. Verify transaction status in admin panel

## Security Considerations

1. **Verify Webhook Signatures:**
   - Always verify webhook signatures to ensure requests are from the payment provider
   - Use HMAC verification with your webhook secret

2. **Idempotency:**
   - The webhook handler checks transaction status before processing
   - Prevents duplicate processing

3. **Error Handling:**
   - Log all webhook events
   - Implement retry logic for failed webhooks
   - Send alerts for critical failures

## Current Implementation

The current implementation uses fake account numbers for testing. To integrate with real payment providers:

1. Update `create_virtual_account` function to call Flutterwave/Monnify API
2. Store real account details in `virtual_accounts` table
3. Set up webhook endpoints as described above
4. Test thoroughly in sandbox/test mode before going live

