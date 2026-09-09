import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, ArrowUpRight, X, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { ReinvestDialog } from "@/components/ReinvestDialog";
import { format } from "date-fns";

const Investments = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [, setRerender] = useState(0);
  const [showRejectedAlert, setShowRejectedAlert] = useState(true);
  const [showCycleBanner, setShowCycleBanner] = useState(true);
  const [reinvestTargetDist, setReinvestTargetDist] = useState<any>(null);
  const [isReinvestOpen, setIsReinvestOpen] = useState(false);
  // Track which cards are expanded (by investment id)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: investments, isLoading, refetch: refetchInvestments } = useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Investments fetch error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    staleTime: 5000,
  });

  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("balance, weekly_roi_percentage, roi_percentage, total_roi, accrued_return")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5000,
  });

  const { data: pendingWithdrawalTxs = [] } = useQuery({
    queryKey: ["pending-withdrawals-count", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "withdrawal")
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user,
    staleTime: 3000,
  });

  const totalPendingWithdrawalAmt = pendingWithdrawalTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const netAvailableBalance = Math.max(0, Number((userProfile as any)?.balance || 0) - totalPendingWithdrawalAmt);

  const { data: cycleData, refetch: refetchCycles } = useQuery({
    queryKey: ["cycles-info"],
    queryFn: async () => {
      const response = await fetch("/api/admin/get-cycles");
      if (!response.ok) return null;
      return await response.json();
    },
    staleTime: 10000,
  });

  // Fetch admin-confirmed distributions for this user
  // This is the ONLY source of truth for profit — never calculate client-side
  const { data: userDistributions = [], refetch: refetchDistributions } = useQuery({
    queryKey: ["user-distributions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cycle_distributions")
        .select("investment_id, cycle_id, cycle_number, profit, total_return, ppsu, eligible_units")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 5000,
  });

  useEffect(() => {
    if (user) {
      const channel = supabase
        .channel(`user-investments-sync-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "investments", filter: `user_id=eq.${user.id}` },
          () => { refetchInvestments(); refetchProfile(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          () => { refetchProfile(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cycle_distributions", filter: `user_id=eq.${user.id}` },
          () => { refetchDistributions(); refetchProfile(); }
        )
        .subscribe();

      const interval = setInterval(() => {
        refetchProfile();
        refetchInvestments();
        refetchCycles();
        refetchDistributions();
      }, 10000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [user, refetchProfile, refetchInvestments, refetchCycles, refetchDistributions]);

  // Periodically re-render to update progress bars
  useEffect(() => {
    const timer = setInterval(() => setRerender(prev => prev + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading || isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Separate investment groups
  const allInvestments = investments || [];
  const pendingInvestments   = allInvestments.filter(inv => inv.status === "pending");
  const approvedInvestments  = allInvestments.filter(inv => inv.status === "approved");
  const activeInvestments    = allInvestments.filter(inv => inv.status === "active");
  const rejectedInvestments  = allInvestments.filter(inv => inv.status === "rejected");
  const completedInvestments = allInvestments.filter(inv => inv.status === "completed");

  // Display order: active first, then approved, then completed, then pending last
  const displayInvestments = [
    ...activeInvestments,
    ...approvedInvestments,
    ...completedInvestments,
    ...pendingInvestments,
  ];

  // Stats — ONLY active + approved investments count towards portfolio figures
  // Pending investments are NOT confirmed — admin hasn’t approved them yet
  const confirmedInvestments = [...activeInvestments, ...approvedInvestments];
  const totalInvested = confirmedInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalUnits    = confirmedInvestments.reduce((sum, inv) => sum + (inv.units || 1), 0);

  // Finalized distributions for this user
  const myDistributions: any[] = (cycleData?.distributions || []).filter(
    (d: any) => d.user_id === user.id
  );

  // Helper: find finalized distribution for a given investment
  const getDistForInvestment = (inv: any) =>
    userDistributions.find((d: any) => d.investment_id === inv.id) ||
    myDistributions.find((d: any) => d.investment_id === inv.id);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">My Investments</h1>
            <p className="text-muted-foreground mt-2">Track and manage your investment portfolio</p>
          </div>
          <Button onClick={() => navigate("/services")} className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            New Investment
          </Button>
        </div>

        {/* Stats — only approved investments count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Invested Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInvested.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Approved investments only</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Profit Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                ${(userDistributions.reduce((sum: number, d: any) => sum + Number(d.profit || 0), 0) || Number((userProfile as any)?.total_roi || 0)).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">From finalized cycles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Share Units</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{totalUnits} Units</div>
              <p className="text-xs text-muted-foreground mt-1">Eligible for profit distribution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{activeInvestments.length + approvedInvestments.length}</div>
              {pendingInvestments.length > 0 && (
                <p className="text-xs text-amber-500 mt-1">+{pendingInvestments.length} pending approval</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Cycle Info Banner (dismissible) */}
        {showCycleBanner && cycleData?.activeCycle && (
          <Card className="border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-amber-500/10 relative shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                    🔄 Current Cycle: {cycleData.activeCycle.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cycleData.activeCycle.cycle_start_at
                      ? `Started: ${new Date(cycleData.activeCycle.cycle_start_at).toLocaleDateString()} — Due: ${new Date(cycleData.activeCycle.cycle_end_at).toLocaleDateString()}`
                      : `Status: ${cycleData.activeCycle.status}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={
                    cycleData.activeCycle.status === "ACTIVE"
                      ? "bg-emerald-500 text-white"
                      : cycleData.activeCycle.status === "AWAITING_PROFIT"
                      ? "bg-amber-500 text-white"
                      : "bg-primary text-primary-foreground"
                  }>
                    {cycleData.activeCycle.status === "AWAITING_PROFIT" ? "Awaiting Profit" : cycleData.activeCycle.status}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCycleBanner(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Rule:</strong> Investments made after a cycle starts participate in the <strong>NEXT cycle</strong>.</p>
              <p>• At the end of each cycle, community profit is distributed based on eligible share units ($70/unit).</p>
            </CardContent>
          </Card>
        )}

        {/* Rejected investments alert */}
        {showRejectedAlert && rejectedInvestments.length > 0 && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              ⚠️ You have {rejectedInvestments.length} declined investment(s). Please contact support for details.
            </p>
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8 text-red-600 shrink-0"
              onClick={() => setShowRejectedAlert(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Card>
        )}

        {/* Investment Cards */}
        {displayInvestments.length > 0 ? (
          <div className="grid gap-6">
            {displayInvestments.map((investment) => {
              const isPending = investment.status === "pending";
              const isApprovedWaiting = investment.status === "approved"; // Approved, cycle not started yet
              const isActive = investment.status === "active";           // Cycle running
              const isSuspended = investment.status === "suspended";
              const isCompleted = investment.status === "completed";

              // Progress bar: only show if active (has real start_date from cycle start)
              const hasStarted = isActive && !!investment.start_date;
              const startDate = hasStarted ? new Date(investment.start_date) : new Date(investment.created_at);
              const duration = Number(investment.duration) || 7;
              const endDate = investment.end_date
                ? new Date(investment.end_date)
                : new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

              const now = new Date();
              const totalMs = endDate.getTime() - startDate.getTime();
              const elapsedMs = Math.max(0, now.getTime() - startDate.getTime());
              const progressRatio = !hasStarted ? 0
                : isCompleted || elapsedMs >= totalMs ? 100
                : Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
              const daysElapsed = !hasStarted ? 0 : Math.min(duration, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
              const daysRemaining = !hasStarted ? duration : Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

              // Find if this specific investment has a finalized distribution
              const dist = getDistForInvestment(investment);
              const hasFinishedDistribution = !!dist;

              // Status badge
              const badgeVariant =
                isActive ? "default" :
                isApprovedWaiting ? "secondary" :
                isSuspended ? "destructive" :
                isPending ? "secondary" :
                isCompleted ? "outline" : "secondary";

              const badgeLabel =
                isPending ? "Pending Approval" :
                isApprovedWaiting ? "Approved — Awaiting Cycle Start" :
                isActive ? "Active" :
                isCompleted ? "Completed" :
                isSuspended ? "Suspended" :
                investment.status;

              return (
                <Card key={investment.id} className={isPending ? "border-amber-500/30 opacity-80" : ""}>
                  {/* ── Compact Header (always visible) ── */}
                  <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => toggleExpand(investment.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {investment.type || "Cryptocurrency Investment"}
                          {isPending && <Clock className="h-4 w-4 text-amber-500" />}
                        </CardTitle>
                        {/* Compact summary line */}
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-semibold text-foreground">
                            {isPending ? "—" : `$${Number(investment.amount).toLocaleString()}`}
                          </span>
                          {" · "}
                          <span>{investment.units || 1} unit{(investment.units || 1) !== 1 ? "s" : ""}</span>
                          {!isPending && " · "}
                          {isActive && (
                            <span className="text-blue-500">
                              {daysRemaining}d remaining
                            </span>
                          )}
                          {isCompleted && hasFinishedDistribution && (
                            <span className="text-emerald-500">+${Number(dist.profit).toFixed(2)} profit</span>
                          )}
                          {isCompleted && !hasFinishedDistribution && (
                            <span className="text-amber-500">distribution pending</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={badgeVariant} className={isApprovedWaiting ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : ""}>
                          {badgeLabel}
                        </Badge>
                        {expandedCards.has(investment.id)
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>

                  {/* ── Expandable Detail Section ── */}
                  {expandedCards.has(investment.id) ? (
                    <CardContent className="space-y-4 border-t pt-4">
                      {/* Pending approval notice */}
                      {isPending && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                            Awaiting admin approval. Your investment will join the cycle once approved.
                          </p>
                        </div>
                      )}

                      {isApprovedWaiting && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-400 font-medium">
                            Investment approved! Waiting for the admin to start the cycle.
                            Your 7-day clock has not started yet.
                          </p>
                        </div>
                      )}

                      {/* Investment metrics — only show amount for approved investments */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Units</p>
                          <p className="text-xl font-bold">{investment.units || 1} unit{(investment.units || 1) !== 1 ? "s" : ""}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Capital</p>
                          <p className="text-xl font-bold">
                            {isPending ? (
                              <span className="text-muted-foreground text-base">Pending</span>
                            ) : (
                              `$${Number(investment.amount).toLocaleString()}`
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cycle Profit</p>
                          <p className="text-base font-bold font-mono">
                            {hasFinishedDistribution ? (
                              <span className="text-emerald-500">+${Number(dist.profit).toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs font-normal">—</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Payout Model</p>
                          <p className="text-sm font-bold text-primary">Community PPSU Share</p>
                        </div>
                      </div>

                      {/* Timestamps & Cycle Timeline */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-500" /> Submitted On
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {investment.created_at ? format(new Date(investment.created_at), "MMM dd, yyyy HH:mm") : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-500" /> Cycle Start Date
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {investment.start_date ? format(new Date(investment.start_date), "MMM dd, yyyy HH:mm") : "Awaiting Cycle Start"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-purple-500" /> Completion / Maturity
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {investment.end_date 
                              ? format(new Date(investment.end_date), "MMM dd, yyyy HH:mm") 
                              : investment.start_date 
                                ? format(new Date(new Date(investment.start_date).getTime() + (investment.duration || 7) * 86400000), "MMM dd, yyyy HH:mm")
                                : "Pending Cycle Start"
                            }
                          </span>
                        </div>
                      </div>

                      {/* Progress bar — only for ACTIVE (started) investments */}
                      {hasStarted && (
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {isSuspended ? "Paused" : isCompleted || progressRatio >= 100 ? "Completed" : `Cycle Progress (Day ${daysElapsed} of ${duration})`}
                            </span>
                            <span className="font-medium">
                              {isSuspended
                                ? "Suspended by admin"
                                : isCompleted || progressRatio >= 100
                                  ? "Matured (100%)"
                                  : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining (${progressRatio.toFixed(1)}%)`
                              }
                            </span>
                          </div>
                          <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isSuspended ? "opacity-50" : ""}`}
                              style={{
                                width: `${progressRatio}%`,
                                background: isSuspended
                                  ? "#94a3b8"
                                  : progressRatio < 33
                                    ? "linear-gradient(90deg, #ef4444, #f97316)"
                                    : progressRatio < 66
                                      ? "linear-gradient(90deg, #f97316, #eab308)"
                                      : "linear-gradient(90deg, #eab308, #22c55e)"
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Completed but NO distribution yet — admin still needs to finalize */}
                      {isCompleted && !hasFinishedDistribution && (
                        <div className="mt-2 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              Cycle Completed — Distribution Pending
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Your investment cycle has ended. The admin is reviewing the community profit and will process distributions soon. Check back here once confirmed.
                          </p>
                        </div>
                      )}

                      {/* Finalized distribution payout — ONLY shown after admin has finalized */}
                      {hasFinishedDistribution && (
                        <div className="mt-2 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                Profit Distribution Confirmed ✓
                              </span>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-mono">
                              PPSU: ${dist.ppsu}/unit
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-2 rounded-lg bg-muted/60 border">
                              <span className="text-[10px] text-muted-foreground block">Your Units</span>
                              <span className="text-base font-bold">{dist.eligible_units}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <span className="text-[10px] text-muted-foreground block">Your Profit</span>
                              <span className="text-base font-bold text-emerald-500">+${Number(dist.profit).toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/60 border">
                              <span className="text-[10px] text-muted-foreground block">Total Return</span>
                              <span className="text-base font-bold text-primary">${Number(dist.total_return).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Reinvest / Withdraw — ONLY after admin-confirmed distribution */}
                          <div className="pt-1 flex justify-end items-center gap-2 border-t border-emerald-500/20">
                            <p className="text-[11px] text-muted-foreground flex-1">Choose what to do with your profit:</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 text-xs font-semibold"
                              onClick={() => {
                                setReinvestTargetDist(dist);
                                setIsReinvestOpen(true);
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Reinvest Profit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-xs"
                              onClick={() => navigate("/withdraw")}
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              Withdraw / Claim
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No investments yet. Start your investment journey today!</p>
              <Button onClick={() => navigate("/services")}>Browse Investment Plans</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ReinvestDialog
        open={isReinvestOpen}
        onOpenChange={setIsReinvestOpen}
        userBalance={netAvailableBalance}
      />
    </DashboardLayout>
  );
};

export default Investments;
