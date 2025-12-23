import { supabase } from "@/integrations/supabase/client";

export interface VirtualAccount {
  id: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  reference: string;
  status: string;
}

/**
 * Create or fetch virtual account for user
 * This function is structured to easily integrate with Flutterwave or Monnify later
 */
export async function createVirtualAccount(
  userId: string,
  amount: number
): Promise<VirtualAccount> {
  try {
    // Call database function to create virtual account
    const { data, error } = await supabase.rpc('create_virtual_account', {
      p_user_id: userId,
      p_amount: amount
    });

    if (error) throw error;

    return data as VirtualAccount;
  } catch (error: any) {
    console.error('Error creating virtual account:', error);
    throw new Error(error.message || 'Failed to create virtual account');
  }
}

/**
 * Process payment webhook
 * This function is structured to easily integrate with Flutterwave or Monnify webhooks
 */
export async function processPaymentWebhook(
  reference: string,
  status: 'completed' | 'failed' | 'pending',
  amount?: number
): Promise<{ success: boolean; transaction_id: string; status: string }> {
  try {
    const { data, error } = await supabase.rpc('process_payment_webhook', {
      p_reference: reference,
      p_status: status,
      p_amount: amount || null
    });

    if (error) throw error;

    return data;
  } catch (error: any) {
    console.error('Error processing payment webhook:', error);
    throw new Error(error.message || 'Failed to process payment webhook');
  }
}

/**
 * Get user's virtual account
 */
export async function getUserVirtualAccount(userId: string): Promise<VirtualAccount | null> {
  try {
    const { data, error } = await supabase
      .from('virtual_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

    return data;
  } catch (error: any) {
    console.error('Error fetching virtual account:', error);
    return null;
  }
}

/**
 * Get transaction by reference
 */
export async function getTransactionByReference(reference: string) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (error) throw error;

    return data;
  } catch (error: any) {
    console.error('Error fetching transaction:', error);
    return null;
  }
}

/**
 * TODO: Integrate with Flutterwave
 * Example structure for Flutterwave integration:
 * 
 * export async function createFlutterwaveVirtualAccount(userId: string, amount: number) {
 *   const response = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
 *     method: 'POST',
 *     headers: {
 *       'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify({
 *       email: userEmail,
 *       is_permanent: true,
 *       bvn: userBvn
 *     })
 *   });
 *   return response.json();
 * }
 */

/**
 * TODO: Integrate with Monnify
 * Example structure for Monnify integration:
 * 
 * export async function createMonnifyVirtualAccount(userId: string, amount: number) {
 *   const response = await fetch('https://api.monnify.com/api/v2/bank-transfer/reserved-accounts', {
 *     method: 'POST',
 *     headers: {
 *       'Authorization': `Bearer ${MONNIFY_API_KEY}`,
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify({
 *       accountReference: reference,
 *       accountName: accountName,
 *       currencyCode: 'NGN',
 *       contractCode: MONNIFY_CONTRACT_CODE
 *     })
 *   });
 *   return response.json();
 * }
 */

