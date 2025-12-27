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
import { CreditCard } from "lucide-react";

export function BankDetailsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
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
        .select("account_holder_name, bank_name, bank_account_number, routing_number")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (bankDetails) {
      setFormData({
        account_holder_name: bankDetails.account_holder_name || "",
        bank_name: bankDetails.bank_name || "",
        bank_account_number: bankDetails.bank_account_number || "",
        routing_number: bankDetails.routing_number || "",
      });
    }
  }, [bankDetails]);

  const saveBankDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!formData.account_holder_name.trim() || !formData.bank_name.trim() || !formData.bank_account_number.trim() || !formData.routing_number.trim()) {
        throw new Error("All fields are required");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          account_holder_name: formData.account_holder_name,
          bank_name: formData.bank_name,
          bank_account_number: formData.bank_account_number,
          routing_number: formData.routing_number,
        })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast({
        title: "Success",
        description: "Bank details saved successfully",
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

  const hasBankDetails = bankDetails?.bank_account_number && bankDetails?.bank_name;

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Bank Account Details</CardTitle>
              <CardDescription>Used for weekly ROI payouts</CardDescription>
            </div>
          </div>
          {hasBankDetails && <Badge className="bg-success">Saved</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {!isEditing && hasBankDetails ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Account Holder</p>
              <p className="font-semibold">{formData.account_holder_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-semibold">{formData.bank_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-semibold">{formData.bank_account_number.slice(-4).padStart(formData.bank_account_number.length, '*')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Routing Number</p>
              <p className="font-semibold">{formData.routing_number}</p>
            </div>
            <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
              Edit Bank Details
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
              <Label htmlFor="account-holder">Account Holder Name *</Label>
              <Input
                id="account-holder"
                placeholder="John Doe"
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
                placeholder="First National Bank"
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
                placeholder="1234567890"
                value={formData.bank_account_number}
                onChange={(e) =>
                  setFormData({ ...formData, bank_account_number: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routing-number">Routing Number *</Label>
              <Input
                id="routing-number"
                placeholder="021000021"
                value={formData.routing_number}
                onChange={(e) =>
                  setFormData({ ...formData, routing_number: e.target.value })
                }
                required
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsEditing(false);
                  if (bankDetails) {
                    setFormData({
                      account_holder_name: bankDetails.account_holder_name || "",
                      bank_name: bankDetails.bank_name || "",
                      bank_account_number: bankDetails.bank_account_number || "",
                      routing_number: bankDetails.routing_number || "",
                    });
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={saveBankDetailsMutation.isPending}
              >
                {saveBankDetailsMutation.isPending ? "Saving..." : "Save Bank Details"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
