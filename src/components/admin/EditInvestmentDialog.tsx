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
import { BankDetailsDisplay } from "./BankDetailsDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      queryClient.invalidateQueries({ queryKey: ["admin-investors"] });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Investment Details</DialogTitle>
          <DialogDescription>View and edit investment information</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="investment" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="investment">Investment</TabsTrigger>
            <TabsTrigger value="banking">Banking Info</TabsTrigger>
          </TabsList>
          <TabsContent value="investment" className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roi">ROI Percentage (%)</Label>
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
          </TabsContent>
          <TabsContent value="banking">
            <div className="py-4">
              <BankDetailsDisplay
                accountHolderName={investment?.profiles?.account_holder_name}
                bankName={investment?.profiles?.bank_name}
                bankAccountNumber={investment?.profiles?.bank_account_number}
                routingNumber={investment?.profiles?.routing_number}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
