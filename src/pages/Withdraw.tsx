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
import { Badge } from "@/components/ui/badge";

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

  const { data: pendingTransactions } = useQuery({
    queryKey: ["pending-withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "withdrawal")
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
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
  const totalPendingWithdrawals = pendingTransactions?.reduce((sum, tx) => sum + Number(tx.amount || 0), 0) || 0;
  
  // Calculate Total Accrued Return / Net Available Balance (minus pending withdrawals)
  const profileBalance = Number(profile?.balance || profile?.accrued_return || profile?.total_roi || 0);
  const activeAccrued = investments?.reduce((sum, inv) => {
    if (!inv.start_date) return sum;
    const startDate = new Date(inv.start_date);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPassed >= 7 || inv.status === "completed") {
      const totalReturn = Number(inv.amount) * Number(inv.roi || 0) / 100;
      return sum + totalReturn;
    }
    return sum;
  }, 0) || 0;

  const grossAccruedReturn = Math.max(profileBalance, activeAccrued);
  const totalAccruedReturn = Math.max(0, grossAccruedReturn - totalPendingWithdrawals);

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

  const phoneVal = (profile?.phone || user?.user_metadata?.phone || "").trim();
  const bankNameVal = (profile?.bank_name || "").trim();
  const accNumVal = (profile?.bank_account_number || profile?.account_number || "").trim();
  const defaultHolderName = profile?.name || user?.user_metadata?.name || `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.surname || ''}`.trim() || "Valued Investor";
  const accHolderVal = (profile?.account_holder_name || defaultHolderName).trim();

  const hasPhone = phoneVal.length >= 5;
  const hasBankDetails = Boolean(bankNameVal && accNumVal && accHolderVal);

  const missingFields: string[] = [];
  if (!hasPhone) missingFields.push("Working Phone Number");
  if (!bankNameVal) missingFields.push("Bank Name");
  if (!accNumVal) missingFields.push("Account Number");
  if (!accHolderVal) missingFields.push("Account Holder Name");

  const hasCompleteProfile = missingFields.length === 0;

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (missingFields.length > 0) {
      toast({
        title: "Profile Information Required ⚠️",
        description: `Please update the following missing fields in Profile Settings: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    
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

    if (totalAccruedReturn > 0 && withdrawalAmount > totalAccruedReturn) {
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Authentication session expired. Please log in again.");
      }

      const res = await fetch("/api/request-withdrawal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: withdrawalAmount,
          paymentMethod,
          paymentInfo: paymentMethod,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to submit withdrawal request.");
      }

      toast({
        title: "✅ Withdrawal Request Submitted",
        description: "Your withdrawal request has been submitted. The admin will process your request shortly, and your account will be credited with the requested amount using the account number provided in your profile.",
      });

      setIsOpen(false);
      setAmount("");
      setPaymentMethod("");
    } catch (error: any) {
      console.error("Withdrawal request error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit withdrawal request. Please try again.",
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

        {!hasCompleteProfile && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-sm flex items-center gap-1.5 text-amber-400">
                ⚠️ Complete Your Profile to Request Withdrawals
              </div>
              <p className="text-xs text-muted-foreground">
                The following required profile detail{missingFields.length > 1 ? 's are' : ' is'} missing: <span className="font-semibold text-amber-400">{missingFields.join(", ")}</span>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/20 whitespace-nowrap"
              onClick={() => navigate("/profile")}
            >
              Update Profile Now &rarr;
            </Button>
          </div>
        )}

        {totalPendingWithdrawals > 0 && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-sm flex items-center gap-1.5 text-blue-400">
                ⏳ Pending Withdrawal Under Admin Review
              </div>
              <p className="text-xs text-muted-foreground">
                You currently have <span className="font-bold text-blue-400">${totalPendingWithdrawals.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> in pending withdrawal requests awaiting admin approval. New withdrawal requests are locked until processed.
              </p>
            </div>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 px-3 py-1 font-bold whitespace-nowrap">
              Pending Admin Review
            </Badge>
          </div>
        )}

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
              <p className="text-xs text-muted-foreground mt-1">
                {totalPendingWithdrawals > 0 
                  ? `Net Available ($${grossAccruedReturn.toFixed(2)} minus $${totalPendingWithdrawals.toFixed(2)} pending)`
                  : "Accrued returns (7+ days)"
                }
              </p>
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
                <Button className="w-full md:w-auto" disabled={!canWithdraw() || totalAccruedReturn <= 0 || totalPendingWithdrawals > 0}>
                  {totalPendingWithdrawals > 0 ? "Withdrawal Pending Review..." : "Request Withdrawal"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdrawal Request</DialogTitle>
                  <DialogDescription>
                    Enter the amount you want to withdraw and select your payment method.
                  </DialogDescription>
                </DialogHeader>

                {!hasCompleteProfile && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-500 space-y-2">
                    <div className="font-semibold flex items-center gap-1 text-amber-400">
                      ⚠️ Missing Required Profile Details
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Please update the following required information in Profile Settings before submitting your withdrawal:
                    </p>
                    <ul className="list-disc list-inside text-xs font-semibold text-amber-300 space-y-0.5">
                      {missingFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/profile");
                      }}
                    >
                      Update Profile Settings &rarr;
                    </Button>
                  </div>
                )}

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
                      max={totalAccruedReturn > 0 ? totalAccruedReturn : undefined}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Available Balance: ${totalAccruedReturn.toFixed(2)}
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

                  {hasBankDetails && (
                    <div className="p-3 bg-muted/50 border rounded-md text-xs space-y-1 font-mono">
                      <div className="text-muted-foreground font-sans font-medium text-[11px]">Registered Payout Bank Account</div>
                      <div className="font-bold text-foreground">{profile?.bank_name} — {profile?.bank_account_number || profile?.account_number}</div>
                      <div className="text-muted-foreground text-[11px]">Holder: {profile?.account_holder_name || profile?.name} | Tel: {profile?.phone}</div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting || !hasCompleteProfile}>
                    {submitting ? "Submitting Request..." : "Submit Withdrawal Request"}
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
