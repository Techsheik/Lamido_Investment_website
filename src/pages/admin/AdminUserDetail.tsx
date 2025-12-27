import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Download } from "lucide-react";
import { format } from "date-fns";

const AdminUserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<any>({});
  const [bankData, setBankData] = useState<any>({});

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) {
        setFormData({
          name: data.name,
          email: data.email,
          phone: data.phone,
          balance: data.balance,
          total_roi: data.total_roi,
          accrued_return: data.accrued_return || 0,
          roi_percentage: data.roi_percentage,
          weekly_roi_percentage: data.weekly_roi_percentage,
          account_status: data.account_status,
        });
        setBankData({
          bank_name: data.bank_name || "",
          account_number: data.account_number || "",
          account_holder_name: data.account_holder_name || "",
        });
      }
      return data;
    },
    enabled: !!userId,
  });

  const { data: transactions } = useQuery({
    queryKey: ["user-transactions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: investments } = useQuery({
    queryKey: ["user-investments", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...data.profile,
          ...data.bank,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: "User details updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "completed", approved_at: new Date().toISOString() })
        .eq("id", transactionId);
      if (error) throw error;

      const transaction = transactions?.find((t: any) => t.id === transactionId);
      if (transaction?.type === "deposit") {
        const currentBalance = Number(user?.balance || 0);
        await supabase
          .from("profiles")
          .update({ balance: currentBalance + Number(transaction.amount) })
          .eq("id", userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-transactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast({
        title: "Success",
        description: "Payment approved and balance updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "rejected" })
        .eq("id", transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-transactions", userId] });
      toast({
        title: "Success",
        description: "Payment rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
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

  const handleSave = () => {
    updateUserMutation.mutate({
      profile: formData,
      bank: bankData,
    });
  };

  const totalInvested = investments?.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0) || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{user?.name}</h1>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${Number(user?.balance || 0).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Invested</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInvested.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${Number(user?.total_roi || 0).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weekly ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{Number(user?.weekly_roi_percentage || 10).toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* User Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Account Status</Label>
                    <Select value={formData.account_status} onValueChange={(v) => setFormData({ ...formData, account_status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Metrics Section */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Metrics</CardTitle>
                <CardDescription>Manage user balance and ROI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Current Balance ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Total ROI ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.total_roi}
                      onChange={(e) => setFormData({ ...formData, total_roi: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Accrued Return ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.accrued_return}
                      onChange={(e) => setFormData({ ...formData, accrued_return: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Weekly returns accrued (7+ days)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ROI Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.roi_percentage}
                      onChange={(e) => setFormData({ ...formData, roi_percentage: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Weekly ROI Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.weekly_roi_percentage}
                      onChange={(e) => setFormData({ ...formData, weekly_roi_percentage: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Market-based weekly return percentage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Details Section */}
            <Card>
              <CardHeader>
                <CardTitle>Bank Details for Payouts</CardTitle>
                <CardDescription>Where to send ROI and withdrawal returns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={bankData.bank_name} onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={bankData.account_number} onChange={(e) => setBankData({ ...bankData, account_number: e.target.value })} />
                </div>
                <div>
                  <Label>Account Holder Name</Label>
                  <Input value={bankData.account_holder_name} onChange={(e) => setBankData({ ...bankData, account_holder_name: e.target.value })} />
                </div>
                <Button onClick={handleSave} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save All Changes
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Sidebar */}
          <div className="space-y-6">
            {/* Pending Payments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transactions?.filter((t: any) => t.status === "pending" && t.type === "deposit").length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending payments</p>
                ) : (
                  transactions
                    ?.filter((t: any) => t.status === "pending" && t.type === "deposit")
                    .slice(0, 5)
                    .map((transaction: any) => (
                      <div key={transaction.id} className="border rounded p-2 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">${Number(transaction.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{transaction.reference}</p>
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={() => approveTransactionMutation.mutate(transaction.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => rejectTransactionMutation.mutate(transaction.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {!transactions || transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions</p>
                  ) : (
                    transactions.slice(0, 10).map((transaction: any) => (
                      <div key={transaction.id} className="border-b pb-2 last:border-b-0">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium capitalize">{transaction.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transaction.created_at), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${Number(transaction.amount).toFixed(2)}</p>
                            <Badge variant={transaction.status === "completed" ? "default" : "secondary"} className="text-xs">
                              {transaction.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* All Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!transactions || transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No transactions
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="text-sm">{format(new Date(transaction.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="capitalize text-sm">{transaction.type}</TableCell>
                        <TableCell className="font-semibold">${Number(transaction.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-mono">{transaction.reference || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={transaction.status === "completed" ? "default" : transaction.status === "rejected" ? "destructive" : "secondary"}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUserDetail;
