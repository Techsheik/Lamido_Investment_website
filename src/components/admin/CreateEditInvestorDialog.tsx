import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

interface CreateEditInvestorDialogProps {
  investor?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditInvestorDialog({
  investor,
  open,
  onOpenChange,
}: CreateEditInvestorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    amount: "",
    plan_id: "",
    roi_percentage: "",
    start_date: "",
  });

  // Fetch available plans
  const { data: plans } = useQuery({
    queryKey: ["investment-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("investment_plans")
        .select("id, name, roi_percentage")
        .eq("is_active", true);
      return data || [];
    },
  });

  useEffect(() => {
    if (investor) {
      setFormData({
        name: investor.name,
        email: investor.email,
        amount: String(investor.amount || ""),
        plan_id: investor.plan_id || "",
        roi_percentage: String(investor.roi_percentage || ""),
        start_date: investor.start_date?.split("T")[0] || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        amount: "",
        plan_id: "",
        roi_percentage: "",
        start_date: new Date().toISOString().split("T")[0],
      });
    }
  }, [investor, open]);

  // When plan is selected, auto-fill ROI
  const handlePlanChange = (planId: string) => {
    setFormData({ ...formData, plan_id: planId });
    const selectedPlan = plans?.find((p) => p.id === planId);
    if (selectedPlan) {
      setFormData((prev) => ({
        ...prev,
        roi_percentage: String(selectedPlan.roi_percentage),
      }));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        email: formData.email,
        amount: Number(formData.amount),
        plan_id: formData.plan_id || null,
        roi_percentage: Number(formData.roi_percentage),
        start_date: formData.start_date,
      };

      if (investor) {
        // Update existing investor record
        const oldAmount = Number(investor.amount || 0);
        const amountDifference = payload.amount - oldAmount;

        const { error } = await supabase
          .from("investments")
          .update({
            amount: payload.amount,
            roi: payload.roi_percentage,
            start_date: payload.start_date,
            plan_id: payload.plan_id,
          })
          .eq("id", investor.id);

        if (error) throw error;

        // Also update profile if email or name changed, and adjust balance for amount changes
        if (investor.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("balance")
            .eq("id", investor.user_id)
            .single();

          const currentBalance = Number(profile?.balance || 0);
          const newBalance = currentBalance + amountDifference;

          const profileError = await supabase
            .from("profiles")
            .update({
              name: payload.name,
              email: payload.email,
              balance: newBalance,
            })
            .eq("id", investor.user_id);

          if (profileError.error) throw profileError.error;
        }
      } else {
        // Create new investment record
        // First, we need to find or create a user profile
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, balance")
          .eq("email", payload.email)
          .single();

        const userId = existingProfile?.id;

        if (!userId) {
          throw new Error(
            "User with this email not found. Please create the user first."
          );
        }

        const { error } = await supabase.from("investments").insert({
          user_id: userId,
          amount: payload.amount,
          roi: payload.roi_percentage,
          plan_id: payload.plan_id,
          start_date: payload.start_date,
          status: "active",
          type: "admin-created",
          duration: 7,
        });

        if (error) throw error;

        // Update user's balance in profiles table
        const currentBalance = Number(existingProfile?.balance || 0);
        const newBalance = currentBalance + payload.amount;

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", userId);

        if (balanceError) throw balanceError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      toast({
        title: "Success",
        description: investor
          ? "Investor updated successfully"
          : "Investor created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save investor",
        variant: "destructive",
      });
    },
  });

  const isValid =
    formData.name.trim() &&
    formData.email.trim() &&
    formData.amount &&
    formData.roi_percentage &&
    formData.start_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {investor ? "Edit Investor" : "Add New Investor"}
          </DialogTitle>
          <DialogDescription>
            {investor
              ? "Update the investor details below"
              : "Enter the details for the new investor"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                disabled={!!investor}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Investment Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Investment Plan</Label>
              <Select value={formData.plan_id} onValueChange={handlePlanChange}>
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.roi_percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roi">ROI Percentage (%)</Label>
              <Input
                id="roi"
                type="number"
                placeholder="10"
                step="0.1"
                value={formData.roi_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, roi_percentage: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Investor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
