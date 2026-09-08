import https from "https";

// In-memory idempotency cache for immediate process safety
const processedKeys = new Set();

/**
 * Helper to perform robust HTTPS POST request to Resend API using Node.js native https module.
 */
function sendResendHttpRequest({ apiKey, from, to, subject, html }) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html });
    const options = {
      hostname: "api.resend.com",
      port: 443,
      path: "/emails",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, data });
          } else {
            resolve({ ok: false, error: data.message || body });
          }
        } catch (e) {
          resolve({ ok: false, error: body || res.statusMessage });
        }
      });
    });

    req.on("error", (err) => {
      console.error("[EMAIL SERVICE HTTPS ERROR]", err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Generates modern, executive HTML email templates for administrative alerts.
 */
function renderExecutiveEmail({
  categoryTitle,
  subjectHeader,
  statusBadgeText,
  statusBadgeBg,
  statusBadgeColor,
  highlightLabel,
  highlightValue,
  fields = [],
  quoteTitle,
  quoteContent,
  ctaText,
  ctaUrl
}) {
  const fieldRowsHtml = fields.map((f) => `
    <tr>
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 38%;">${f.label}</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${f.value}</td>
    </tr>
  `).join("");

  const quoteHtml = quoteContent ? `
    <div style="margin: 20px 0; padding: 18px 20px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px;">
      <div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${quoteTitle || "User Message"}</div>
      <div style="font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; font-style: italic;">"${quoteContent}"</div>
    </div>
  ` : "";

  const highlightHtml = highlightValue ? `
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 22px 20px; text-align: center; margin: 20px 0;">
      <div style="font-size: 12px; color: #0369a1; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">${highlightLabel}</div>
      <div style="font-size: 34px; font-weight: 800; color: #0f172a; margin-top: 4px;">${highlightValue}</div>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectHeader}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 32px 28px 32px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase;">LAMIDO <span style="color: #38bdf8;">INVESTMENT</span></span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 5px 12px; background-color: ${statusBadgeBg}; color: ${statusBadgeColor}; font-size: 11px; font-weight: 700; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${statusBadgeText}</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 22px 0 6px 0; line-height: 1.3; letter-spacing: -0.2px;">${subjectHeader}</h1>
              <p style="color: #94a3b8; font-size: 13.5px; margin: 0;">${categoryTitle}</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 32px;">
              ${highlightHtml}
              ${quoteHtml}

              <div style="margin-top: 24px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;">Investor & Summary Details</div>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden;">
                  ${fieldRowsHtml}
                </table>
              </div>

              <!-- CTA Button -->
              <div style="margin-top: 32px; text-align: center;">
                <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 700; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(3, 105, 161, 0.3); transition: all 0.2s ease;">${ctaText} &rarr;</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">This is an administrative notification from the Lamido Investment Platform.<br>&copy; 2026 Lamido Investment. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends server-side email notifications to the admin email address using Resend API.
 * Falls back to mock logging if RESEND_API_KEY is not configured.
 * 
 * Enforces idempotency via idempotencyKey (checked in memory and in admin_notifications table).
 * Safe design: Never throws errors that roll back the primary user action.
 *
 * @param {Object} params
 * @param {'WITHDRAWAL_REQUEST'|'COMPLAINT_SUBMITTED'} params.type
 * @param {string} params.referenceId
 * @param {string} params.userId
 * @param {Object} params.metadata
 * @param {string} params.idempotencyKey
 * @param {import("@supabase/supabase-js").SupabaseClient} params.supabaseAdmin
 */
export async function sendAdminEmailNotification({
  type,
  referenceId,
  userId,
  metadata = {},
  idempotencyKey,
  supabaseAdmin
}) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "lamidocryptotradingcommunity@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "Lamido Investment <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL || "http://localhost:8080";

  try {
    // 1. In-memory Idempotency Check
    if (idempotencyKey && processedKeys.has(idempotencyKey)) {
      console.log(`[EMAIL SERVICE] Idempotency check matched in memory (${idempotencyKey}). Skipping duplicate email.`);
      return { success: true, skipped: true, status: "already_processed" };
    }

    // 2. Database Idempotency Check (if admin_notifications table exists)
    if (idempotencyKey && supabaseAdmin) {
      try {
        const { data: existingNotif } = await supabaseAdmin
          .from("admin_notifications")
          .select("id, status")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existingNotif) {
          processedKeys.add(idempotencyKey);
          console.log(`[EMAIL SERVICE] Idempotency check matched in DB (${idempotencyKey}). Skipping duplicate email.`);
          return { success: true, skipped: true, status: existingNotif.status };
        }
      } catch (dbCheckErr) {
        // Table might not exist yet; proceed safely
      }
    }

    // Mark key as seen in memory
    if (idempotencyKey) {
      processedKeys.add(idempotencyKey);
    }

    // 3. Fetch user profile for rich email context
    let userProfile = { name: "Valued User", email: "N/A", phone: "N/A", user_code: "N/A", bank_name: "N/A", bank_account_number: "N/A", account_holder_name: "N/A" };
    if (userId && supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("name, email, phone, user_code, bank_name, bank_account_number, account_number, account_holder_name")
          .eq("id", userId)
          .maybeSingle();
        if (profile) {
          userProfile = {
            ...userProfile,
            ...profile,
            bank_account_number: profile.bank_account_number || profile.account_number || "N/A",
          };
        }
      } catch (pErr) {
        // Fallback to default userProfile
      }
    }

    // 4. Construct Subject and HTML Body based on event type
    let subject = "";
    let htmlBody = "";
    const now = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    if (type === "WITHDRAWAL_REQUEST") {
      const amount = metadata.amount ? `$${Number(metadata.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
      const userCodeStr = userProfile.user_code ? ` [${userProfile.user_code}]` : "";
      subject = `Withdrawal Request: ${amount} by ${userProfile.name}${userCodeStr}`;
      
      const phoneVal = userProfile.phone || metadata.phone || "N/A";
      const bankVal = userProfile.bank_name || metadata.bank_name || "N/A";
      const accNumVal = userProfile.bank_account_number || metadata.account_number || "N/A";
      const accHolderVal = userProfile.account_holder_name || metadata.account_holder_name || userProfile.name;

      htmlBody = renderExecutiveEmail({
        categoryTitle: "Financial Withdrawal Request",
        subjectHeader: `New Withdrawal Request from ${userProfile.name} (${userProfile.user_code || "N/A"})`,
        statusBadgeText: "Pending Review",
        statusBadgeBg: "#fef3c7",
        statusBadgeColor: "#92400e",
        highlightLabel: "Requested Withdrawal Amount",
        highlightValue: amount,
        fields: [
          { label: "Investor Info", value: `<strong style="font-size: 14px; color: #0f172a;">${userProfile.name}</strong> &nbsp;<span style="font-family: monospace; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px;">${userProfile.user_code || "N/A"}</span>` },
          { label: "Email Address", value: userProfile.email },
          { label: "Working Phone", value: `<a href="tel:${phoneVal}" style="color: #0284c7; font-weight: 700; text-decoration: none;">${phoneVal}</a>` },
          { label: "Bank Name", value: bankVal },
          { label: "Account Number", value: `<span style="font-family: monospace; font-weight: 700; font-size: 14px; color: #0f172a;">${accNumVal}</span>` },
          { label: "Account Holder", value: accHolderVal },
          { label: "Payment Method", value: metadata.payment_method || metadata.payment_info || "Bank Transfer" },
          { label: "Reference ID", value: referenceId },
          { label: "Date Submitted", value: now }
        ],
        ctaText: "Review in Admin Portal",
        ctaUrl: `${appUrl}/admin`
      });

    } else if (type === "COMPLAINT_SUBMITTED") {
      const category = (metadata.category || "General").toUpperCase();
      subject = `Support Alert: [${category}] ${metadata.title || "User Complaint"} - ${userProfile.name} (${userProfile.user_code || "N/A"})`;
      
      htmlBody = renderExecutiveEmail({
        categoryTitle: `Customer Support Ticket (${category})`,
        subjectHeader: metadata.title || "New Support Complaint Received",
        statusBadgeText: "Open Ticket",
        statusBadgeBg: "#fee2e2",
        statusBadgeColor: "#991b1b",
        quoteTitle: "User Description / Issue Message",
        quoteContent: metadata.description || "No description provided.",
        fields: [
          { label: "Investor Info", value: `<strong style="font-size: 14px; color: #0f172a;">${userProfile.name}</strong> &nbsp;<span style="font-family: monospace; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px;">${userProfile.user_code || "N/A"}</span>` },
          { label: "Email Address", value: userProfile.email },
          { label: "Working Phone", value: `<a href="tel:${userProfile.phone || 'N/A'}" style="color: #0284c7; font-weight: 700; text-decoration: none;">${userProfile.phone || 'N/A'}</a>` },
          { label: "Category", value: metadata.category || "General" },
          { label: "Ticket ID", value: referenceId },
          { label: "Date Submitted", value: now }
        ],
        ctaText: "Open Support Desk",
        ctaUrl: `${appUrl}/admin`
      });

    } else {
      subject = `[Lamido Investment] Admin Alert (${type})`;
      htmlBody = renderExecutiveEmail({
        categoryTitle: "System Notification",
        subjectHeader: `Event: ${type}`,
        statusBadgeText: "System Alert",
        statusBadgeBg: "#e2e8f0",
        statusBadgeColor: "#334155",
        fields: [
          { label: "Event Type", value: type },
          { label: "Reference ID", value: referenceId },
          { label: "Date", value: now }
        ],
        ctaText: "Open Admin Dashboard",
        ctaUrl: `${appUrl}/admin`
      });
    }

    // 5. Send Email via Resend or Fallback to Mock Log
    let deliveryStatus = "mock_sent";
    let errorMessage = null;

    if (!resendApiKey) {
      console.log(`[MOCK EMAIL NOTIFICATION]`);
      console.log(`  To: ${adminEmail}`);
      console.log(`  From: ${emailFrom}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Idempotency Key: ${idempotencyKey}`);
      console.log(`  Status: Simulated success (RESEND_API_KEY not set)`);
      deliveryStatus = "mock_sent";
    } else {
      const toAddresses = adminEmail.split(",").map(e => e.trim()).filter(Boolean);
      const resendRes = await sendResendHttpRequest({
        apiKey: resendApiKey,
        from: emailFrom,
        to: toAddresses.length === 1 ? toAddresses[0] : toAddresses,
        subject,
        html: htmlBody
      });

      if (!resendRes.ok) {
        deliveryStatus = "failed";
        errorMessage = resendRes.error;
        console.error(`[EMAIL SERVICE] Resend API failed:`, errorMessage);
      } else {
        deliveryStatus = "sent";
        console.log(`[EMAIL SERVICE] Resend email dispatched successfully (ID: ${resendRes.data.id}).`);
      }
    }

    // 6. Audit Log Entry in admin_notifications (guarded)
    if (supabaseAdmin) {
      try {
        const { error: notifErr } = await supabaseAdmin.from("admin_notifications").insert({
          user_id: userId,
          event_type: type,
          reference_id: referenceId,
          recipient_email: adminEmail,
          email_subject: subject,
          email_body: htmlBody,
          status: deliveryStatus,
          error_message: errorMessage,
          idempotency_key: idempotencyKey,
          created_at: new Date().toISOString()
        });

        if (notifErr) {
          console.warn(`[EMAIL SERVICE] Audit log insert notice: ${notifErr.message}`);
        }
      } catch (logErr) {
        console.warn(`[EMAIL SERVICE] Audit log table unaccessible: ${logErr.message}`);
      }
    }

    return {
      success: deliveryStatus !== "failed",
      status: deliveryStatus,
      error: errorMessage
    };

  } catch (err) {
    console.error(`[EMAIL SERVICE EXCEPTION]`, err);
    return {
      success: false,
      status: "failed",
      error: err.message
    };
  }
}
