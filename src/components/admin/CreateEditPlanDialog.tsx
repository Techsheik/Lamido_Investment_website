import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateEditPlanDialogProps {
  plan?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditPlanDialog({
  plan,
  open,
  onOpenChange,
}: CreateEditPlanDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    roi_percentage: "",
    duration_days: "",
    min_amount: "",
    max_amount: "",
    description: "",
    risk_level: "medium",
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        roi_percentage: String(plan.roi_percentage),
        duration_days: String(plan.duration_days),
        min_amount: String(plan.min_amount),
        max_amount: String(plan.max_amount || ""),
        description: plan.description || "",
        risk_level: plan.risk_level || "medium",
      });
    } else {
      setFormData({
        name: "",
        roi_percentage: "",
        duration_days: "",
        min_amount: "",
        max_amount: "",
        description: "",
        risk_level: "medium",
      });
    }
  }, [plan, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        roi_percentage: Number(formData.roi_percentage),
        duration_days: Number(formData.duration_days),
        min_amount: Number(formData.min_amount),
        max_amount: formData.max_amount ? Number(formData.max_amount) : null,
        description: formData.description,
        risk_level: formData.risk_level,
        is_active: true,
      };

      const response = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan?.id,
          ...payload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save plan");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast({
        title: "Success",
        description: plan ? "Plan updated successfully" : "Plan created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save plan",
        variant: "destructive",
      });
    },
  });

  const isValid =
    formData.name.trim() &&
    formData.roi_percentage &&
    formData.duration_days &&
    formData.min_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Investment Plan" : "Create New Investment Plan"}
          </DialogTitle>
          <DialogDescription>
            {plan
              ? "Update the plan details below"
              : "Enter the details for the new investment plan"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Input
                id="name"
                placeholder="e.g. Basic, Premium, Gold"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roi">ROI Percentage (%)</Label>
              <Input
                id="roi"
                type="number"
                placeholder="e.g. 10"
                step="0.1"
                value={formData.roi_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, roi_percentage: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (Days)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="e.g. 7"
                value={formData.duration_days}
                onChange={(e) =>
                  setFormData({ ...formData, duration_days: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk">Risk Level</Label>
              <Select
                value={formData.risk_level}
                onValueChange={(value) =>
                  setFormData({ ...formData, risk_level: value })
                }
              >
                <SelectTrigger id="risk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAmount">Minimum Amount ($)</Label>
              <Input
                id="minAmount"
                type="number"
                placeholder="e.g. 100"
                step="0.01"
                value={formData.min_amount}
                onChange={(e) =>
                  setFormData({ ...formData, min_amount: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAmount">Maximum Amount ($) - Optional</Label>
              <Input
                id="maxAmount"
                type="number"
                placeholder="Leave empty for no limit"
                step="0.01"
                value={formData.max_amount}
                onChange={(e) =>
                  setFormData({ ...formData, max_amount: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe this investment plan..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
            />
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
            {saveMutation.isPending ? "Saving..." : "Save Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
