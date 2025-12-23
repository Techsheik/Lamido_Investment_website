import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Pencil, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { EditInvestmentDialog } from "@/components/admin/EditInvestmentDialog";

const AdminInvestments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingInvestment, setEditingInvestment] = useState<any>(null);

  const { data: investments, isLoading } = useQuery({
    queryKey: ["admin-investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select(`
          *,
          profiles(name, user_code, balance)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const completeInvestmentMutation = useMutation({
    mutationFn: async (investment: any) => {
      // Update investment status
      const { error: invError } = await supabase
        .from("investments")
        .update({ status: "completed" })
        .eq("id", investment.id);

      if (invError) throw invError;

      // Add ROI to user balance
      const newBalance = Number(investment.profiles.balance) + Number(investment.roi);
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", investment.user_id);

      if (balanceError) throw balanceError;
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
                <TableHead>ROI</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investments?.map((investment: any) => (
                <TableRow key={investment.id}>
                  <TableCell>{investment.profiles?.name}</TableCell>
                  <TableCell className="font-mono">{investment.profiles?.user_code}</TableCell>
                  <TableCell className="capitalize">{investment.type}</TableCell>
                  <TableCell>${Number(investment.amount).toFixed(2)}</TableCell>
                  <TableCell>${Number(investment.roi).toFixed(2)}</TableCell>
                  <TableCell>{investment.duration} days</TableCell>
                  <TableCell>{format(new Date(investment.start_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={investment.status === "active" ? "default" : "secondary"}>
                      {investment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingInvestment(investment)}
                      disabled={investment.status === "completed"}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => completeInvestmentMutation.mutate(investment)}
                      disabled={investment.status === "completed"}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
