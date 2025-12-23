import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreateEditPlanDialog } from "@/components/admin/CreateEditPlanDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

const AdminPlanBuilder = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // Fetch all investment plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("investment_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["investment-plans"] });
      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      setDeletingPlanId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete plan: " + error.message,
        variant: "destructive",
      });
    },
  });

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "low":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "high":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plan Builder</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage investment plans that users can invest in
            </p>
          </div>
          <Button onClick={() => setCreatingPlan(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create New Plan
          </Button>
        </div>

        {plans && plans.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>ROI (%)</TableHead>
                  <TableHead>Duration (Days)</TableHead>
                  <TableHead>Min Amount</TableHead>
                  <TableHead>Max Amount</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan: any) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-semibold">{plan.name}</TableCell>
                    <TableCell className="font-bold text-success">
                      {plan.roi_percentage}%
                    </TableCell>
                    <TableCell>{plan.duration_days} days</TableCell>
                    <TableCell>${Number(plan.min_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {plan.max_amount
                        ? `$${Number(plan.max_amount).toFixed(2)}`
                        : "No limit"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRiskColor(plan.risk_level)}>
                        {plan.risk_level || "Medium"} Risk
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          plan.is_active ? "default" : "secondary"
                        }
                      >
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPlan(plan)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingPlanId(plan.id)}
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
              <p className="text-muted-foreground mb-4">No investment plans created yet</p>
              <Button onClick={() => setCreatingPlan(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plan statistics */}
        {plans && plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plans.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {plans.filter((p: any) => p.is_active).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Average ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {(
                    plans.reduce((sum: number, p: any) => sum + p.roi_percentage, 0) /
                    plans.length
                  ).toFixed(1)}
                  %
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Highest ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {Math.max(...plans.map((p: any) => p.roi_percentage))}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <CreateEditPlanDialog
        plan={editingPlan}
        open={!!editingPlan || creatingPlan}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPlan(null);
            setCreatingPlan(false);
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingPlanId}
        onOpenChange={(open) => !open && setDeletingPlanId(null)}
        onConfirm={() =>
          deletingPlanId && deletePlanMutation.mutate(deletingPlanId)
        }
        title="Delete Plan"
        description="Are you sure you want to delete this plan? Users won't be able to invest in it anymore."
      />
    </AdminLayout>
  );
};

export default AdminPlanBuilder;
