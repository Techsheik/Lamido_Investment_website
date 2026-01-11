import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Bell, CheckCircle, Info, AlertTriangle, XCircle } from "lucide-react";

const AdminNotifications = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`*, profiles:user_id(id, name, email)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((n: any) => ({
        ...n,
        profile: Array.isArray(n.profiles) ? n.profiles[0] : n.profiles,
      }));
    },
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast({ title: "Notification Deleted" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  if (isLoading) return <AdminLayout><div>Loading...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">System Notifications</h1>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Notification</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications?.map((notif: any) => (
                <TableRow key={notif.id} className={!notif.read ? "bg-muted/30 font-medium" : ""}>
                  <TableCell>
                    <Badge variant={notif.type === "error" ? "destructive" : "outline"} className="capitalize">
                      {notif.type || 'info'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{notif.title}</span>
                      <span className="text-sm text-muted-foreground">{notif.message}</span>
                    </div>
                  </TableCell>
                  <TableCell>{notif.profile?.name || "System"}</TableCell>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {!notif.read && (
                      <Button variant="ghost" size="sm" onClick={() => markAsReadMutation.mutate(notif.id)}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(notif.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
