import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, Copy, Check, Upload, X } from "lucide-react";
import { format } from "date-fns";

const Payment = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [proofDescription, setProofDescription] = useState("");
  const [proofDate, setProofDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transactionRef, setTransactionRef] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch admin payment settings
  const { data: paymentSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .in("setting_key", ["admin_bank_account", "admin_bank_name", "admin_bank_account_name", "admin_phone"])
        .limit(4);
      
      const settings: any = {};
      data?.forEach(item => {
        settings[item.setting_key] = item.setting_value;
      });
      
      return {
        accountNumber: settings["admin_bank_account"] || "6508733555",
        bankName: settings["admin_bank_name"] || "Opay",
        accountName: settings["admin_bank_account_name"] || "Lamido resourses enterprises",
        adminPhone: settings["admin_phone"] || "2349055555555",
      };
    },
  });

  // Fetch user's profile for name
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
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
  });

  // Fetch latest transaction reference
  const { data: latestTransaction } = useQuery({
    queryKey: ["latest-transaction", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Mutation to upload payment proof
  const uploadProofMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error("User not authenticated");
      if (!selectedFile) throw new Error("Please select a file to upload");
      if (!proofDescription.trim()) throw new Error("Please provide payment details");

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("transaction-proofs")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create proof record
      const { error: proofError } = await supabase.from("transaction_proofs").insert({
        user_id: user.id,
        transaction_id: latestTransaction?.id,
        reference: latestTransaction?.id,
        file_path: fileName,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        status: "pending",
      });

      if (proofError) throw proofError;

      // Create notification for admin
      const { error: notifyError } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Payment Proof Submitted",
        message: `User ${profile.name} submitted payment proof on ${proofDate}: ${proofDescription}`,
        type: "payment_proof",
        read: false,
      });

      if (notifyError) throw notifyError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment proof submitted successfully. Our team will verify it shortly.",
      });
      setProofDescription("");
      setSelectedFile(null);
      setTimeout(() => navigate("/dashboard"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit payment proof",
        variant: "destructive",
      });
    },
  });

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

  const handleWhatsAppRedirect = () => {
    if (!paymentSettings?.adminPhone) {
      toast({
        title: "Error",
        description: "Admin phone number not configured",
        variant: "destructive",
      });
      return;
    }

    const message = encodeURIComponent(
      `Hello Admin, I just made a payment of ${profile?.name || "User Name"}. Here is my proof:\n\n${proofDescription}`
    );
    const whatsappUrl = `https://wa.me/${paymentSettings.adminPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  if (loading || loadingSettings) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div>
          <h1 className="text-4xl font-bold">Make Payment</h1>
          <p className="text-muted-foreground mt-2">
            Complete your payment using the bank details below
          </p>
        </div>

        {/* Bank Details Card */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl">Bank Transfer Details</CardTitle>
            <CardDescription>
              Transfer funds to this account to complete your payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Account Number */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                <div>
                  <Label className="text-sm text-muted-foreground">Account Number</Label>
                  <p className="text-xl font-bold font-mono mt-1">
                    {paymentSettings?.accountNumber}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      paymentSettings?.accountNumber || "",
                      "Account Number"
                    )
                  }
                >
                  {copiedField === "Account Number" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Bank Name */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                <div>
                  <Label className="text-sm text-muted-foreground">Bank Name</Label>
                  <p className="text-xl font-bold mt-1">{paymentSettings?.bankName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(paymentSettings?.bankName || "", "Bank Name")
                  }
                >
                  {copiedField === "Bank Name" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Account Name */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                <div>
                  <Label className="text-sm text-muted-foreground">Account Name</Label>
                  <p className="text-xl font-bold mt-1">{paymentSettings?.accountName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(paymentSettings?.accountName || "", "Account Name")
                  }
                >
                  {copiedField === "Account Name" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold mb-2">Instructions:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                <li>Transfer the amount to the account above</li>
                <li>Copy the account number provided</li>
                <li>Keep a screenshot of your payment confirmation</li>
                <li>Submit your proof below</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Payment Proof Form */}
        <Card>
          <CardHeader>
            <CardTitle>Submit Payment Proof</CardTitle>
            <CardDescription>
              Provide details of your payment transfer to verify completion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Transaction ID Display */}
            {latestTransaction?.id && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label className="text-sm text-muted-foreground">Your Transaction ID</Label>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-lg font-mono font-bold break-all">{latestTransaction.id}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(latestTransaction.id);
                      toast({ title: "Copied!", description: "Transaction ID copied to clipboard" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proof-date">Payment Date</Label>
              <Input
                id="proof-date"
                type="date"
                value={proofDate}
                onChange={(e) => setProofDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof-description">Payment Details</Label>
              <Textarea
                id="proof-description"
                placeholder="Enter amount transferred, confirmation details, or any other relevant information about your payment..."
                value={proofDescription}
                onChange={(e) => setProofDescription(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                This information will be sent to the admin for verification
              </p>
            </div>

            {/* File Upload Section */}
            <div className="space-y-2">
              <Label htmlFor="receipt-upload">Upload Receipt (PDF or Image)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition cursor-pointer">
                <input
                  id="receipt-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast({
                          title: "File too large",
                          description: "Maximum file size is 5MB",
                          variant: "destructive",
                        });
                        return;
                      }
                      setSelectedFile(file);
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="receipt-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG or PNG (Max 5MB)</p>
                  </div>
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      {selectedFile.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Action Items:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Screenshots of payment confirmation</li>
                <li>Transaction ID or reference number</li>
                <li>Amount transferred</li>
                <li>Date and time of transfer</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => uploadProofMutation.mutate()}
                disabled={
                  !proofDescription.trim() || !selectedFile || uploadProofMutation.isPending
                }
              >
                {uploadProofMutation.isPending ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Uploading...
                  </>
                ) : (
                  "Submit Proof"
                )}
              </Button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* WhatsApp Option */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleWhatsAppRedirect}
              disabled={!proofDescription.trim()}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Send Proof on WhatsApp
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Click the button above to open WhatsApp with a pre-filled message
              containing your payment details. Attach a screenshot of your
              payment confirmation.
            </p>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">What happens next?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Your payment proof will be reviewed by our admin team within 24
              hours
            </p>
            <p>• Once verified, your account balance will be credited</p>
            <p>• You'll receive a notification when your payment is confirmed</p>
            <p>• If you have any issues, contact support via WhatsApp</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Payment;
