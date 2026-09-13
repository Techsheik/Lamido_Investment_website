import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowUpRight, X, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { format } from "date-fns";

const Investments = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [, setRerender] = useState(0);
  const [showRejectedAlert, setShowRejectedAlert] = useState(true);
  const [showCycleBanner, setShowCycleBanner] = useState(true);
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

  const { data: cycleData, refetch: refetchCycles } = useQuery({
    queryKey: ["cycles-info"],
    queryFn: async () => {
      const response = await fetch("/api/admin/get-cycles");
      if (!response.ok) return null;
      return await response.json();
    },
    staleTime: 10000,
  });

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

  const allInvestments = investments || [];
  const pendingInvestments   = allInvestments.filter(inv => inv.status === "pending");
  const approvedInvestments  = allInvestments.filter(inv => inv.status === "approved");
  const activeInvestments    = allInvestments.filter(inv => inv.status === "active");
  const rejectedInvestments  = allInvestments.filter(inv => inv.status === "rejected");
  const completedInvestments = allInvestments.filter(inv => inv.status === "completed");

  const displayInvestments = [
    ...activeInvestments,
    ...approvedInvestments,
    ...completedInvestments,
    ...pendingInvestments,
  ];

  const confirmedInvestments = [...activeInvestments, ...approvedInvestments];
  const totalInvested = confirmedInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalUnits    = confirmedInvestments.reduce((sum, inv) => sum + (inv.units || 1), 0);

  const myDistributions: any[] = (cycleData?.distributions || []).filter(
    (d: any) => d.user_id === user.id
  );

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

        {/* Stats */}
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
              <div className="text-2xl font-bold">
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
              <div className="text-2xl font-bold">{totalUnits} Units</div>
              <p className="text-xs text-muted-foreground mt-1">Eligible for profit distribution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeInvestments.length + approvedInvestments.length}</div>
              {pendingInvestments.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">+{pendingInvestments.length} pending approval</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Cycle Info Banner */}
        {showCycleBanner && cycleData?.activeCycle && (
          <Card className="border relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    Current Cycle: {cycleData.activeCycle.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cycleData.activeCycle.cycle_start_at
                      ? `Started: ${new Date(cycleData.activeCycle.cycle_start_at).toLocaleDateString()} — Due: ${new Date(cycleData.activeCycle.cycle_end_at).toLocaleDateString()}`
                      : `Status: ${cycleData.activeCycle.status}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cycleData.activeCycle.status === "ACTIVE" ? "default" : "secondary"}>
                    {cycleData.activeCycle.status === "AWAITING_PROFIT" ? "Awaiting Profit" : cycleData.activeCycle.status}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCycleBanner(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Rule:</strong> Investments made after a cycle starts participate in the <strong>next cycle</strong>.</p>
              <p>• At the end of each cycle, community profit is distributed based on eligible share units ($70/unit).</p>
              <p>• If you don't withdraw after a cycle ends, your investment automatically continues into the next cycle.</p>
            </CardContent>
          </Card>
        )}

        {/* Rejected investments alert */}
        {showRejectedAlert && rejectedInvestments.length > 0 && (
          <Card className="p-4 border-red-200 dark:border-red-800 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              ⚠️ You have {rejectedInvestments.length} declined investment(s). Please contact support for details.
            </p>
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8 shrink-0"
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
              const isApprovedWaiting = investment.status === "approved";
              const isActive = investment.status === "active";
              const isSuspended = investment.status === "suspended";
              const isCompleted = investment.status === "completed";

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

              const dist = getDistForInvestment(investment);
              const hasFinishedDistribution = !!dist;

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
                <Card key={investment.id} className={isPending ? "opacity-80" : ""}>
                  {/* Compact Header */}
                  <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => toggleExpand(investment.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {investment.type || "Cryptocurrency Investment"}
                          {isPending && <Clock className="h-4 w-4 text-muted-foreground" />}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-semibold text-foreground">
                            {isPending ? "—" : `$${Number(investment.amount).toLocaleString()}`}
                          </span>
                          {" · "}
                          <span>{investment.units || 1} unit{(investment.units || 1) !== 1 ? "s" : ""}</span>
                          {!isPending && " · "}
                          {isActive && (
                            <span className="text-muted-foreground">
                              {daysRemaining}d remaining
                            </span>
                          )}
                          {isCompleted && hasFinishedDistribution && (
                            <span className="text-foreground font-semibold">+${Number(dist.profit).toFixed(2)} profit</span>
                          )}
                          {isCompleted && !hasFinishedDistribution && (
                            <span className="text-muted-foreground">distribution pending</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={badgeVariant} className={isApprovedWaiting ? "bg-muted text-foreground border" : ""}>
                          {badgeLabel}
                        </Badge>
                        {expandedCards.has(investment.id)
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expandable Detail Section */}
                  {expandedCards.has(investment.id) ? (
                    <CardContent className="space-y-4 border-t pt-4">
                      {isPending && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground font-medium">
                            Awaiting admin approval. Your investment will join the cycle once approved.
                          </p>
                        </div>
                      )}

                      {isApprovedWaiting && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                          <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground font-medium">
                            Investment approved. Waiting for the admin to start the cycle. Your 7-day clock has not started yet.
                          </p>
                        </div>
                      )}

                      {/* Investment metrics */}
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
                              <span>+${Number(dist.profit).toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs font-normal">—</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Payout Model</p>
                          <p className="text-sm font-bold">Community PPSU Share</p>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Submitted On
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {investment.created_at ? format(new Date(investment.created_at), "MMM dd, yyyy HH:mm") : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Cycle Start Date
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {investment.start_date ? format(new Date(investment.start_date), "MMM dd, yyyy HH:mm") : "Awaiting Cycle Start"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completion / Maturity
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

                      {/* Progress bar */}
                      {hasStarted && (
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {isSuspended ? "Paused" : isCompleted || progressRatio >= 100 ? "Completed" : `Cycle Progress (Day ${daysElapsed} of ${duration})`}
                            </span>
                            <span className="font-medium text-muted-foreground">
                              {isSuspended
                                ? "Suspended by admin"
                                : isCompleted || progressRatio >= 100
                                  ? "Matured (100%)"
                                  : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining (${progressRatio.toFixed(1)}%)`
                              }
                            </span>
                          </div>
                          <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${progressRatio}%`, opacity: isSuspended ? 0.4 : 1 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Completed — distribution pending */}
                      {isCompleted && !hasFinishedDistribution && (
                        <div className="mt-2 p-4 rounded-xl border bg-muted/40 space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-semibold text-foreground">
                              Cycle Completed — Distribution Pending
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Your investment cycle has ended. The admin is reviewing the community profit and will process distributions soon. Your investment has automatically continued into the next cycle.
                          </p>
                        </div>
                      )}

                      {/* Finalized distribution */}
                      {hasFinishedDistribution && (
                        <div className="mt-2 p-4 rounded-xl border space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-foreground" />
                              <span className="text-sm font-bold text-foreground">
                                Profit Distribution Confirmed
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">
                              PPSU: ${dist.ppsu}/unit
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-2 rounded-lg bg-muted/60 border">
                              <span className="text-[10px] text-muted-foreground block">Your Units</span>
                              <span className="text-base font-bold">{dist.eligible_units}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/60 border">
                              <span className="text-[10px] text-muted-foreground block">Your Profit</span>
                              <span className="text-base font-bold">+${Number(dist.profit).toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/60 border">
                              <span className="text-[10px] text-muted-foreground block">Total Return</span>
                              <span className="text-base font-bold">${Number(dist.total_return).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Withdraw only — no reinvest button */}
                          <div className="pt-1 flex justify-end items-center gap-2 border-t">
                            <p className="text-[11px] text-muted-foreground flex-1">
                              Profit added to your balance. Withdraw or let it continue in the next cycle.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
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
    </DashboardLayout>
  );
};

export default Investments;
