import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function InvestmentNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dismissed_matured_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { data: maturedInvestments = [] } = useQuery({
    queryKey: ["matured-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "approved", "completed"]);

      if (error || !data) return [];

      const now = new Date();
      // Filter investments whose due date (end_date or start_date + duration days) has arrived
      return data.filter((inv: any) => {
        const startDate = new Date(inv.start_date || inv.created_at);
        const duration = Number(inv.duration) || 7;
        const endDate = inv.end_date 
          ? new Date(inv.end_date) 
          : new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
        
        return now.getTime() >= endDate.getTime() || inv.status === "completed";
      });
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Trigger toast notification when new matured investments are detected
  useEffect(() => {
    maturedInvestments.forEach((inv: any) => {
      const key = `matured_toast_${inv.id}`;
      const alreadyToast = sessionStorage.getItem(key);
      if (!alreadyToast) {
        sessionStorage.setItem(key, "true");
        const roi = Number(inv.roi) || 10;
        const expectedReturn = (Number(inv.amount) * (roi / 100)).toFixed(2);
        toast.success(`🎉 Investment Matured!`, {
          description: `Your $${Number(inv.amount).toLocaleString()} investment in ${inv.type} has completed its cycle! Expected return: $${expectedReturn}`,
          action: {
            label: "View Portfolio",
            onClick: () => navigate("/investments"),
          },
          duration: 10000,
        });
      }
    });
  }, [maturedInvestments, navigate]);

  const handleDismiss = (id: string) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    try {
      localStorage.setItem("dismissed_matured_notifications", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const visibleNotifications = maturedInvestments.filter((inv: any) => !dismissed.includes(inv.id));

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleNotifications.map((inv: any) => {
        const roi = Number(inv.roi) || 10;
        const returnAmount = (Number(inv.amount) * (roi / 100)).toFixed(2);
        const totalPayout = (Number(inv.amount) + Number(returnAmount)).toFixed(2);

        return (
          <Card key={inv.id} className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-emerald-900/10 to-emerald-950/20 dark:from-emerald-950/40 dark:to-emerald-900/20 shadow-md">
            <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl mt-0.5 sm:mt-0">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-base">
                      Investment Matured! 
                    </h4>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Due Date Reached
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your <span className="font-medium text-foreground">{inv.type}</span> plan (${Number(inv.amount).toLocaleString()}) has reached its maturity date. You earned <span className="font-semibold text-emerald-600 dark:text-emerald-400">+${returnAmount} ROI</span> (Total: ${totalPayout}).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5"
                  onClick={() => navigate("/withdraw")}
                >
                  Withdraw Payout <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => handleDismiss(inv.id)}
                  title="Dismiss alert"
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
