/**
 * GET /api/admin/get-cycles
 *
 * Returns current cycle state, entry window info, and eligible investments.
 *
 * CRITICAL CHANGES from previous version:
 *  - NO auto-creation of cycles (cycles only exist via admin open-entry)
 *  - NO auto-creation of next cycle after finalization
 *  - Reads from investment_cycles DB table (not JSON blob in platform_settings)
 *  - Auto-detects ACTIVE -> DUE transition when end time has passed
 *  - Returns current entry window status
 */

import { createClient } from "@supabase/supabase-js";
import { getCycleDurationMs, isDevAcceleratedMode } from "./cycle-config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration: missing Supabase credentials" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const cycleDurationMs = getCycleDurationMs();
    const isDevMode = isDevAcceleratedMode();

    // 1. Fetch all cycles ordered by cycle_number
    const { data: allCycles, error: cyclesErr } = await supabaseAdmin
      .from("investment_cycles")
      .select("*")
      .order("cycle_number", { ascending: false });

    // If the table doesn't exist yet (migration not applied), return a clean pending state
    if (cyclesErr) {
      const isMissingTable = cyclesErr.code === "PGRST205" || cyclesErr.message?.includes("schema cache");
      if (isMissingTable) {
        console.warn("[get-cycles] Tables not migrated yet — returning empty state");
        return res.status(200).json({
          systemState: {
            code: "NO_CYCLE",
            label: "Migration Pending",
            description: "⚠️ Database migration not applied yet. Run migration.sql in Supabase SQL Editor.",
            canOpenEntry: false,
            canCloseEntry: false,
            canStartCycle: false,
            canEnterProfit: false,
            migrationPending: true,
          },
          isDevMode,
          cycleDurationMs,
          activeCycle: null,
          currentEntry: null,
          eligibleInvestments: [],
          pendingInvestments: [],
          approvedInvestments: [],
          cycles: [],
          distributions: [],
          counts: { pending: 0, approved: 0, eligible: 0, totalEligibleUnits: 0, totalEligibleAmount: 0 }
        });
      }
      throw cyclesErr;
    }

    const cycles = allCycles || [];

    // 2. Find current active/in-progress cycle
    // Priority order: ACTIVE > DUE > SETTLING > ENTRY_OPEN > ENTRY_CLOSED > READY_TO_START
    let currentCycle = cycles.find(c => c.status === "ACTIVE") ||
                       cycles.find(c => c.status === "DUE") ||
                       cycles.find(c => c.status === "AWAITING_PROFIT") ||  // legacy
                       cycles.find(c => c.status === "SETTLING") ||
                       cycles.find(c => c.status === "CALCULATED") ||       // legacy
                       cycles.find(c => c.status === "ENTRY_OPEN") ||
                       cycles.find(c => c.status === "ENTRY_CLOSED") ||
                       cycles.find(c => c.status === "READY_TO_START") ||
                       cycles.find(c => c.status === "FINALIZED") ||        // ← include so we can show "Open Next Entry" button
                       null;

    // 3. Auto-detect ACTIVE -> DUE transition (server-side only, no client needed)
    if (currentCycle && currentCycle.status === "ACTIVE") {
      const endTime = new Date(currentCycle.cycle_end_at || currentCycle.end_date).getTime();
      if (Date.now() >= endTime) {
        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("investment_cycles")
          .update({ status: "DUE", updated_at: nowIso })
          .eq("id", currentCycle.id);
        currentCycle = { ...currentCycle, status: "DUE" };

        // Also mark active investments as completed for this cycle
        await supabaseAdmin
          .from("investments")
          .update({ status: "completed" })
          .eq("status", "active")
          .not("entry_id", "is", null);
      }
    }

    // 4. Fetch current entry window
    const { data: currentEntry } = await supabaseAdmin
      .from("entry_windows")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Fetch investments for current cycle/entry
    let eligibleInvestments = [];
    let nextEntryInvestments = [];
    let pendingInvestments = [];
    let approvedInvestments = [];

    if (currentCycle && currentEntry) {
      // Investments in the current entry
      const { data: entryInvestments } = await supabaseAdmin
        .from("investments")
        .select(`
          *,
          profiles:user_id(id, name, email, user_code, balance)
        `)
        .eq("entry_id", currentEntry.id)
        .order("created_at", { ascending: true });

      const allEntryInvs = entryInvestments || [];

      // Eligible = ONLY approved + active investments
      // Pending investments must NOT appear in the eligible list — they haven't been approved yet
      eligibleInvestments = allEntryInvs.filter(i =>
        i.status === "active" || i.status === "completed"
      );
      // Approved but awaiting cycle start — shown separately, not in eligible
      approvedInvestments = allEntryInvs.filter(i => i.status === "approved");
      pendingInvestments  = allEntryInvs.filter(i => i.status === "pending");
    } else if (currentEntry) {
      // Entry window exists but no cycle row linked yet — fetch investments by entry
      const { data: entryInvestments } = await supabaseAdmin
        .from("investments")
        .select(`*, profiles:user_id(id, name, email, user_code, balance)`)
        .eq("entry_id", currentEntry.id)
        .order("created_at", { ascending: true });

      const allEntryInvs = entryInvestments || [];
      pendingInvestments  = allEntryInvs.filter(i => i.status === "pending");
      approvedInvestments = allEntryInvs.filter(i => i.status === "approved");
      // No eligible investments until cycle is ACTIVE
    }

    // 6. Fetch cycle_distributions for the current cycle
    let distributions = [];
    if (currentCycle) {
      const { data: dists } = await supabaseAdmin
        .from("cycle_distributions")
        .select("*")
        .eq("cycle_id", currentCycle.id);
      distributions = dists || [];
    }

    // 7. Compute totals
    const totalEligibleUnits = eligibleInvestments.reduce(
      (sum, inv) => sum + (Number(inv.units) || 1), 0
    );
    const totalEligibleAmount = eligibleInvestments.reduce(
      (sum, inv) => sum + Number(inv.amount), 0
    );

    // 8. System state summary for admin UI
    const systemState = deriveSystemState(currentCycle, currentEntry);

    return res.status(200).json({
      // System state
      systemState,
      isDevMode,
      cycleDurationMs,

      // Current cycle (can be null if no cycle exists yet)
      activeCycle: currentCycle ? {
        ...currentCycle,
        eligible_units: currentCycle.status === "ACTIVE"
          ? (currentCycle.eligible_units || totalEligibleUnits)
          : totalEligibleUnits,
        eligible_amount: currentCycle.status === "ACTIVE"
          ? (currentCycle.eligible_amount || totalEligibleAmount)
          : totalEligibleAmount,
        eligible_investments_count: eligibleInvestments.length
      } : null,

      // Entry window
      currentEntry,

      // Investment lists
      eligibleInvestments: eligibleInvestments.map(mapInvestment),
      pendingInvestments: pendingInvestments.map(mapInvestment),
      approvedInvestments: approvedInvestments.map(mapInvestment),

      // All cycles (for history tab)
      cycles,

      // Distributions for current cycle
      distributions,

      // Counts
      counts: {
        pending: pendingInvestments.length,
        approved: approvedInvestments.length,
        eligible: eligibleInvestments.length,
        totalEligibleUnits,
        totalEligibleAmount
      }
    });

  } catch (err) {
    console.error("Error in get-cycles handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Derives a human-readable system state for the admin UI.
 * This is the single source of truth for what state the system is in.
 */
function deriveSystemState(cycle, entry) {
  const status = cycle?.status;

  if (status === "FINALIZED") {
    return {
      code: "FINALIZED",
      label: "Cycle Finalized — Ready for Next Entry",
      description: "All distributions complete. Open the next entry window to begin a new cycle.",
      canOpenEntry: true,
      canCloseEntry: false,
      canStartCycle: false,
      canEnterProfit: false
    };
  }

  if (!cycle && !entry) {
    return {
      code: "NO_CYCLE",
      label: "No Active System",
      description: "No entry window or cycle exists. Open an entry window to begin.",
      canOpenEntry: true,
      canCloseEntry: false,
      canStartCycle: false,
      canEnterProfit: false
    };
  }

  if (status === "ENTRY_OPEN") {
    return {
      code: "ENTRY_OPEN",
      label: "Entry Window Open",
      description: "Investors can submit investments. Close the entry when ready.",
      canOpenEntry: false,
      canCloseEntry: true,
      canStartCycle: false,
      canEnterProfit: false
    };
  }

  if (status === "ENTRY_CLOSED" || status === "READY_TO_START") {
    return {
      code: "ENTRY_CLOSED",
      label: "Entry Closed — Awaiting Cycle Start",
      description: "Entry is closed. Approve investments and start the cycle, or re-open entry window.",
      canOpenEntry: true,
      canCloseEntry: false,
      canStartCycle: true,
      canEnterProfit: false
    };
  }

  if (status === "ACTIVE") {
    return {
      code: "ACTIVE",
      label: "Cycle Active",
      description: "The investment cycle is running. Wait for it to complete.",
      canOpenEntry: false,
      canCloseEntry: false,
      canStartCycle: false,
      canEnterProfit: false
    };
  }

  if (status === "DUE" || status === "AWAITING_PROFIT") {
    return {
      code: "DUE",
      label: "Cycle Due — Enter Profit",
      description: "The cycle has completed. Enter the community profit to calculate distributions.",
      canOpenEntry: false,
      canCloseEntry: false,
      canStartCycle: false,
      canEnterProfit: true
    };
  }

  if (status === "SETTLING" || status === "CALCULATED") {
    return {
      code: "SETTLING",
      label: "Settlement in Progress",
      description: "Profit calculated. Review distribution preview, then finalize.",
      canOpenEntry: false,
      canCloseEntry: false,
      canStartCycle: false,
      canEnterProfit: true
    };
  }

  // Fallback — no known cycle, entry exists
  if (!cycle && entry) {
    return {
      code: "NO_CYCLE",
      label: "Entry Window Open",
      description: "Entry window is open. Investments can be submitted.",
      canOpenEntry: false,
      canCloseEntry: true,
      canStartCycle: false,
      canEnterProfit: false
    };
  }

  return {
    code: "UNKNOWN",
    label: "Unknown State",
    description: `System is in an unexpected state: ${status}`,
    canOpenEntry: false,
    canCloseEntry: false,
    canStartCycle: false,
    canEnterProfit: false
  };
}

function mapInvestment(inv) {
  return {
    id: inv.id,
    user_id: inv.user_id,
    user_name: inv.profiles?.name || "Unknown",
    user_code: inv.profiles?.user_code || "N/A",
    units: inv.units || 1,
    amount: Number(inv.amount),
    type: inv.type,
    status: inv.status,
    entry_id: inv.entry_id,
    created_at: inv.created_at,
    start_date: inv.start_date,
    end_date: inv.end_date
  };
}
