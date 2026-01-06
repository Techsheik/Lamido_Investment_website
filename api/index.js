import createInvestorHandler from "../api-lib/admin/create-investor.js";
import getInvestmentsHandler from "../api-lib/admin/get-investments.js";
import updateInvestmentStatusHandler from "../api-lib/admin/update-investment-status.js";
import editInvestorHandler from "../api-lib/admin/edit-investor.js";
import deleteInvestorHandler from "../api-lib/admin/delete-investor.js";
import getTransactionsHandler from "../api-lib/admin/get-transactions.js";
import updateTransactionStatusHandler from "../api-lib/admin/update-transaction-status.js";
import getUsersHandler from "../api-lib/admin/get-users.js";
import deleteUserHandler from "../api-lib/admin/delete-user.js";
import getStatsHandler from "../api-lib/admin/get-stats.js";
import updateUserHandler from "../api-lib/admin/update-user.js";
import bulkActivateInvestmentsHandler from "../api-lib/admin/bulk-activate-investments.js";
import announcementsHandler from "../api-lib/admin/announcements.js";
import createAdminHandler from "../api-lib/admin/create-admin.js";
import createUserHandler from "../api-lib/admin/create-user.js";
import deletePlanHandler from "../api-lib/admin/delete-plan.js";
import getPlansHandler from "../api-lib/admin/get-plans.js";
import getUserDetailHandler from "../api-lib/admin/get-user-detail.js";
import manageAdminsHandler from "../api-lib/admin/manage-admins.js";
import updateInvestmentHandler from "../api-lib/admin/update-investment.js";
import updatePlanHandler from "../api-lib/admin/update-plan.js";

const routes = {
  "GET": {
    "/api/admin/get-investments": getInvestmentsHandler,
    "/api/admin/get-transactions": getTransactionsHandler,
    "/api/admin/get-users": getUsersHandler,
    "/api/admin/get-stats": getStatsHandler,
    "/api/admin/get-plans": getPlansHandler,
    "/api/admin/get-user-detail": getUserDetailHandler,
    "/api/admin/manage-admins": manageAdminsHandler,
  },
  "POST": {
    "/api/admin/create-investor": createInvestorHandler,
    "/api/admin/update-investment-status": updateInvestmentStatusHandler,
    "/api/admin/edit-investor": editInvestorHandler,
    "/api/admin/delete-investor": deleteInvestorHandler,
    "/api/admin/update-transaction-status": updateTransactionStatusHandler,
    "/api/admin/delete-user": deleteUserHandler,
    "/api/admin/update-user": updateUserHandler,
    "/api/admin/bulk-activate-investments": bulkActivateInvestmentsHandler,
    "/api/admin/announcements": announcementsHandler,
    "/api/admin/create-admin": createAdminHandler,
    "/api/admin/create-user": createUserHandler,
    "/api/admin/delete-plan": deletePlanHandler,
    "/api/admin/update-investment": updateInvestmentHandler,
    "/api/admin/update-plan": updatePlanHandler,
  }
};

export default async function handler(req, res) {
  // Extract path without query parameters
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  console.log(`[API] ${method} ${pathname}`);

  if (pathname === "/api/health") {
    return res.status(200).json({ status: "ok" });
  }

  const handler = routes[method]?.[pathname];

  if (handler) {
    try {
      // In Vercel, query and body are already parsed for us in most cases
      // but we ensure req.query is available for compatibility
      if (!req.query) {
        const query = {};
        url.searchParams.forEach((value, key) => { query[key] = value; });
        req.query = query;
      }
      
      return await handler(req, res);
    } catch (err) {
      console.error(`Handler error at ${pathname}:`, err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }

  console.warn(`[API] 404: Route not found: ${method} ${pathname}`);
  return res.status(404).json({ error: `API route not found: ${method} ${pathname}` });
}
