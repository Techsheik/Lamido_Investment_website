import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AddAdminDialog } from "@/components/admin/AddAdminDialog";

const AdminManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin-management"],
    queryFn: async () => {
      const response = await fetch("/api/admin/manage-admins");
      if (!response.ok) throw new Error("Failed to fetch admins");
      return await response.json();
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/manage-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove admin access");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-management"] });
      toast({ title: "Success", description: "Admin access removed" });
      setRemovingAdminId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setRemovingAdminId(null);
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
          <div>
            <h1 className="text-3xl font-bold">Admin Management</h1>
            <p className="text-muted-foreground mt-1">Manage platform administrators</p>
          </div>
          <Button onClick={() => setIsAddingAdmin(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    <p className="text-muted-foreground">No admins found</p>
                  </TableCell>
                </TableRow>
              ) : (
                admins?.map((admin: any) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {admin.name}
                      </div>
                    </TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.account_status === "active" ? "default" : "secondary"}>
                        {admin.account_status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {admin.created_at ? formatDistanceToNow(new Date(admin.created_at), { addSuffix: true }) : "Just now"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={removingAdminId === admin.user_id}
                        onClick={() => {
                          setRemovingAdminId(admin.user_id);
                          removeAdminMutation.mutate(admin.user_id);
                        }}
                      >
                        {removingAdminId === admin.user_id ? (
                          <>
                            <span className="inline-block animate-spin mr-1">⏳</span>
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Admin Management Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Admins have full access to the admin dashboard</p>
            <p>• Admins can create announcements, manage users, and view all platform data</p>
            <p>• You can remove admin access by clicking the "Remove" button</p>
            <p>• To create a new admin, use the "Add Admin" button above</p>
          </CardContent>
        </Card>
      </div>

      <AddAdminDialog
        open={isAddingAdmin}
        onOpenChange={setIsAddingAdmin}
      />
    </AdminLayout>
  );
};

export default AdminManagement;
