/**
 * InvestmentNotificationBanner
 *
 * RULES:
 *  - NEVER show calculated/estimated profit — only real admin-confirmed distributions.
 *  - When a cycle is completed but NOT yet finalized by admin → show neutral "pending" message.
 *  - When admin has finalized → show actual profit from cycle_distributions table.
 *  - Withdraw / Reinvest buttons ONLY appear after admin-confirmed distribution.
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, X, ArrowUpRight, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function InvestmentNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dismissed_cycle_notifications_v2");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch completed investments for this user
  const { data: completedInvestments = [] } = useQuery({
    queryKey: ["completed-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("investments")
        .select("id, amount, units, type, entry_id, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Fetch admin-confirmed distributions for this user
  const { data: distributions = [] } = useQuery({
    queryKey: ["user-distributions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cycle_distributions")
        .select("investment_id, cycle_number, profit, total_return, ppsu, eligible_units")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const handleDismiss = (id: string) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    try {
      localStorage.setItem("dismissed_cycle_notifications_v2", JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  // Only show non-dismissed completed investments
  const visible = completedInvestments.filter(
    (inv: any) => !dismissed.includes(inv.id)
  );

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visible.map((inv: any) => {
        const dist = distributions.find((d: any) => d.investment_id === inv.id);
        const hasDistribution = !!dist;

        if (hasDistribution) {
          // ── Admin HAS finalized — show real confirmed profit ──────────────
          return (
            <Card
              key={inv.id}
              className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-background to-emerald-950/10 shadow-md"
            >
              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl mt-0.5 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground text-base">
                        Profit Distributed!
                      </h4>
                      <Badge className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs border">
                        Cycle #{dist.cycle_number} · Confirmed
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your <span className="font-medium text-foreground">{inv.type}</span> investment
                      (${Number(inv.amount).toLocaleString()}) has been distributed.{" "}
                      <span className="font-semibold text-emerald-500">
                        +${Number(dist.profit).toFixed(2)} profit
                      </span>{" "}
                      has been added to your balance.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-xs"
                    onClick={() => navigate("/withdraw")}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Withdraw
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 text-xs"
                    onClick={() => navigate("/services")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reinvest
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => handleDismiss(inv.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        }

        // ── Admin has NOT finalized yet — neutral "pending" message ──────────
        return (
          <Card
            key={inv.id}
            className="relative overflow-hidden border-amber-500/30 bg-gradient-to-r from-amber-950/10 via-background to-amber-950/5 shadow-sm"
          >
            <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-500 rounded-xl mt-0.5 shrink-0">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground text-base">
                      Cycle Ended — Distribution Pending
                    </h4>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs"
                    >
                      Awaiting Admin
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                    Your <span className="font-medium text-foreground">{inv.type}</span> cycle
                    has completed. The admin is reviewing the community profit and will
                    distribute returns shortly. Check back here once it's confirmed.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => navigate("/investments")}
                >
                  View Portfolio
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => handleDismiss(inv.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
