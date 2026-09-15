/**
 * Central Configuration & Business Logic Helpers for Investment Cycles
 */

/**
 * Returns cycle duration in milliseconds.
 * ALWAYS returns 7 days (604,800,000 ms).
 * The CYCLE_DURATION_MINUTES override has been permanently removed
 * to prevent accidental short cycles in production.
 */
export function getCycleDurationMs() {
  // 7 days — fixed, no override
  return 7 * 24 * 60 * 60 * 1000;
}


/**
 * Checks whether the environment is currently running in Development/Test Accelerated Mode
 */
export function isDevAcceleratedMode() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) return false;

  const durationMs = getCycleDurationMs();
  return durationMs < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Calculates Profit Per Share Unit (PPSU)
 */
export function calculatePPSU(communityProfit, eligibleUnits) {
  const profitNum = Number(communityProfit);
  const unitsNum = Number(eligibleUnits);

  if (isNaN(profitNum) || profitNum < 0) {
    throw new Error("Community profit must be a valid non-negative number");
  }

  if (isNaN(unitsNum) || unitsNum <= 0) {
    throw new Error("Total eligible units must be greater than zero");
  }

  const rawPpsu = profitNum / unitsNum;
  // Round to 2 decimal places (cents)
  const roundedPpsu = Math.round(rawPpsu * 100) / 100;

  return {
    rawPpsu,
    roundedPpsu
  };
}

/**
 * Calculates profit and total return for an investor investment based on share units
 */
export function calculateInvestorProfit(units, amount, ppsu) {
  const invUnits = Number(units) || 1;
  const invAmount = Number(amount) || 0;
  const rawProfit = invUnits * ppsu;
  
  // Exact 2-decimal rounding (cents)
  const profit = Math.round(rawProfit * 100) / 100;
  const totalReturn = Math.round((invAmount + profit) * 100) / 100;

  return {
    units: invUnits,
    investmentAmount: invAmount,
    profit,
    totalReturn
  };
}
