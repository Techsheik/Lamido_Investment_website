import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { ArrowLeft, Save, Download, Check, X, FlaskConical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminUserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<any>({});
  const [bankData, setBankData] = useState<any>({});

  const { data: userDetail, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(`/api/admin/get-user-detail?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch user detail");
      const data = await response.json();
      
      if (data.profile) {
        setFormData({
          name: data.profile.name,
          email: data.profile.email,
          phone: data.profile.phone,
          balance: data.profile.balance,
          total_invested: data.profile.total_invested || 0,
          total_roi: data.profile.total_roi,
          accrued_return: data.profile.accrued_return || 0,
          roi_percentage: data.profile.roi_percentage,
          weekly_roi_percentage: data.profile.weekly_roi_percentage,
          account_status: data.profile.account_status,
        });
        setBankData({
          bank_name: data.profile.bank_name || "",
          account_number: data.profile.account_number || "",
          account_holder_name: data.profile.account_holder_name || "",
        });
      }
      return data;
    },
    enabled: !!userId,
  });

  const user = userDetail?.profile;
  const transactions = userDetail?.transactions;
  const investments = userDetail?.investments;

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }
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

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated. Please sign in again.");

      const response = await fetch("/api/admin/update-transaction-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ id, status, userId, type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      toast({
        title: "Success",
        description: "Transaction updated successfully",
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

  const activateInvestmentMutation = useMutation({
    mutationFn: async (investmentId: string) => {
      const response = await fetch("/api/admin/update-investment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId,
          status: "active"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to activate investment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast({
        title: "Success",
        description: "Investment activated successfully",
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

  // Toggle test account flag (without clearing data)
  const toggleTestFlagMutation = useMutation({
    mutationFn: async (isTest: boolean) => {
      const response = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, is_test_account: isTest }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update test flag");
      }
      return response.json();
    },
    onSuccess: (_, isTest) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: isTest ? "✅ Marked as Test Account" : "✅ Test Flag Removed",
        description: isTest
          ? "This account will be excluded from all cycle distributions."
          : "This account will now be included in cycle distributions.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Clear all financial data for test account
  const clearTestAccountMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/admin/clear-test-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to clear test account");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "🧹 Account Cleared",
        description: data.message || "Test account data cleared successfully.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      ...formData,
      ...bankData,
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{user?.name}</h1>
              {user?.user_code && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono text-sm px-3 py-1">
                  {user.user_code}
                </Badge>
              )}
              {user?.is_test_account && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 gap-1">
                  <FlaskConical className="h-3 w-3" />
                  Test Account
                </Badge>
              )}
            </div>
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
              <div className="text-2xl font-bold">${Number(user?.total_invested || totalInvested || 0).toFixed(2)}</div>
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
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
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
                      value={formData.balance || 0}
                      onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Total Invested ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.total_invested || 0}
                      onChange={(e) => setFormData({ ...formData, total_invested: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Total ROI ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.total_roi || 0}
                      onChange={(e) => setFormData({ ...formData, total_roi: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Accrued Return ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.accrued_return || 0}
                      onChange={(e) => setFormData({ ...formData, accrued_return: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ROI Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.roi_percentage || 0}
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
                      value={formData.weekly_roi_percentage || 0}
                      onChange={(e) => setFormData({ ...formData, weekly_roi_percentage: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bank Details for Payouts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={bankData.bank_name || ""} onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={bankData.account_number || ""} onChange={(e) => setBankData({ ...bankData, account_number: e.target.value })} />
                </div>
                <div>
                  <Label>Account Holder Name</Label>
                  <Input value={bankData.account_holder_name || ""} onChange={(e) => setBankData({ ...bankData, account_holder_name: e.target.value })} />
                </div>
                <Button onClick={handleSave} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save All Changes
                </Button>
              </CardContent>
            </Card>

            {/* Test Account Controls */}
            <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <FlaskConical className="h-5 w-5" />
                  Test Account Controls
                </CardTitle>
                <CardDescription>
                  Mark this account as a test account to exclude it from cycle profit distributions. Admin access is not affected.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant={user?.is_test_account ? "outline" : "secondary"}
                    className={user?.is_test_account ? "border-green-500 text-green-700" : "border-amber-400 text-amber-700"}
                    onClick={() => toggleTestFlagMutation.mutate(!user?.is_test_account)}
                    disabled={toggleTestFlagMutation.isPending}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    {user?.is_test_account ? "Remove Test Account Flag" : "Mark as Test Account"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={clearTestAccountMutation.isPending}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear Account Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear Test Account Data?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>This will <strong>permanently zero out</strong> all financial data for <strong>{user?.name}</strong> ({user?.user_code}):</p>
                          <ul className="list-disc ml-4 text-sm space-y-1">
                            <li>Balance → $0</li>
                            <li>Accrued Return → $0</li>
                            <li>Total ROI → $0</li>
                            <li>All investments → cancelled</li>
                            <li>All pending transactions → rejected</li>
                            <li>Marked as test account (excluded from distributions)</li>
                          </ul>
                          <p className="text-orange-600 dark:text-orange-400 font-medium mt-2">
                            ⚠️ Admin access and profile info are NOT touched.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => clearTestAccountMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Yes, Clear Everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {user?.is_test_account && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-md px-3 py-2">
                    🧪 This account is flagged as a test account and will be <strong>excluded from all cycle distributions</strong>.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
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
                            onClick={() => updateTransactionMutation.mutate({
                              id: transaction.id,
                              status: "approved",
                              type: transaction.type
                            })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateTransactionMutation.mutate({
                              id: transaction.id,
                              status: "rejected",
                              type: transaction.type
                            })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Investments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {investments?.slice(0, 5).map((inv: any) => (
                    <div key={inv.id} className="text-sm border-b pb-2 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">${Number(inv.amount).toFixed(2)}</span>
                        <div className="flex gap-2 items-center">
                          {(inv.status === "pending" || inv.status === "approved") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] px-2"
                              onClick={() => activateInvestmentMutation.mutate(inv.id)}
                            >
                              Activate
                            </Button>
                          )}
                          <Badge 
                            variant={(inv.status === "active" || inv.status === "approved") ? "default" : inv.status === "suspended" ? "destructive" : "secondary"}
                            className={
                              inv.status === "approved" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200" : 
                              inv.status === "suspended" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200" : ""
                            }
                          >
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "MMM dd, yyyy")}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUserDetail;
