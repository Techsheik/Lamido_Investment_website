import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Pencil, CheckCircle, X, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { EditInvestmentDialog } from "@/components/admin/EditInvestmentDialog";

const AdminInvestments = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editingInvestment, setEditingInvestment] = useState<any>(null);

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
        }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ investment, status }: { investment: any; status: string }) => {
      let roiAmount = 0;
      if (status === "completed") {
        const roiPercentage = investment.roi || investment.profile?.weekly_roi_percentage || 10;
        roiAmount = Number(investment.amount) * (Number(roiPercentage) / 100);
      }

      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          status: status,
          roiAmount: roiAmount
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

  const activateInvestmentMutation = useMutation({
    mutationFn: async (investment: any) => {
      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          status: "active"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to activate investment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      toast({
        title: "Success",
        description: "Investment activated! Progress will now start counting.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to activate investment: " + error.message,
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

  const bulkActivateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/bulk-activate-investments", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to bulk activate investments");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      toast({
        title: "Success",
        description: `Successfully activated pending investments. Progress will now start for those users.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to bulk activate: " + error.message,
        variant: "destructive",
      });
    },
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Investments Management</h1>
          <Button 
            onClick={() => bulkActivateMutation.mutate()}
            disabled={bulkActivateMutation.isPending || !investments?.some((i: any) => i.status === "pending" || i.status === "approved")}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {bulkActivateMutation.isPending ? "Activating..." : "Activate All Pending"}
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>User Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Weekly ROI (%)</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investments && investments.length > 0 ? (
                investments.map((investment: any) => (
                  <TableRow key={investment.id}>
                    <TableCell>{investment.profile?.name}</TableCell>
                    <TableCell className="font-mono">{investment.profile?.user_code}</TableCell>
                    <TableCell className="capitalize">{investment.type}</TableCell>
                    <TableCell>${Number(investment.amount).toFixed(2)}</TableCell>
                    <TableCell>{Number(investment.roi || investment.profile?.weekly_roi_percentage || 10).toFixed(2)}%</TableCell>
                    <TableCell>{investment.duration} days</TableCell>
                    <TableCell>
                      {investment.start_date 
                        ? format(new Date(investment.start_date), "MMM dd, yyyy") 
                        : <span className="text-muted-foreground italic text-xs">Not started</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          investment.status === "active" ? "default" : 
                          (investment.status === "pending" || investment.status === "approved") ? "secondary" : 
                          investment.status === "suspended" ? "destructive" :
                          "outline"
                        }
                        className={
                          investment.status === "approved" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200" : 
                          investment.status === "suspended" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200" : ""
                        }
                      >
                        {investment.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingInvestment(investment)}
                        disabled={investment.status === "completed" || investment.status === "rejected"}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => activateInvestmentMutation.mutate(investment)}
                        disabled={investment.status !== "pending" && investment.status !== "approved"}
                        title="Activate Investment"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      
                      {investment.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500 text-amber-600 hover:bg-amber-50"
                          onClick={() => updateStatusMutation.mutate({ investment, status: "suspended" })}
                          title="Pause Investment"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      ) : investment.status === "suspended" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-500 text-green-600 hover:bg-green-50"
                          onClick={() => updateStatusMutation.mutate({ investment, status: "active" })}
                          title="Resume Investment"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ investment, status: "completed" })}
                        disabled={investment.status !== "active" && investment.status !== "suspended"}
                        title="Complete Investment"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => rejectInvestmentMutation.mutate(investment)}
                        disabled={investment.status === "completed" || investment.status === "rejected"}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No investments found
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
