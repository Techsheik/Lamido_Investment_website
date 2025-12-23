import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createVirtualAccount, getUserVirtualAccount, type VirtualAccount } from "@/lib/paymentService";
import { Copy, Check, Building2, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Deposit = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch existing virtual account
  const { data: existingAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ["virtual-account", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await getUserVirtualAccount(user.id);
    },
    enabled: !!user,
  });

  // Create virtual account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (depositAmount: number) => {
      if (!user) throw new Error("User not authenticated");
      return await createVirtualAccount(user.id, depositAmount);
    },
    onSuccess: (data) => {
      setVirtualAccount(data);
      toast({
        title: "Virtual Account Created",
        description: "Your virtual account has been generated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create virtual account",
        variant: "destructive",
      });
    },
  });

  const handleCreateAccount = () => {
    const depositAmount = parseFloat(amount);
    
    if (!depositAmount || depositAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount.",
        variant: "destructive",
      });
      return;
    }

    if (depositAmount < 70) {
      toast({
        title: "Minimum Amount",
        description: "Minimum deposit amount is $70 (1 unit).",
        variant: "destructive",
      });
      return;
    }

    createAccountMutation.mutate(depositAmount);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const displayAccount = virtualAccount || existingAccount;

  if (loading || loadingAccount) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold">Deposit Funds</h1>
          <p className="text-muted-foreground mt-2">
            Add funds to your account to start investing
          </p>
        </div>

        {!displayAccount ? (
          <Card>
            <CardHeader>
              <CardTitle>Enter Deposit Amount</CardTitle>
              <CardDescription>
                Enter the amount you want to deposit. Minimum deposit is $70 (1 unit).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Deposit Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="70.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={70}
                  step="0.01"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum: $70.00 (1 unit)
                </p>
              </div>

              <Button
                onClick={handleCreateAccount}
                disabled={!amount || createAccountMutation.isPending}
                className="w-full"
                size="lg"
              >
                {createAccountMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Account...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Generate Virtual Account
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Your Virtual Account Details
                </CardTitle>
                <CardDescription>
                  Transfer the exact amount to this account. Your deposit will be processed automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-sm text-muted-foreground">Bank Name</Label>
                      <p className="text-xl font-bold">{displayAccount.bank_name}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(displayAccount.bank_name, "Bank Name")}
                    >
                      {copiedField === "Bank Name" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-sm text-muted-foreground">Account Number</Label>
                      <p className="text-xl font-bold font-mono">{displayAccount.account_number}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(displayAccount.account_number, "Account Number")}
                    >
                      {copiedField === "Account Number" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-sm text-muted-foreground">Account Name</Label>
                      <p className="text-xl font-bold">{displayAccount.account_name}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(displayAccount.account_name, "Account Name")}
                    >
                      {copiedField === "Account Name" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {amount && (
                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary">
                      <div>
                        <Label className="text-sm text-muted-foreground">Amount to Pay</Label>
                        <p className="text-2xl font-bold text-primary">${parseFloat(amount).toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-sm text-muted-foreground">Reference</Label>
                      <p className="text-sm font-mono text-muted-foreground">{displayAccount.reference}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(displayAccount.reference, "Reference")}
                    >
                      {copiedField === "Reference" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-2">Important Instructions:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                    <li>Transfer the exact amount shown above</li>
                    <li>Use the account details provided</li>
                    <li>Your deposit will be processed automatically after payment</li>
                    <li>Keep your reference number for tracking</li>
                    <li>Contact support if payment is not reflected within 24 hours</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAmount("");
                      setVirtualAccount(null);
                    }}
                    className="flex-1"
                  >
                    Create New Deposit
                  </Button>
                  <Button
                    onClick={() => navigate("/transactions")}
                    className="flex-1"
                  >
                    View Transactions
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your deposit transaction is pending. Once payment is received, your account balance will be updated automatically.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Deposit;

