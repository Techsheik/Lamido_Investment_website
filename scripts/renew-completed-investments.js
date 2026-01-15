import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load environment variables manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  console.log(`📝 Reading .env from: ${envPath}`);
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > -1) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key) process.env[key] = value;
      }
    }
  });
  console.log("✓ Loaded environment variables");
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration. Ensure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function renewCompletedInvestments() {
  console.log("Searching for 'completed' investments to renew...");

  // 1. Fetch all completed investments
  const { data: completedInvestments, error: fetchError } = await supabase
    .from("investments")
    .select("id, amount, user_id, duration")
    .eq("status", "completed");

  if (fetchError) {
    console.error("Error fetching investments:", fetchError);
    return;
  }

  if (!completedInvestments || completedInvestments.length === 0) {
    console.log("No 'completed' investments found.");
    return;
  }

  console.log(`Found ${completedInvestments.length} completed investments. Renewing now...`);

  const now = new Date();
  
  for (const inv of completedInvestments) {
    const duration = inv.duration || 7;
    const nextEndDate = new Date(now.getTime() + (duration * 24 * 60 * 60 * 1000));

    const { error: updateError } = await supabase
      .from("investments")
      .update({
        status: "active",
        start_date: now.toISOString(),
        end_date: nextEndDate.toISOString()
      })
      .eq("id", inv.id);

    if (updateError) {
      console.error(`Failed to renew investment ${inv.id}:`, updateError);
    } else {
      console.log(`Successfully renewed investment ${inv.id} for user ${inv.user_id}`);
      
      // Notify the user
      await supabase.from("notifications").insert({
        title: "Investment Re-activated",
        message: `Your previous investment of $${inv.amount} has been re-activated for a new cycle as part of our new renewal policy.`,
        type: "info",
        user_id: inv.user_id,
        read: false,
      });
    }
  }

  console.log("Finished renewing investments.");
}

renewCompletedInvestments();
