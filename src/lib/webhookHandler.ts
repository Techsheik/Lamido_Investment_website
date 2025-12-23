import { processPaymentWebhook } from "./paymentService";

/**
 * Webhook handler for payment processing
 * This can be integrated with Flutterwave or Monnify webhooks
 * 
 * For Supabase Edge Function, create a function at:
 * supabase/functions/payment-webhook/index.ts
 * 
 * For external webhook endpoint, use this function in your backend API route
 */
export async function handlePaymentWebhook(
  payload: {
    reference: string;
    status: 'completed' | 'failed' | 'pending';
    amount?: number;
    // Additional fields from payment provider
    [key: string]: any;
  }
) {
  try {
    // Validate required fields
    if (!payload.reference) {
      throw new Error('Reference is required');
    }

    if (!payload.status) {
      throw new Error('Status is required');
    }

    // Process the webhook
    const result = await processPaymentWebhook(
      payload.reference,
      payload.status,
      payload.amount
    );

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Example webhook handler for Flutterwave
 * 
 * Flutterwave webhook payload structure:
 * {
 *   "event": "charge.completed",
 *   "data": {
 *     "tx_ref": "reference",
 *     "status": "successful",
 *     "amount": 1000
 *   }
 * }
 */
export async function handleFlutterwaveWebhook(payload: any) {
  try {
    if (payload.event === 'charge.completed' && payload.data) {
      const { tx_ref, status, amount } = payload.data;
      
      const webhookStatus = status === 'successful' ? 'completed' : 'failed';
      
      return await handlePaymentWebhook({
        reference: tx_ref,
        status: webhookStatus,
        amount: amount
      });
    }

    return { success: false, error: 'Unhandled event type' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Example webhook handler for Monnify
 * 
 * Monnify webhook payload structure:
 * {
 *   "eventType": "SUCCESSFUL_TRANSACTION",
 *   "eventData": {
 *     "transactionReference": "reference",
 *     "amountPaid": "1000.00",
 *     "paymentStatus": "PAID"
 *   }
 * }
 */
export async function handleMonnifyWebhook(payload: any) {
  try {
    if (payload.eventType === 'SUCCESSFUL_TRANSACTION' && payload.eventData) {
      const { transactionReference, amountPaid, paymentStatus } = payload.eventData;
      
      const webhookStatus = paymentStatus === 'PAID' ? 'completed' : 'failed';
      const amount = parseFloat(amountPaid);
      
      return await handlePaymentWebhook({
        reference: transactionReference,
        status: webhookStatus,
        amount: amount
      });
    }

    return { success: false, error: 'Unhandled event type' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

