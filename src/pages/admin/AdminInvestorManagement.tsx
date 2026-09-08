import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreateEditInvestorDialog } from "@/components/admin/CreateEditInvestorDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const AdminInvestorManagement = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editingInvestor, setEditingInvestor] = useState<any>(null);
  const [creatingInvestor, setCreatingInvestor] = useState(false);
  const [deletingInvestorId, setDeletingInvestorId] = useState<string | null>(
    null
  );

  // Fetch all investor records (via investments table)
  const { data: investors, isLoading, refetch } = useQuery({
    queryKey: ["admin-investors"],
    refetchInterval: 10000, 
    queryFn: async () => {
      console.log("Fetching admin-investors via API...");
      const response = await fetch("/api/admin/get-investments");
      if (!response.ok) {
        throw new Error("Failed to fetch investors from admin API");
      }
      const data = await response.json();

      console.log("Investments data received:", data?.length, "records");

        const mappedData = (data || []).map((inv: any) => {
          const profile = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles;
          const units = Number(inv.units || Math.max(1, Math.round(Number(inv.amount || 70) / 70)));
          const amount = units * 70;

          return {
            ...inv,
            profile: profile || null,
            units,
            amount,
          };
        });

        return mappedData;
      },
    });

  // Delete investor mutation
  const deleteInvestorMutation = useMutation({
    mutationFn: async (investorId: string) => {
      const response = await fetch("/api/admin/delete-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investmentId: investorId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete investor");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-investors"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-investments"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["investments"] })
      ]);
      toast({
        title: "Success",
        description: "Investor record deleted successfully",
      });
      setDeletingInvestorId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete investor: " + error.message,
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

  const totalUnits = investors?.reduce(
    (sum: number, inv: any) => sum + Number(inv.units || 1),
    0
  ) || 0;

  const totalInvestorAmount = totalUnits * 70;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Investor Management</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage user investments (Total Active Share Units: {totalUnits})
            </p>
          </div>
          <Button onClick={() => setCreatingInvestor(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Investment
          </Button>
        </div>

        {investors && investors.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Share Units</TableHead>
                  <TableHead>Investment Amount</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.map((investor: any) => (
                  <TableRow key={investor.id}>
                    <TableCell className="font-semibold">
                      {investor.profile?.name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {investor.user_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {investor.profile?.email || "N/A"}
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      {investor.units || 1} unit{(investor.units || 1) !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(investor.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(() => {
                        if (!investor.start_date) return "N/A";
                        const d = new Date(investor.start_date);
                        if (isNaN(d.getTime())) return "N/A";
                        try { return format(d, "MMM dd, yyyy"); } catch (e) { return "N/A"; }
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          investor.status === "active" ? "default" : "secondary"
                        }
                      >
                        {investor.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingInvestor(investor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingInvestorId(investor.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">No investments setup yet</p>
              <Button onClick={() => setCreatingInvestor(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Investment for Registered User
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Investor statistics */}
        {investors && investors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Investors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{investors.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Active Share Units
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{totalUnits} units</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Capital Invested
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totalInvestorAmount.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Investments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {investors.filter((i: any) => i.status === "active").length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" />
              How Admin Creates Investments for Users
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Click "Add Investment" to create an investment for an existing registered user.
            </p>
            <p>
              • Select the user from the registered user accounts list.
            </p>
            <p>
              • Assign the number of Share Units ($70 per unit). The investment amount calculates automatically.
            </p>
            <p>
              • All investments automatically synchronize with the user's dashboard and 7-day cycle calculations.
            </p>
          </CardContent>
        </Card>
      </div>

      <CreateEditInvestorDialog
        investor={editingInvestor}
        open={!!editingInvestor || creatingInvestor}
        onOpenChange={(open) => {
          if (!open) {
            setEditingInvestor(null);
            setCreatingInvestor(false);
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingInvestorId}
        onOpenChange={(open) => !open && setDeletingInvestorId(null)}
        onConfirm={() =>
          deletingInvestorId && deleteInvestorMutation.mutate(deletingInvestorId)
        }
        title="Delete Investor Record"
        description="Are you sure you want to delete this investor record? This action cannot be undone."
      />
    </AdminLayout>
  );
};

export default AdminInvestorManagement;
