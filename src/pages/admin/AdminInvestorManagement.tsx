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

      const mappedData = (data || [])
        .map((inv: any) => {
        // Handle case where profiles might be an array or a single object
        const profile = Array.isArray(inv.profiles) ? inv.profiles[0] : inv.profiles;
        const roiPercentage = Number(inv.roi || profile?.weekly_roi_percentage || 10);
        const roiAmount = (Number(inv.amount) * roiPercentage) / 100;
        
        return {
          ...inv,
          profile: profile || null,
          calculatedROI: roiAmount,
          roiPercentage: roiPercentage
        };
      });
      
      if (mappedData.length > 0) {
        console.log("Mapped investors data sample:", mappedData[0]);
      } else {
        console.log("No mapped data after filtering. currentUser:", currentUser?.id);
      }
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

  const totalInvestorAmount = investors?.reduce(
    (sum: number, inv: any) => sum + Number(inv.amount),
    0
  ) || 0;

  const totalROI = investors?.reduce(
    (sum: number, inv: any) => sum + Number(inv.calculatedROI || 0),
    0
  ) || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Investor Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage and track investor data (Total: {investors?.length || 0})
            </p>
          </div>
          <Button onClick={() => setCreatingInvestor(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Investor
          </Button>
        </div>

        {investors && investors.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor Name</TableHead>
                  <TableHead>User ID (Debug)</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Investment Amount</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>ROI</TableHead>
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
                      {currentUser?.id === investor.user_id && (
                        <span className="ml-1 text-red-500 font-bold">(YOU)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {investor.profile?.email || "N/A"}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(investor.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {investor.investment_plans?.name || "Custom"}
                    </TableCell>
                    <TableCell className="font-bold text-success">
                      ${Number(investor.calculatedROI).toFixed(2)}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({investor.roiPercentage}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {investor.start_date
                        ? format(new Date(investor.start_date), "MMM dd, yyyy")
                        : "N/A"}
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
              <p className="text-muted-foreground mb-4">No investors added yet</p>
              <Button onClick={() => setCreatingInvestor(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Investor
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
                  Total Investment
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
                  Total ROI Accrued
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  ${totalROI.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Investors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
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
              How to Upload Investor Data
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Click "Add Investor" to manually add a new investor record
            </p>
            <p>
              • Fill in the investor's name, email, investment amount, and ROI
              percentage
            </p>
            <p>
              • Select an investment plan or create a custom ROI percentage
            </p>
            <p>
              • Changes automatically reflect in the user's dashboard in real-time
            </p>
            <p>
              • You can edit or delete investor records at any time
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
