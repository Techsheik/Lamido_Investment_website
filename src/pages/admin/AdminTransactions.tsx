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
      let query = supabase
        .from("transactions")
        .select(`
          *,
          profiles(name, user_code, balance, email),
          virtual_accounts(account_number, bank_name)
        `);

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateFilter);
        endDate.setHours(23, 59, 59, 999);
        query = query.gte("created_at", startDate.toISOString())
                     .lte("created_at", endDate.toISOString());
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Apply search filter
      if (searchQuery) {
        return data.filter((t: any) => 
          t.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.profiles?.user_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, transaction }: { id: string; status: string; transaction: any }) => {
      // Update transaction status
      const { error } = await supabase
        .from("transactions")
        .update({ 
          status: status === "approved" ? "completed" : status,
          approved_at: new Date().toISOString(),
          approved_by: user?.id 
        })
        .eq("id", id);

      if (error) throw error;

      // If approved deposit, add to user balance
      if (status === "approved" && transaction.type === "deposit") {
        const currentBalance = Number(transaction.profiles?.balance || 0);
        const newBalance = currentBalance + Number(transaction.amount);
        
        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", transaction.user_id);

        if (balanceError) throw balanceError;
      }

      // If approved withdrawal, deduct from user balance
      if (status === "approved" && transaction.type === "withdrawal") {
        const currentBalance = Number(transaction.profiles?.balance || 0);
        const newBalance = currentBalance - Number(transaction.amount);
        
        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", transaction.user_id);

        if (balanceError) throw balanceError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
                    <TableCell>{transaction.profiles?.name || "N/A"}</TableCell>
                    <TableCell className="font-mono">{transaction.profiles?.user_code || "N/A"}</TableCell>
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
