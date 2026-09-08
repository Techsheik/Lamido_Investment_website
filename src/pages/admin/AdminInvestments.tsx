import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, CheckCircle, X, Layers, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { EditInvestmentDialog } from "@/components/admin/EditInvestmentDialog";
import { AdminCycleManagement } from "@/components/admin/AdminCycleManagement";
import { format } from "date-fns";

const AdminInvestments = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: investments, isLoading } = useQuery({
    queryKey: ["admin-investments"],
    refetchInterval: 10000,
    queryFn: async () => {
      const response = await fetch("/api/admin/get-investments");
      if (!response.ok) {
        throw new Error("Failed to fetch investments from admin API");
      }
      const data = await response.json();

      return (data || [])
        .map((inv: any) => ({
          ...inv,
          profile: Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles,
          entryWindow: Array.isArray(inv.entry_windows) ? inv.entry_windows[0] : inv.entry_windows,
        }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ investment, status }: { investment: any; status: string }) => {
      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          status: status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update status to ${status}`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: `Investment status updated to ${variables.status}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update investment: " + error.message,
        variant: "destructive",
      });
    },
  });

  const rejectInvestmentMutation = useMutation({
    mutationFn: async (investment: any) => {
      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          status: "rejected"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reject investment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: "Investment rejected. User will be notified.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reject investment: " + error.message,
        variant: "destructive",
      });
    },
  });

  const allInvs = investments || [];

  // Filter count metrics
  const counts = {
    all: allInvs.length,
    pending: allInvs.filter((i: any) => i.status === "pending").length,
    approved: allInvs.filter((i: any) => i.status === "approved").length,
    active: allInvs.filter((i: any) => i.status === "active").length,
    completed: allInvs.filter((i: any) => i.status === "completed").length,
    rejected: allInvs.filter((i: any) => i.status === "rejected" || i.status === "suspended").length,
  };

  // Filtered dataset
  const filteredInvestments = allInvs.filter((inv: any) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return inv.status === "pending";
    if (statusFilter === "approved") return inv.status === "approved";
    if (statusFilter === "active") return inv.status === "active";
    if (statusFilter === "completed") return inv.status === "completed";
    if (statusFilter === "rejected") return inv.status === "rejected" || inv.status === "suspended";
    return true;
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div>Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* 7-Day Cycle Management System */}
        <AdminCycleManagement />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t">
          <div>
            <h2 className="text-2xl font-bold">Investor Subscriptions & Investments</h2>
            <p className="text-sm text-muted-foreground">
              Approve or reject individual investments below. Use the Cycle Control above to start the cycle and activate all approved investments.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 pb-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
            className="text-xs gap-1.5"
          >
            All <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{counts.all}</Badge>
          </Button>

          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
            className={`text-xs gap-1.5 ${statusFilter === "pending" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
          >
            Pending <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300">{counts.pending}</Badge>
          </Button>

          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("approved")}
            className={`text-xs gap-1.5 ${statusFilter === "approved" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
          >
            Approved <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-300">{counts.approved}</Badge>
          </Button>

          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
            className={`text-xs gap-1.5 ${statusFilter === "active" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
          >
            Active in Cycle <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">{counts.active}</Badge>
          </Button>

          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("completed")}
            className={`text-xs gap-1.5 ${statusFilter === "completed" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}`}
          >
            Distributed <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300">{counts.completed}</Badge>
          </Button>

          <Button
            variant={statusFilter === "rejected" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("rejected")}
            className={`text-xs gap-1.5 ${statusFilter === "rejected" ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
          >
            Rejected <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-red-500/20 text-red-600 dark:text-red-300">{counts.rejected}</Badge>
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor (Name & Code)</TableHead>
                <TableHead>Cycle Tag</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Timeline (Submitted / Started)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvestments.length > 0 ? (
                filteredInvestments.map((investment: any) => {
                  const cycleNum = investment.entryWindow?.cycle_number;
                  return (
                    <TableRow key={investment.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-sm">{investment.profile?.name || "Unknown User"}</span>
                          <span className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">{investment.profile?.user_code || "N/A"}</span>
                        </div>
                      </TableCell>
                      
                      {/* Cycle Tag Column */}
                      <TableCell>
                        {investment.status === "completed" ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[11px] font-mono gap-1">
                            <CheckCircle2 className="w-3 h-3 text-purple-500" />
                            {cycleNum ? `Cycle #${cycleNum} (Paid)` : "Distributed"}
                          </Badge>
                        ) : cycleNum ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[11px] font-mono gap-1">
                            <Layers className="w-3 h-3 text-blue-500" />
                            Cycle #{cycleNum}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] italic">
                            Unattached
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="capitalize">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-medium text-foreground text-xs">{investment.type}</span>
                          {investment.type?.toLowerCase().includes("reinvestment") && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold tracking-wide">
                              🔄 REINVESTMENT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold font-mono text-center text-xs">{investment.units || 1} unit(s)</TableCell>
                      <TableCell className="font-mono text-sm font-semibold">${Number(investment.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col text-[11px] space-y-0.5 font-mono">
                          <span className="text-muted-foreground">
                            Sub: <span className="font-medium text-foreground">{investment.created_at ? format(new Date(investment.created_at), "MMM dd, HH:mm") : "N/A"}</span>
                          </span>
                          {investment.start_date ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              Start: {format(new Date(investment.start_date), "MMM dd, HH:mm")}
                            </span>
                          ) : (
                            <span className="text-amber-500 italic text-[10px]">Awaiting start</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            investment.status === "active" ? "default" : 
                            (investment.status === "pending" || investment.status === "approved") ? "secondary" : 
                            investment.status === "suspended" || investment.status === "rejected" ? "destructive" :
                            "outline"
                          }
                          className={
                            investment.status === "approved" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200" : 
                            investment.status === "completed" ? "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200" :
                            investment.status === "suspended" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200" : ""
                          }
                        >
                          {investment.status === "completed" ? "DISTRIBUTED" : (investment.status || "PENDING").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingInvestment(investment)}
                          disabled={investment.status === "completed" || investment.status === "rejected"}
                          title="Edit Investment"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateStatusMutation.mutate({ investment, status: "approved" })}
                          disabled={investment.status !== "pending"}
                          title="Approve Investment"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => rejectInvestmentMutation.mutate(investment)}
                          disabled={investment.status === "rejected" || investment.status === "completed"}
                          title="Decline Investment"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No investments found {statusFilter !== "all" ? `with status "${statusFilter.toUpperCase()}"` : ""}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditInvestmentDialog
        investment={editingInvestment}
        open={!!editingInvestment}
        onOpenChange={(open) => !open && setEditingInvestment(null)}
      />
    </AdminLayout>
  );
};

export default AdminInvestments;
