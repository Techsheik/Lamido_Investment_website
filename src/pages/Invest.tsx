import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarX, Clock, Lock } from "lucide-react";

const Invest = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [units, setUnits] = useState("");
  const UNIT_PRICE = 70; // $70 per unit

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // ── Fetch the investment plan ──────────────────────────────────────────────
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["investmentPlan", planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data } = await supabase
        .from("investment_plans")
        .select("*")
        .eq("id", planId)
        .single();
      return data;
    },
    enabled: !!planId,
  });

  // ── Fetch user bank details ────────────────────────────────────────────────
  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("bank_account_number, bank_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // ── Check if entry window is open (admin must open it first) ──────────────
  // Users can ONLY invest when status = ENTRY_OPEN
  const { data: entryStatus, isLoading: entryLoading } = useQuery({
    queryKey: ["entry-window-status"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_windows")
        .select("id, status, cycle_number, opened_at")
        .eq("status", "ENTRY_OPEN")
        .maybeSingle();
      if (error) return null;
      return data; // null = no open entry
    },
  });

  const entryIsOpen = !!entryStatus;

  // ── Create investment mutation ─────────────────────────────────────────────
  const createInvestment = useMutation({
    mutationFn: async () => {
      if (!user || !plan) throw new Error("Missing required data");

      if (!bankDetails?.bank_account_number || !bankDetails?.bank_name) {
        throw new Error("Please add your bank details in Settings before investing");
      }

      // Re-check entry window is still open (server-side check via RLS will also block this)
      const { data: openEntry } = await supabase
        .from("entry_windows")
        .select("id, status, cycle_number")
        .eq("status", "ENTRY_OPEN")
        .maybeSingle();

      if (!openEntry) {
        throw new Error("The investment entry window is no longer open. Please wait for the admin to open the next entry window.");
      }

      const numUnits = Number(units);
      if (isNaN(numUnits) || numUnits < 1 || !Number.isInteger(numUnits)) {
        throw new Error("Please enter a valid number of units (minimum 1 unit)");
      }

      const investAmount = numUnits * UNIT_PRICE;

      // IMPORTANT: Do NOT set start_date or end_date here.
      // The 7-day clock starts ONLY when the admin explicitly starts the cycle.
      // Dates are set server-side in /api/admin/start-cycle.
      const { data: investmentData, error: investmentError } = await supabase
        .from("investments")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          amount: investAmount,
          units: numUnits,
          type: plan.name,
          roi: 0,          // No fixed ROI — profit is PPSU-based, set at cycle finalization
          duration: 7,     // 7 days, but clock does NOT start until admin starts cycle
          status: "pending",
          entry_id: openEntry.id,  // Link to the current open entry
          // start_date: NOT SET — set by admin via /api/admin/start-cycle
          // end_date: NOT SET — set by admin via /api/admin/start-cycle
        })
        .select()
        .single();

      if (investmentError) throw investmentError;

      // Create a pending deposit transaction for payment proof tracking
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "investment",
        amount: investAmount,
        status: "pending",
      });

      if (transactionError) {
        // Non-fatal: investment was created, just log the transaction error
        console.warn("Transaction record failed:", transactionError.message);
      }

      return investmentData;
    },
    onSuccess: () => {
      toast({
        title: "✅ Investment Submitted!",
        description: "Your investment is pending admin review. Proceed to upload payment proof.",
      });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["entry-window-status"] });
      navigate("/payment");
    },
    onError: (error: Error) => {
      toast({
        title: "Investment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ── Loading states ─────────────────────────────────────────────────────────
  if (loading || planLoading || entryLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
            <Clock className="w-5 h-5" />
            <p>Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Services
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Investment plan not found</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── Entry window CLOSED — block investment ─────────────────────────────────
  if (!entryIsOpen) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Services
          </Button>

          <Card className="border-amber-500/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <CalendarX className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Entry Window Closed</CardTitle>
                  <CardDescription className="mt-1">
                    The investment entry window is currently closed
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">No Open Entry Window</p>
                    <p className="text-muted-foreground">
                      New investments can only be submitted when an entry window is open.
                      The admin controls when entry windows open for each investment cycle.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border space-y-2 text-sm">
                <p className="font-semibold text-foreground">How the Investment Cycle Works:</p>
                <ol className="space-y-1.5 text-muted-foreground list-none">
                  {[
                    "Admin opens an entry window",
                    "Investors submit their investments",
                    "Admin closes the entry and reviews submissions",
                    "Admin starts the 7-day cycle",
                    "After 7 days, community profit is distributed",
                    "Admin opens the next entry window",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Please check back later or contact the admin for information on the next entry window.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── Entry is open — show investment form ───────────────────────────────────
  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "low": return "bg-green-500/10 text-green-500";
      case "medium": return "bg-yellow-500/10 text-yellow-500";
      case "high": return "bg-red-500/10 text-red-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/services")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Services
        </Button>

        {/* Entry window open banner */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="font-semibold text-green-700 dark:text-green-400">
            Entry Window Open — Cycle #{entryStatus?.cycle_number}
          </span>
          <span className="text-muted-foreground ml-auto text-xs">Submit your investment now</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </div>
              <Badge className={getRiskColor(plan.risk_level || "medium")}>
                {plan.risk_level || "Medium"} Risk
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Bank details warning */}
            {!bankDetails?.bank_account_number && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                  ⚠️ Bank details required. Add your bank information in Settings before investing.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => navigate("/settings")}
                >
                  Add Bank Details
                </Button>
              </div>
            )}

            {/* Plan info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Unit Price</Label>
                <p className="text-xl font-bold">$70 per unit</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cycle Duration</Label>
                <p className="text-xl font-bold">7 days</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Distribution Model</Label>
                <p className="text-lg font-bold text-primary">Community Profit Share</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Minimum</Label>
                <p className="text-xl font-bold">1 unit ($70)</p>
              </div>
            </div>

            {/* Units input */}
            <div className="space-y-2">
              <Label htmlFor="units">Number of Units</Label>
              <Input
                id="units"
                type="number"
                placeholder="Enter number of units (1 unit = $70)"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                min={1}
                step={1}
              />
              <p className="text-sm text-muted-foreground">
                Each unit costs ${UNIT_PRICE}. Minimum 1 unit.
              </p>
            </div>

            {/* Summary */}
            {units && Number(units) >= 1 && Number.isInteger(Number(units)) && (
              <div className="p-4 bg-muted/60 rounded-lg space-y-3 border">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Units:</span>
                  <span className="font-semibold">{Number(units)} unit{Number(units) !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Capital:</span>
                  <span className="font-bold text-base">${(Number(units) * UNIT_PRICE).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entry Cycle:</span>
                  <span className="font-semibold text-green-600">Cycle #{entryStatus?.cycle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Payout Model:</span>
                  <span className="font-semibold text-primary">PPSU (Profit Per Share Unit)</span>
                </div>
                <div className="pt-2 border-t space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-start gap-1.5 text-foreground/80 font-medium">
                    <span className="text-primary">•</span>
                    Your investment will be activated when the admin starts Cycle #{entryStatus?.cycle_number}.
                    The 7-day clock starts from the cycle start time, not your submission time.
                  </p>
                  <p className="flex items-start gap-1.5 text-amber-500 font-medium">
                    <span>•</span>
                    Profit is distributed based on actual community performance. Returns are not fixed.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              className="w-full"
              size="lg"
              onClick={() => createInvestment.mutate()}
              disabled={
                !units ||
                Number(units) < 1 ||
                !Number.isInteger(Number(units)) ||
                createInvestment.isPending ||
                !bankDetails?.bank_account_number
              }
            >
              {createInvestment.isPending
                ? "Submitting..."
                : `Submit ${units ? Number(units) : ""} Unit${units && Number(units) !== 1 ? "s" : ""} — $${units && Number(units) >= 1 ? (Number(units) * UNIT_PRICE).toLocaleString() : "0"}`}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Invest;
