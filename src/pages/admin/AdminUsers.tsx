import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

const AdminUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          investments(amount, roi)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((user: any) => ({
        ...user,
        totalInvested: user.investments?.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0) || 0,
        totalROI: user.investments?.reduce((sum: number, inv: any) => sum + Number(inv.roi), 0) || 0,
      }));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setDeletingUserId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user: " + error.message,
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Users Management</h1>
          <Button onClick={() => setIsAddingUser(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Total Invested</TableHead>
                <TableHead>Total ROI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{user.user_code}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>${Number(user.balance || 0).toFixed(2)}</TableCell>
                  <TableCell>${user.totalInvested.toFixed(2)}</TableCell>
                  <TableCell>${user.totalROI.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={user.account_status === "active" ? "default" : "secondary"}>
                      {user.account_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser(user)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingUserId(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />

      <AddUserDialog
        open={isAddingUser}
        onOpenChange={setIsAddingUser}
      />

      <DeleteConfirmDialog
        open={!!deletingUserId}
        onOpenChange={(open) => !open && setDeletingUserId(null)}
        onConfirm={() => deletingUserId && deleteUserMutation.mutate(deletingUserId)}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </AdminLayout>
  );
};

export default AdminUsers;
