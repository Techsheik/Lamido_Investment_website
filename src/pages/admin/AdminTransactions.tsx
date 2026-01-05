import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Filter, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminTransactions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions", statusFilter, typeFilter, dateFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (dateFilter) params.append("date", dateFilter);

      const response = await fetch(`/api/admin/get-transactions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      
      const data = await response.json();
      const mappedData = (data || []).map((t: any) => ({
        ...t,
        profile: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
      }));

      // Apply search filter client-side as before
      if (searchQuery) {
        return mappedData.filter((t: any) => 
          t.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.profile?.user_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      return mappedData;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, transaction }: { id: string; status: string; transaction: any }) => {
      const response = await fetch("/api/admin/update-transaction-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          adminId: user?.id,
          amount: transaction.amount,
          type: transaction.type,
          userId: transaction.user_id,
          currentBalance: transaction.profile?.balance || 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      const message = variables.status === "approved" 
        ? variables.transaction.type === "withdrawal"
          ? "Withdrawal approved and balance deducted"
          : "Transaction approved successfully"
        : "Transaction rejected";
      toast({
        title: "Success",
        description: message,
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Transactions Management</h1>
        
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </div>
            {(statusFilter !== "all" || typeFilter !== "all" || dateFilter || searchQuery) && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setDateFilter("");
                  setSearchQuery("");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
        
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>User Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                transactions.map((transaction: any) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.profile?.name || "N/A"}</TableCell>
                    <TableCell className="font-mono">{transaction.profile?.user_code || "N/A"}</TableCell>
                    <TableCell className="capitalize">
                      <Badge variant={transaction.type === "deposit" ? "default" : "secondary"}>
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(transaction.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.reference || "N/A"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(transaction.date || transaction.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          transaction.status === "completed" || transaction.status === "approved" ? "default" : 
                          transaction.status === "pending" ? "secondary" : 
                          "destructive"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(transaction.status === "pending" || transaction.status === "failed") && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateStatus.mutate({ 
                              id: transaction.id, 
                              status: "approved",
                              transaction 
                            })}
                            disabled={updateStatus.isPending}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatus.mutate({ 
                              id: transaction.id, 
                              status: "rejected",
                              transaction 
                            })}
                            disabled={updateStatus.isPending}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTransactions;
