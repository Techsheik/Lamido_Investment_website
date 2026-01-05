import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Pencil, CheckCircle, X } from "lucide-react";
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

  const completeInvestmentMutation = useMutation({
    mutationFn: async (investment: any) => {
      const roiPercentage = investment.roi || investment.profile?.weekly_roi_percentage || 10;
      const roiAmount = Number(investment.amount) * (Number(roiPercentage) / 100);

      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          status: "completed",
          roiAmount: roiAmount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to complete investment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: "Investment marked as completed and ROI added to user balance",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete investment: " + error.message,
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
        <h1 className="text-3xl font-bold">Investments Management</h1>
        
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
                    <TableCell>{format(new Date(investment.start_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          investment.status === "active" ? "default" : 
                          investment.status === "pending" ? "secondary" : 
                          "outline"
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
                        variant="outline"
                        size="sm"
                        onClick={() => completeInvestmentMutation.mutate(investment)}
                        disabled={investment.status === "completed" || investment.status === "rejected"}
                      >
                        <CheckCircle className="w-4 h-4" />
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
