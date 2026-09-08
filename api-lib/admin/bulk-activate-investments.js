/**
 * POST /api/admin/bulk-activate-investments
 *
 * DEPRECATED: This endpoint is no longer supported in the new admin-controlled cycle system.
 *
 * Previously this bulk-activated all pending investments immediately.
 * In the new system, investments are activated ONLY when the admin starts a cycle
 * via POST /api/admin/start-cycle, which:
 *   - Uses the authoritative server timestamp
 *   - Only activates approved investments from the current entry
 *   - Locks eligible_units at cycle start
 *
 * This endpoint now returns a 410 Gone with a helpful message.
 */

export default async function handler(req, res) {
  return res.status(410).json({
    error: "DEPRECATED: Bulk activation is no longer available.",
    message:
      "In the new investment cycle system, investments are activated via the Start Cycle action. " +
      "Workflow: Open Entry → Investors Submit → Close Entry → Admin Approves → " +
      "POST /api/admin/start-cycle → Investments become active with correct 7-day timing.",
    redirectTo: "POST /api/admin/start-cycle"
  });
}
