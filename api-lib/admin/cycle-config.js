/**
 * Central Configuration & Business Logic Helpers for Investment Cycles
 */

/**
 * Returns cycle duration in milliseconds.
 * In PRODUCTION (process.env.NODE_ENV === "production"), strictly forces 7 days (604,800,000 ms).
 * In DEVELOPMENT/TESTing, uses CYCLE_DURATION_MINUTES or CYCLE_DURATION_MS if provided in process.env,
 * defaulting to 7 days if unconfigured.
 */
export function getCycleDurationMs() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return 7 * 24 * 60 * 60 * 1000; // Strictly 7 days in production
  }

  // Development & Test Mode Accelerated Duration
  if (process.env.CYCLE_DURATION_MINUTES) {
    const mins = parseFloat(process.env.CYCLE_DURATION_MINUTES);
    if (!isNaN(mins) && mins > 0) {
      return Math.round(mins * 60 * 1000);
    }
  }

  if (process.env.CYCLE_DURATION_MS) {
    const ms = parseInt(process.env.CYCLE_DURATION_MS, 10);
    if (!isNaN(ms) && ms > 0) {
      return ms;
    }
  }

  // Fallback default in development if env var is not set
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
