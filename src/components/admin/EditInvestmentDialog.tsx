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
  const { register, handleSubmit } = useForm({
    values: investment ? {
      roi: investment.roi,
      duration: investment.duration,
    } : undefined,
  });

  const updateInvestmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("investments")
        .update({
          roi: data.roi,
          duration: data.duration,
        })
        .eq("id", investment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      toast({
        title: "Success",
        description: "Investment updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update investment: " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    updateInvestmentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Investment</DialogTitle>
          <DialogDescription>Update investment ROI and duration</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roi">ROI Amount ($)</Label>
            <Input
              id="roi"
              type="number"
              step="0.01"
              {...register("roi", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              {...register("duration", { valueAsNumber: true })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateInvestmentMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
