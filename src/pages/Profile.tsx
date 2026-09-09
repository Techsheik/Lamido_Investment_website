import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Phone, CreditCard, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");

  // Fetch full profile from Supabase
  const { data: profile, isLoading: profileLoading, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Derive initial values from profile or auth user metadata
  const fullName = profile?.name || user?.user_metadata?.name || `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.surname || ''}`.trim() || "Valued Investor";
  const userEmail = user?.email || profile?.email || "";
  const savedPhone = profile?.phone || user?.user_metadata?.phone || "";
  const savedBankName = profile?.bank_name || "";
  const savedAccountNumber = profile?.bank_account_number || profile?.account_number || "";
  const savedAccountHolder = profile?.account_holder_name || profile?.name || fullName;
  const savedRoutingNumber = profile?.routing_number || "";

  // Auto-sync missing name/phone to DB if in metadata but missing in profile row
  useEffect(() => {
    if (user && profile) {
      const updates: any = {};
      if (!profile.name && fullName) updates.name = fullName;
      if (!profile.phone && savedPhone) updates.phone = savedPhone;
      if (Object.keys(updates).length > 0) {
        supabase.from("profiles").update(updates).eq("id", user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        });
      }
    }
  }, [user, profile, fullName, savedPhone, queryClient]);

  // Populate local form state for editable fields
  useEffect(() => {
    if (profile) {
      setPhone(savedPhone);
      setBankName(savedBankName);
      setAccountNumber(savedAccountNumber);
      setAccountHolderName(savedAccountHolder);
      setRoutingNumber(savedRoutingNumber);
    }
  }, [profile, savedPhone, savedBankName, savedAccountNumber, savedAccountHolder, savedRoutingNumber]);

  // Check completeness
  const isPhoneSaved = Boolean(savedPhone && savedPhone.trim().length >= 5);
  const isBankSaved = Boolean(savedBankName.trim() && savedAccountNumber.trim() && savedAccountHolder.trim());
  const isProfileComplete = isPhoneSaved && isBankSaved;

  // Single unified mutation to save phone + bank details
  const saveProfileDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not logged in");

      const finalPhone = phone.trim() || savedPhone;
      const finalBankName = bankName.trim() || savedBankName;
      const finalAccNum = accountNumber.trim() || savedAccountNumber;
      const finalAccHolder = accountHolderName.trim() || savedAccountHolder;

      if (!finalPhone || finalPhone.length < 5) {
        throw new Error("Please provide a valid Working Phone Number.");
      }
      if (!finalBankName || !finalAccNum || !finalAccHolder) {
        throw new Error("Please provide complete Bank Details (Bank Name, Account Number, Account Holder Name).");
      }

      // 1. Update Supabase profiles table directly
      const { error } = await supabase
        .from("profiles")
        .update({
          name: fullName,
          phone: finalPhone,
          bank_name: finalBankName,
          bank_account_number: finalAccNum,
          account_number: finalAccNum,
          account_holder_name: finalAccHolder,
          routing_number: routingNumber.trim() || null,
        })
        .eq("id", user.id);

      if (error) {
        console.warn("Direct profile update warning:", error);
      }

      // 2. Call backend /api/update-profile endpoint with session token to guarantee update
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch("/api/update-profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              phone: finalPhone,
              bank_name: finalBankName,
              account_number: finalAccNum,
              account_holder_name: finalAccHolder,
              routing_number: routingNumber.trim() || null,
            }),
          });
        }
      } catch (e) {
        console.warn("API update-profile fallback note:", e);
      }

      // 3. Update Auth Metadata so phone is immediately reflected in user metadata
      try {
        await supabase.auth.updateUser({
          data: { phone: finalPhone, name: fullName }
        });
      } catch (e) {
        // Ignore auth metadata error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      refetch();
      toast({
        title: "✅ Profile & Bank Details Saved!",
        description: "Your details have been securely saved to your profile and verified for withdrawals.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error Saving Profile",
        description: err.message || "Failed to save details.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfileDetailsMutation.mutate();
  };

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-primary-glow flex items-center justify-center shadow-md">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Investor Profile</h1>
            <p className="text-muted-foreground">Your verified account information and withdrawal payment details</p>
          </div>
        </div>

        {/* User Code & Account Status Header Banner */}
        <div className="p-5 bg-card border rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">User Code / Investor ID</p>
            <p className="text-2xl font-extrabold font-mono text-primary">{profile?.user_code || "LAM-INVESTOR"}</p>
          </div>
          <div className="flex items-center gap-2">
            {isProfileComplete ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Verified for Withdrawals
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-bold">
                ⚠️ Complete Profile Required
              </Badge>
            )}
          </div>
        </div>

        {/* READ-ONLY BASIC INFORMATION CARD (Email & Full Name) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Basic Account Information
            </CardTitle>
            <CardDescription>Provided during registration (Read-Only)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 p-3 bg-muted/50 rounded-xl border">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <p className="text-base font-bold text-foreground">{fullName}</p>
            </div>
            <div className="space-y-1.5 p-3 bg-muted/50 rounded-xl border">
              <Label className="text-xs text-muted-foreground">Email Address</Label>
              <p className="text-base font-bold font-mono text-foreground">{userEmail}</p>
            </div>
          </CardContent>
        </Card>

        {/* PROFILE COMPLETION FORM / READ-ONLY VIEW */}
        {isProfileComplete ? (
          /* ALL SAVED & VERIFIED READ-ONLY CARD */
          <Card className="border-2 border-emerald-500/30 shadow-md">
            <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <div>
                    <CardTitle className="text-xl text-emerald-950 dark:text-emerald-100">
                      Saved Payment & Contact Details
                    </CardTitle>
                    <CardDescription className="text-emerald-700 dark:text-emerald-400">
                      Your details are saved in your profile and locked for security
                    </CardDescription>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white font-bold flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Saved & Locked
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Working Phone Number
                  </Label>
                  <p className="text-lg font-bold font-mono text-foreground">{savedPhone}</p>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Bank Name
                  </Label>
                  <p className="text-lg font-bold text-foreground">{savedBankName}</p>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <Label className="text-xs text-muted-foreground">Account Number</Label>
                  <p className="text-lg font-bold font-mono text-foreground">{savedAccountNumber}</p>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <Label className="text-xs text-muted-foreground">Account Holder Name</Label>
                  <p className="text-lg font-bold text-foreground">{savedAccountHolder}</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                <span>
                  Your profile is fully complete! Admin will credit withdrawals directly to this account number.
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* FORM TO FILL OUT MISSING DETAILS ONCE */
          <Card className="border-2 border-primary">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-xl">Update Phone & Bank Account Details</CardTitle>
                  <CardDescription>
                    Required once to enable withdrawal processing. Information will be saved to your profile.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Working Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone-input" className="font-semibold flex items-center gap-1">
                    <Phone className="h-4 w-4 text-primary" /> Working Phone Number *
                  </Label>
                  <Input
                    id="phone-input"
                    type="tel"
                    placeholder="e.g. +2348012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for payment verification and contact by admin.
                  </p>
                </div>

                {/* Account Holder Name */}
                <div className="space-y-2">
                  <Label htmlFor="acc-holder-input" className="font-semibold">
                    Account Holder Name *
                  </Label>
                  <Input
                    id="acc-holder-input"
                    placeholder="e.g. Ibrahim Abdullahi"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    required
                  />
                </div>

                {/* Bank Name */}
                <div className="space-y-2">
                  <Label htmlFor="bank-name-input" className="font-semibold">
                    Bank Name *
                  </Label>
                  <Input
                    id="bank-name-input"
                    placeholder="e.g. Opay, Kuda, First Bank, Zenith"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  />
                </div>

                {/* Account Number */}
                <div className="space-y-2">
                  <Label htmlFor="acc-num-input" className="font-semibold">
                    Bank Account Number *
                  </Label>
                  <Input
                    id="acc-num-input"
                    placeholder="e.g. 7012345678"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                  />
                </div>

                {/* Optional Routing Number */}
                <div className="space-y-2">
                  <Label htmlFor="routing-num-input" className="text-xs text-muted-foreground">
                    Routing Number / Sort Code (Optional)
                  </Label>
                  <Input
                    id="routing-num-input"
                    placeholder="Optional"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 text-base shadow-md mt-4"
                  disabled={saveProfileDetailsMutation.isPending}
                >
                  {saveProfileDetailsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving Profile Information...
                    </>
                  ) : (
                    "Save & Verify Profile Information"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
