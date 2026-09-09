export const DEFAULT_USD_NGN_RATE = 1550; // Default exchange rate: ₦1,550 per $1 USD

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatNGN(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function convertUSDToNGN(usdAmount: number, rate: number = DEFAULT_USD_NGN_RATE): number {
  return (usdAmount || 0) * (rate || DEFAULT_USD_NGN_RATE);
}
