import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Phone } from "lucide-react";

export function BankDetailsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    account_holder_name: "",
    bank_name: "",
    bank_account_number: "",
    routing_number: "",
  });

  const { data: bankDetails, isLoading } = useQuery({
    queryKey: ["bank-details", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("phone, account_holder_name, bank_name, bank_account_number, account_number, routing_number")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (bankDetails) {
      setFormData({
        phone: bankDetails.phone || "",
        account_holder_name: bankDetails.account_holder_name || "",
        bank_name: bankDetails.bank_name || "",
        bank_account_number: bankDetails.bank_account_number || bankDetails.account_number || "",
        routing_number: bankDetails.routing_number || "",
      });
    }
  }, [bankDetails]);

  const saveBankDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      if (!formData.phone.trim()) {
        throw new Error("Working Phone Number is required for payment verification.");
      }
      if (!formData.bank_name.trim() || !formData.bank_account_number.trim() || !formData.account_holder_name.trim()) {
        throw new Error("Bank Name, Account Number, and Account Holder Name are required.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          phone: formData.phone.trim(),
          account_holder_name: formData.account_holder_name.trim(),
          bank_name: formData.bank_name.trim(),
          bank_account_number: formData.bank_account_number.trim(),
          account_number: formData.bank_account_number.trim(),
          routing_number: formData.routing_number ? formData.routing_number.trim() : null,
        })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Success",
        description: "Bank details and phone number saved successfully",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save bank details",
        variant: "destructive",
      });
    },
  });

  const hasCompleteDetails = Boolean(
    bankDetails?.phone &&
    bankDetails?.bank_name &&
    (bankDetails?.bank_account_number || bankDetails?.account_number) &&
    bankDetails?.account_holder_name
  );

  if (isLoading) return <div>Loading bank details...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Bank Account & Contact Details</CardTitle>
              <CardDescription>Required for withdrawal processing and payment verification</CardDescription>
            </div>
          </div>
          {hasCompleteDetails && <Badge className="bg-success">Saved</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {!isEditing && hasCompleteDetails ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Working Phone Number
              </p>
              <p className="font-semibold text-primary">{formData.phone || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Holder Name</p>
              <p className="font-semibold">{formData.account_holder_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-semibold">{formData.bank_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-semibold font-mono">{formData.bank_account_number}</p>
            </div>
            {formData.routing_number && (
              <div>
                <p className="text-sm text-muted-foreground">Routing / Sort Code</p>
                <p className="font-semibold font-mono">{formData.routing_number}</p>
              </div>
            )}
            <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
              Edit Details
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveBankDetailsMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="phone-number" className="flex items-center gap-1">
                <Phone className="h-4 w-4 text-primary" /> Working Phone Number *
              </Label>
              <Input
                id="phone-number"
                placeholder="e.g. +2348012345678"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Working phone number is required so admin can contact or verify your payments.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-holder">Account Holder Name *</Label>
              <Input
                id="account-holder"
                placeholder="e.g. Ibrahim Abdullahi"
                value={formData.account_holder_name}
                onChange={(e) =>
                  setFormData({ ...formData, account_holder_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name *</Label>
              <Input
                id="bank-name"
                placeholder="e.g. Opay, Kuda, GTBank, Zenith"
                value={formData.bank_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number *</Label>
              <Input
                id="account-number"
                placeholder="e.g. 7012345678"
                value={formData.bank_account_number}
                onChange={(e) =>
                  setFormData({ ...formData, bank_account_number: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routing-number">Routing Number / Sort Code (Optional)</Label>
              <Input
                id="routing-number"
                placeholder="Optional for international banks"
                value={formData.routing_number}
                onChange={(e) =>
                  setFormData({ ...formData, routing_number: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2 pt-4">
              {hasCompleteDetails && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsEditing(false);
                    if (bankDetails) {
                      setFormData({
                        phone: bankDetails.phone || "",
                        account_holder_name: bankDetails.account_holder_name || "",
                        bank_name: bankDetails.bank_name || "",
                        bank_account_number: bankDetails.bank_account_number || bankDetails.account_number || "",
                        routing_number: bankDetails.routing_number || "",
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1"
                disabled={saveBankDetailsMutation.isPending}
              >
                {saveBankDetailsMutation.isPending ? "Saving..." : "Save Details"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
