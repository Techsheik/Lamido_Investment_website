import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface EditUserDialogProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, watch } = useForm({
    values: user ? {
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      balance: user.balance || 0,
      total_invested: user.total_invested || 0,
      total_roi: user.total_roi || 0,
      roi_percentage: user.roi_percentage || 0,
      weekly_roi_percentage: user.weekly_roi_percentage || 10,
      account_status: user.account_status,
    } : undefined,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          ...data
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", user.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-investors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
      
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user: " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    updateUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user profile, balance, ROI, and weekly ROI percentage (market-based rate)</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance">Balance</Label>
            <Input id="balance" type="number" step="0.01" {...register("balance", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_invested">Total Invested ($)</Label>
            <Input id="total_invested" type="number" step="0.01" {...register("total_invested", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_roi">Total ROI ($)</Label>
            <Input id="total_roi" type="number" step="0.01" {...register("total_roi", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roi_percentage">ROI Percentage (%)</Label>
            <Input id="roi_percentage" type="number" step="0.01" {...register("roi_percentage", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weekly_roi_percentage">Weekly ROI Percentage (%)</Label>
            <Input id="weekly_roi_percentage" type="number" step="0.01" min="0" max="100" {...register("weekly_roi_percentage", { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">Set the weekly ROI percentage for this user (e.g., 10 for 10%)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_status">Account Status</Label>
            <Select
              value={watch("account_status")}
              onValueChange={(value) => setValue("account_status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
