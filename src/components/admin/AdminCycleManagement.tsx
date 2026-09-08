import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle, Calculator, CheckCircle, CheckCircle2, ChevronRight,
  Clock, DollarSign, History, Layers, Lock, Play, ShieldCheck,
  TrendingUp, Users, X, CalendarDays
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/** Helper: get the auth token from Supabase session for admin API calls */
async function getAdminToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated. Please sign in again.");
  return session.access_token;
}

/** Helper: admin fetch with auth header */
async function adminFetch(url: string, options: RequestInit = {}) {
  const token = await getAdminToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export function AdminCycleManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [communityProfit, setCommunityProfit] = useState<string>("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showStartCycleModal, setShowStartCycleModal] = useState(false);
  const [selectedHistoricalCycle, setSelectedHistoricalCycle] = useState<any>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: cycleData, isLoading, refetch } = useQuery({
    queryKey: ["admin-cycles"],
    refetchInterval: 8000,
    queryFn: async () => {
      const response = await fetch("/api/admin/get-cycles");
      if (!response.ok) throw new Error("Failed to fetch cycle data");
      return response.json();
    },
  });

  const systemState = cycleData?.systemState;
  const activeCycle = cycleData?.activeCycle;
  const currentEntry = cycleData?.currentEntry;
  const pendingInvestments = cycleData?.pendingInvestments || [];
  const approvedInvestments = cycleData?.approvedInvestments || [];
  const eligibleInvestments = cycleData?.eligibleInvestments || [];
  const counts = cycleData?.counts || {};
  const distributions = cycleData?.distributions || [];
  const historicalCycles = (cycleData?.cycles || []).filter((c: any) => c.status === "FINALIZED");

  // ── Mutations ────────────────────────────────────────────────────────────────

  const openEntryMutation = useMutation({
    mutationFn: () => adminFetch("/api/admin/open-entry", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "✅ Entry Window Opened", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeEntryMutation = useMutation({
    mutationFn: () => adminFetch("/api/admin/close-entry", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "🔒 Entry Closed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (investmentId: string) => adminFetch("/api/admin/update-investment-status", {
      method: "POST",
      body: JSON.stringify({ investmentId, status: "approved" }),
    }),
    onSuccess: () => {
      toast({ title: "✅ Investment Approved", description: "Investment approved. It will activate when the cycle starts." });
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (investmentId: string) => adminFetch("/api/admin/update-investment-status", {
      method: "POST",
      body: JSON.stringify({ investmentId, status: "rejected" }),
    }),
    onSuccess: () => {
      toast({ title: "❌ Investment Rejected", description: "Investment has been declined." });
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startCycleMutation = useMutation({
    mutationFn: () => adminFetch("/api/admin/start-cycle", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "🚀 Cycle Started!", description: data.message });
      setShowStartCycleModal(false);
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      refetch();
    },
    onError: (e: Error) => {
      setShowStartCycleModal(false);
      toast({ title: "Error Starting Cycle", description: e.message, variant: "destructive" });
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async (profit: number) => adminFetch("/api/admin/calculate-cycle-distribution", {
      method: "POST",
      body: JSON.stringify({ cycleId: activeCycle?.id, communityProfit: profit }),
    }),
    onSuccess: (data) => {
      setPreviewData(data);
      toast({ title: "Distribution Calculated", description: `PPSU: $${data.ppsu}/unit across ${data.eligible_units} eligible units.` });
    },
    onError: (e: Error) => toast({ title: "Calculation Error", description: e.message, variant: "destructive" }),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => adminFetch("/api/admin/finalize-cycle-distribution", {
      method: "POST",
      body: JSON.stringify({ cycleId: activeCycle?.id, communityProfit: previewData?.community_profit }),
    }),
    onSuccess: (data) => {
      toast({ title: "🎉 Cycle Finalized!", description: data.message });
      setShowFinalizeModal(false);
      setPreviewData(null);
      setCommunityProfit("");
      queryClient.invalidateQueries({ queryKey: ["admin-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Finalization Failed", description: e.message, variant: "destructive" }),
  });

  // ── Status badge helpers ─────────────────────────────────────────────────────
  const getStateBadge = (state: string) => {
    const map: Record<string, string> = {
      NO_CYCLE: "bg-muted text-muted-foreground",
      ENTRY_OPEN: "bg-green-500 text-white",
      ENTRY_CLOSED: "bg-amber-500 text-white",
      ACTIVE: "bg-blue-600 text-white",
      DUE: "bg-orange-500 text-white",
      SETTLING: "bg-purple-600 text-white",
      FINALIZED: "bg-emerald-600 text-white",
    };
    return map[state] || "bg-muted";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-muted-foreground animate-pulse">
            <Clock className="w-5 h-5" /> <span>Loading Cycle Engine...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* DEV MODE BANNER */}
      {cycleData?.isDevMode && (
        <div className="px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            🧪 DEV MODE — Accelerated Cycle: {Math.round((cycleData.cycleDurationMs || 0) / 60000)} minutes (not 7 days)
          </span>
        </div>
      )}

      {/* MIGRATION PENDING BANNER */}
      {systemState?.migrationPending && (
        <div className="p-4 rounded-xl border-2 border-red-500/40 bg-red-500/10 space-y-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <p className="font-bold text-red-600 dark:text-red-400">Database Migration Required</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                The new investment cycle tables don't exist yet. Apply the migration before using this system.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/60 border text-sm space-y-1.5 font-mono">
            <p className="font-semibold text-foreground">Steps to apply:</p>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Open <a href="https://supabase.com/dashboard/project/uaxuvzvdysktthshnfhx/editor" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Supabase SQL Editor ↗</a></li>
              <li>Open <code className="bg-muted px-1 rounded">migration.sql</code> in the project root</li>
              <li>Copy all the SQL and paste it into the editor</li>
              <li>Click <strong>Run</strong> — you should see "Success. No rows returned."</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      )}

      {/* SYSTEM STATE PANEL */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Investment Cycle Control
              </CardTitle>
              <CardDescription className="mt-1">
                {systemState?.description || "Loading system state..."}
              </CardDescription>
            </div>
            {systemState && (
              <Badge className={`text-sm px-4 py-1 font-bold ${getStateBadge(systemState.code)}`}>
                {systemState.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* State summary cards */}
          {activeCycle && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 border">
                <span className="text-xs text-muted-foreground block">Cycle</span>
                <span className="font-bold">{activeCycle.name}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border">
                <span className="text-xs text-muted-foreground block">Status</span>
                <span className="font-bold">{activeCycle.status}</span>
              </div>
              {activeCycle.cycle_start_at && (
                <div className="p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs text-muted-foreground block">Started</span>
                  <span className="font-bold text-xs">{format(new Date(activeCycle.cycle_start_at), "MMM dd, HH:mm")}</span>
                </div>
              )}
              {activeCycle.cycle_end_at && (
                <div className="p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs text-muted-foreground block">Due</span>
                  <span className="font-bold text-xs">{format(new Date(activeCycle.cycle_end_at), "MMM dd, HH:mm")}</span>
                </div>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Pending
              </div>
              <div className="text-2xl font-bold font-mono">{counts.pending || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-3 h-3" /> Approved
              </div>
              <div className="text-2xl font-bold font-mono">{counts.approved || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <Lock className="w-3 h-3" /> Eligible Units
              </div>
              <div className="text-2xl font-bold font-mono text-amber-500">{counts.totalEligibleUnits || 0}</div>
            </div>
          </div>

          {/* Action Buttons based on system state */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            {systemState?.canOpenEntry && (
              <Button
                onClick={() => openEntryMutation.mutate()}
                disabled={openEntryMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                {openEntryMutation.isPending
                  ? "Opening..."
                  : systemState?.code === "ENTRY_CLOSED"
                  ? "Re-open Entry Window"
                  : "Open Entry Window"}
              </Button>
            )}

            {systemState?.canCloseEntry && (
              <Button
                onClick={() => closeEntryMutation.mutate()}
                disabled={closeEntryMutation.isPending}
                variant="outline"
                className="border-red-500/40 text-red-600 hover:bg-red-500/10 gap-2"
              >
                <X className="w-4 h-4" />
                {closeEntryMutation.isPending ? "Closing..." : "Close Entry Window"}
              </Button>
            )}

            {systemState?.canStartCycle && approvedInvestments.length > 0 && (
              <Button
                onClick={() => setShowStartCycleModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-600/20"
              >
                <Play className="w-4 h-4" />
                Start 7-Day Cycle
              </Button>
            )}

            {systemState?.canStartCycle && approvedInvestments.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4" />
                No approved investments yet. Approve at least one before starting the cycle.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MAIN TABS */}
      <Tabs defaultValue="approval" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="approval">
            Approval Queue
            {(counts.pending || 0) > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0">{counts.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">Active Cycle</TabsTrigger>
          <TabsTrigger value="history">History ({historicalCycles.length})</TabsTrigger>
        </TabsList>

        {/* APPROVAL QUEUE */}
        <TabsContent value="approval" className="mt-4 space-y-4">
          {/* Pending */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Review ({pendingInvestments.length})
              </CardTitle>
              <CardDescription>Investments submitted during the current entry. Review and approve or reject each one.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingInvestments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {currentEntry ? "No pending investments for this entry." : "Open an entry window first."}
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor (Name & Code)</TableHead>
                        <TableHead className="text-center">Units</TableHead>
                        <TableHead className="text-right">Capital</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvestments.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-sm">{inv.user_name || "Unknown User"}</span>
                              <span className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">{inv.user_code || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold font-mono">{inv.units}</TableCell>
                          <TableCell className="text-right font-mono">${Number(inv.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{format(new Date(inv.created_at), "MMM dd, HH:mm")}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                              onClick={() => approveMutation.mutate(inv.id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2"
                              onClick={() => rejectMutation.mutate(inv.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approved — Ready for cycle */}
          {approvedInvestments.length > 0 && (
            <Card className="border-blue-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  Approved — Awaiting Cycle Start ({approvedInvestments.length})
                </CardTitle>
                <CardDescription>
                  These investments are approved. They will become active when you start the cycle.
                  Their 7-day clock has NOT started yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor (Name & Code)</TableHead>
                        <TableHead className="text-center">Units</TableHead>
                        <TableHead className="text-right">Capital</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedInvestments.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-sm">{inv.user_name || "Unknown User"}</span>
                              <span className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">{inv.user_code || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold font-mono">{inv.units}</TableCell>
                          <TableCell className="text-right font-mono">${Number(inv.amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                              APPROVED — WAITING
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ACTIVE CYCLE */}
        <TabsContent value="active" className="mt-4 space-y-4">
          {!activeCycle ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No active cycle. Open an entry window to begin.</p>
              </CardContent>
            </Card>
          ) : (activeCycle.status === "ENTRY_OPEN" || activeCycle.status === "ENTRY_CLOSED" || activeCycle.status === "READY_TO_START") ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Clock className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <p className="font-semibold">Entry Phase — Cycle Not Started Yet</p>
                <p className="text-sm text-muted-foreground">
                  {activeCycle.status === "ENTRY_OPEN"
                    ? "Entry window is open. Investments are being submitted and reviewed."
                    : "Entry closed. Approve all investments in the Approval Queue, then click Start Cycle."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Eligible Investments (locked) */}
              {eligibleInvestments.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-500" />
                          Eligible Investments — {activeCycle.name} (LOCKED)
                        </CardTitle>
                        <CardDescription>
                          These {eligibleInvestments.length} investment(s) participate in this cycle.
                          Total: <strong>{counts.totalEligibleUnits} units</strong> / <strong>${(counts.totalEligibleAmount || 0).toLocaleString()}</strong>
                        </CardDescription>
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-mono">
                        {counts.totalEligibleUnits} Units LOCKED
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Investor (Name & Code)</TableHead>
                            <TableHead className="text-center">Units</TableHead>
                            <TableHead className="text-right">Capital</TableHead>
                            <TableHead>Cycle Start</TableHead>
                            <TableHead>Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eligibleInvestments.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground text-sm">{inv.user_name || "Unknown User"}</span>
                                  <span className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">{inv.user_code || "N/A"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-bold font-mono">{inv.units}</TableCell>
                              <TableCell className="text-right font-mono">${Number(inv.amount).toLocaleString()}</TableCell>
                              <TableCell className="text-xs">{inv.start_date ? format(new Date(inv.start_date), "MMM dd, HH:mm") : "—"}</TableCell>
                              <TableCell className="text-xs">{inv.end_date ? format(new Date(inv.end_date), "MMM dd, HH:mm") : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Profit Distribution Form — only when DUE/SETTLING */}
              {systemState?.canEnterProfit && (
                <Card className="border-green-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      Enter Community Profit & Finalize Distribution
                    </CardTitle>
                    <CardDescription>
                      Enter the actual community profit earned this cycle. PPSU = Profit ÷ Eligible Units.
                      No fixed ROI rate is used.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = parseFloat(communityProfit);
                        if (isNaN(val) || val < 0) {
                          toast({ title: "Invalid Amount", description: "Enter a valid profit amount", variant: "destructive" });
                          return;
                        }
                        calculateMutation.mutate(val);
                      }}
                      className="flex gap-3"
                    >
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Total Community Profit (e.g. 70000)"
                          value={communityProfit}
                          onChange={(e) => setCommunityProfit(e.target.value)}
                          className="pl-9 font-mono"
                        />
                      </div>
                      <Button type="submit" disabled={calculateMutation.isPending || !communityProfit}>
                        <Calculator className="w-4 h-4 mr-2" />
                        {calculateMutation.isPending ? "Calculating..." : "Calculate"}
                      </Button>
                    </form>

                    {previewData && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 grid grid-cols-3 gap-4 text-center text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground block">Community Profit</span>
                            <span className="text-lg font-bold text-green-500">${Number(previewData.community_profit).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Eligible Units</span>
                            <span className="text-lg font-bold">{previewData.eligible_units}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">PPSU (Profit/Unit)</span>
                            <span className="text-lg font-bold text-primary">${previewData.ppsu}/unit</span>
                          </div>
                        </div>

                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Investor (Name & Code)</TableHead>
                                <TableHead className="text-center">Units</TableHead>
                                <TableHead className="text-right">Capital</TableHead>
                                <TableHead className="text-right">PPSU</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-right font-bold">Total Return</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.distributions.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-foreground text-sm">{item.user_name || "Unknown"}</span>
                                      <span className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">{item.user_code || "N/A"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-mono font-bold">{item.units}</TableCell>
                                  <TableCell className="text-right font-mono">${Number(item.investment_amount).toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-mono text-primary">${item.ppsu}</TableCell>
                                  <TableCell className="text-right font-mono font-semibold text-green-500">+${Number(item.profit).toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-mono font-bold">${Number(item.total_return).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={() => setShowFinalizeModal(true)}
                            className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            Finalize & Distribute Payouts
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-4 h-4" /> Historical Cycles
              </CardTitle>
              <CardDescription>Frozen, immutable records of all finalized cycles.</CardDescription>
            </CardHeader>
            <CardContent>
              {historicalCycles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No completed cycles yet.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Units</TableHead>
                        <TableHead className="text-right">Community Profit</TableHead>
                        <TableHead className="text-right">PPSU</TableHead>
                        <TableHead className="text-right">Finalized</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalCycles.map((cycle: any) => (
                        <TableRow key={cycle.id}>
                          <TableCell className="font-bold text-primary">{cycle.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {cycle.cycle_start_at && format(new Date(cycle.cycle_start_at), "MMM dd")} – {cycle.cycle_end_at && format(new Date(cycle.cycle_end_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="text-center font-mono">{cycle.eligible_units}</TableCell>
                          <TableCell className="text-right font-mono text-green-500">${Number(cycle.community_profit).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">${Number(cycle.ppsu).toFixed(2)}/unit</TableCell>
                          <TableCell className="text-right text-xs">{cycle.finalized_at ? format(new Date(cycle.finalized_at), "MMM dd, HH:mm") : "N/A"}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => setSelectedHistoricalCycle(cycle)}>
                              View <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* START CYCLE CONFIRMATION DIALOG */}
      <Dialog open={showStartCycleModal} onOpenChange={setShowStartCycleModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Play className="w-5 h-5" /> Start {activeCycle?.name || "Next"} Cycle
            </DialogTitle>
            <DialogDescription>
              This will start the 7-day investment clock for all {approvedInvestments.length} approved investment(s).
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg space-y-2 text-sm font-mono border">
            <div className="flex justify-between">
              <span>Approved Investments:</span>
              <span className="font-bold">{approvedInvestments.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Eligible Units (will lock):</span>
              <span className="font-bold text-amber-500">{counts.approved || 0} units</span>
            </div>
            <div className="flex justify-between">
              <span>Cycle Duration:</span>
              <span className="font-bold">{cycleData?.isDevMode ? `${Math.round((cycleData.cycleDurationMs || 0) / 60000)} mins (DEV)` : "7 days"}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
              <span>Start timestamp:</span>
              <span>Server NOW() — not client time</span>
            </div>
          </div>
          <p className="text-xs text-amber-600">
            ⚠️ Once started, the cycle cannot be stopped. New investments will be queued for the next entry.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartCycleModal(false)}>Cancel</Button>
            <Button
              onClick={() => startCycleMutation.mutate()}
              disabled={startCycleMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {startCycleMutation.isPending ? "Starting..." : "Confirm — Start Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FINALIZE CONFIRMATION DIALOG */}
      <Dialog open={showFinalizeModal} onOpenChange={setShowFinalizeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <ShieldCheck className="w-5 h-5" /> Finalize Distribution
            </DialogTitle>
            <DialogDescription>
              Confirm finalization of {activeCycle?.name}. This will credit investor balances.
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm font-mono border">
              <div className="flex justify-between">
                <span>Community Profit:</span>
                <span className="font-bold text-green-500">${Number(previewData.community_profit).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Eligible Units:</span>
                <span className="font-bold">{previewData.eligible_units}</span>
              </div>
              <div className="flex justify-between">
                <span>PPSU:</span>
                <span className="font-bold text-primary">${previewData.ppsu}/unit</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Investors Paid:</span>
                <span className="font-bold">{new Set(previewData.distributions.map((d: any) => d.user_id)).size}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-red-500">
            ⚠️ IRREVERSIBLE. Balances will be credited. Next cycle must be manually opened via "Open Entry Window".
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeModal(false)}>Cancel</Button>
            <Button
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {finalizeMutation.isPending ? "Processing..." : "Confirm & Credit Investors"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORICAL PAYOUTS MODAL */}
      <Dialog open={!!selectedHistoricalCycle} onOpenChange={(o) => !o && setSelectedHistoricalCycle(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedHistoricalCycle?.name} — Distribution Records</DialogTitle>
            <DialogDescription>
              Finalized {selectedHistoricalCycle?.finalized_at ? format(new Date(selectedHistoricalCycle.finalized_at), "MMMM dd, yyyy HH:mm") : "N/A"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg text-sm font-mono border">
            <div>
              <span className="text-xs text-muted-foreground block">Profit</span>
              <span className="font-bold text-green-500">${Number(selectedHistoricalCycle?.community_profit || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Units</span>
              <span className="font-bold">{selectedHistoricalCycle?.eligible_units}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">PPSU</span>
              <span className="font-bold text-primary">${Number(selectedHistoricalCycle?.ppsu || 0).toFixed(2)}/unit</span>
            </div>
          </div>
          <div className="rounded-lg border max-h-[350px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Investor</TableHead>
                  <TableHead className="text-center">Units</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Total Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions
                  .filter((d: any) => d.cycle_id === selectedHistoricalCycle?.id)
                  .map((d: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{d.user_name}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{d.eligible_units}</TableCell>
                      <TableCell className="text-right font-mono">${Number(d.investment_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-green-500">+${Number(d.profit).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-bold">${Number(d.total_return).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
