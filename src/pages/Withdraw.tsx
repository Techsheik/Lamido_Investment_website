import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const Withdraw = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: investments } = useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("last_withdrawal_date, balance")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalInvested = investments?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  
  // Calculate Total Accrued Return (only for investments that have completed at least 7 days)
  const investmentReturns = investments?.reduce((sum, inv) => {
    if (!inv.start_date) return sum;
    
    const startDate = new Date(inv.start_date);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only count returns if investment has completed at least 7 days
    if (daysPassed >= 7) {
      const totalReturn = Number(inv.amount) * Number(inv.roi) / 100;
      return sum + totalReturn;
    }
    
    return sum;
  }, 0) || 0;

  const totalAccruedReturn = investmentReturns + Number(profile?.balance || 0);

  // Check if user can withdraw (must be at least 7 days since last withdrawal or first time)
  const canWithdraw = () => {
    if (!profile?.last_withdrawal_date) return true; // First withdrawal
    
    const lastWithdrawal = new Date(profile.last_withdrawal_date);
    const now = new Date();
    const daysSinceLastWithdrawal = Math.floor((now.getTime() - lastWithdrawal.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceLastWithdrawal >= 7;
  };

  const daysUntilNextWithdrawal = () => {
    if (!profile?.last_withdrawal_date) return 0;
    
    const lastWithdrawal = new Date(profile.last_withdrawal_date);
    const now = new Date();
    const daysSinceLastWithdrawal = Math.floor((now.getTime() - lastWithdrawal.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 7 - daysSinceLastWithdrawal);
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const withdrawalAmount = parseFloat(amount);
    
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount.",
        variant: "destructive",
      });
      return;
    }

    if (!canWithdraw()) {
      const daysRemaining = daysUntilNextWithdrawal();
      toast({
        title: "Withdrawal Not Available",
        description: `You can withdraw again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Withdrawals are allowed once every 7 days.`,
        variant: "destructive",
      });
      return;
    }

    if (withdrawalAmount > totalAccruedReturn) {
      toast({
        title: "Insufficient Funds",
        description: `You can only withdraw up to $${totalAccruedReturn.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create withdrawal transaction
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "withdrawal",
        amount: withdrawalAmount,
        status: "pending",
        date: new Date().toISOString(),
      });

      if (transactionError) throw transactionError;

      // Update last withdrawal date
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ last_withdrawal_date: new Date().toISOString() })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "✅ Withdrawal Request Submitted",
        description: "Your withdrawal request has been submitted. You'll be notified once processed.",
      });

      setIsOpen(false);
      setAmount("");
      setPaymentMethod("");
    } catch (error) {
      console.error("Withdrawal request error:", error);
      toast({
        title: "Error",
        description: "Failed to submit withdrawal request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Withdraw Funds</h1>
          <p className="text-muted-foreground mt-2">Request withdrawal of your accrued returns</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalInvested.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total invested capital</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available to Withdraw
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${totalAccruedReturn.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Accrued returns + Wallet balance</p>
              {!canWithdraw() && (
                <p className="text-xs text-destructive mt-2">
                  Next withdrawal available in {daysUntilNextWithdrawal()} day{daysUntilNextWithdrawal() !== 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request Withdrawal</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="w-full md:w-auto" disabled={totalAccruedReturn <= 0 || !canWithdraw()}>
                  Request Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdrawal Request</DialogTitle>
                  <DialogDescription>
                    Enter the amount you want to withdraw and select your payment method.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Withdrawal Amount (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={totalAccruedReturn}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: ${totalAccruedReturn.toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                      <SelectTrigger id="payment-method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="usdt">USDT (Crypto)</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {totalAccruedReturn <= 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                You don't have any accrued returns available for withdrawal yet. Investments must be active for at least 7 days before returns can be withdrawn.
              </p>
            )}
            {totalAccruedReturn > 0 && !canWithdraw() && (
              <p className="text-sm text-destructive mt-4">
                You can withdraw again in {daysUntilNextWithdrawal()} day{daysUntilNextWithdrawal() !== 1 ? 's' : ''}. Withdrawals are allowed once every 7 days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Withdraw;
