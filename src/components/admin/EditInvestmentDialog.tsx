import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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

interface EditInvestmentDialogProps {
  investment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditInvestmentDialog({
  investment,
  open,
  onOpenChange,
}: EditInvestmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const UNIT_PRICE = 70; // $70 per unit

  const [formData, setFormData] = useState({
    units: "1",
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (investment) {
      const initialUnits = investment.units || Math.max(1, Math.round(Number(investment.amount || 70) / UNIT_PRICE));
      setFormData({
        units: String(initialUnits),
        status: investment.status || "active",
        start_date: investment.start_date?.split("T")[0] || new Date().toISOString().split("T")[0],
      });
    }
  }, [investment, open]);

  const updateInvestmentMutation = useMutation({
    mutationFn: async () => {
      const parsedUnits = Math.max(1, parseInt(formData.units) || 1);
      const calculatedAmount = parsedUnits * UNIT_PRICE;

      const response = await fetch("/api/admin/edit-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          units: parsedUnits,
          amount: calculatedAmount,
          status: formData.status,
          start_date: formData.start_date,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update investment");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast({
        title: "Success",
        description: "Investment details updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update investment",
        variant: "destructive",
      });
    },
  });

  const parsedUnits = Math.max(1, parseInt(formData.units) || 1);
  const totalAmount = parsedUnits * UNIT_PRICE;
  const profile = investment?.profile || investment?.profiles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Investment Details</DialogTitle>
          <DialogDescription>
            Update share units, status, and start date for this investment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Investor Info Summary */}
          {profile && (
            <div className="p-3 bg-muted rounded-md border space-y-1 text-xs">
              <div className="text-muted-foreground font-medium">Investor Account</div>
              <div className="font-bold text-sm text-foreground">{profile.name || "Unknown User"}</div>
              <div className="font-mono text-muted-foreground">{profile.email}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-units">Share Units ($70/unit)</Label>
              <Input
                id="edit-units"
                type="number"
                min="1"
                step="1"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-total-amount">Total Capital ($)</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 font-bold text-base text-primary flex items-center">
                ${totalAmount.toLocaleString()} USD
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-start-date">Start Date</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateInvestmentMutation.mutate()}
            disabled={updateInvestmentMutation.isPending || parsedUnits < 1}
          >
            {updateInvestmentMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
