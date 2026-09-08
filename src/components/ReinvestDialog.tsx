import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Repeat, ShieldCheck, TrendingUp } from "lucide-react";

interface ReinvestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBalance: number;
}

export function ReinvestDialog({
  open,
  onOpenChange,
  userBalance,
}: ReinvestDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const UNIT_PRICE = 70; // $70 per share unit

  const [units, setUnits] = useState<string>("1");

  const numUnits = Math.max(1, parseInt(units) || 1);
  const totalAmount = numUnits * UNIT_PRICE;
  const isBalanceSufficient = userBalance >= totalAmount;

  const reinvestMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!isBalanceSufficient) {
        throw new Error(`Insufficient balance. You need $${totalAmount} to purchase ${numUnits} unit(s).`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/submit-reinvestment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          units: numUnits,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to submit reinvestment request.");
      }

      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["cycles-info"] });
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });

      toast({
        title: "Reinvestment Submitted! 🔄",
        description: `Successfully reinvested $${totalAmount.toLocaleString()} into ${numUnits} Share Unit(s). Pending admin activation for the next cycle.`,
      });

      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Reinvestment Failed",
        description: error.message || "Failed to process reinvestment",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary font-bold">
            <Repeat className="w-5 h-5 text-amber-500" />
            Reinvest Earned Profits
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Purchase new Share Units ($70/unit) directly using your available account balance without needing external payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Available Balance Card */}
          <div className="p-3 bg-muted/60 rounded-xl border flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">Available Account Balance</span>
              <span className="text-lg font-bold font-mono text-emerald-500">
                ${userBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
              Internal Balance
            </Badge>
          </div>

          {/* Unit Price Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-xs text-muted-foreground">Unit Price</span>
              <p className="text-lg font-bold font-mono text-primary">$70 / unit</p>
            </div>
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-xs text-muted-foreground">Cycle Eligibility</span>
              <p className="text-sm font-bold text-amber-500">Next 7-Day Cycle</p>
            </div>
          </div>

          {/* Share Units Input */}
          <div className="space-y-2">
            <Label htmlFor="reinvest-units" className="font-semibold text-sm">
              Number of Units to Reinvest
            </Label>
            <Input
              id="reinvest-units"
              type="number"
              min="1"
              step="1"
              placeholder="Enter units (1 unit = $70)"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="font-mono text-base"
            />
            <p className="text-xs text-muted-foreground">
              Each unit costs $70.
            </p>
          </div>

          {/* Summary Box */}
          <div className="p-3 rounded-lg border bg-muted/40 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reinvestment Capital:</span>
              <span className="font-bold text-foreground font-mono">${totalAmount.toLocaleString()} USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Balance:</span>
              <span className={`font-bold font-mono ${isBalanceSufficient ? "text-emerald-500" : "text-red-500"}`}>
                ${Math.max(0, userBalance - totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          {!isBalanceSufficient && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              ⚠️ Insufficient balance for {numUnits} unit(s). You need at least ${totalAmount} in your available balance.
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 space-y-1">
            <div className="font-semibold flex items-center gap-1 text-blue-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Direct Reinvestment Setup
            </div>
            <p className="text-[11px] leading-relaxed">
              Funds are deducted directly from your account balance. This investment will be submitted to the Admin dashboard as a <strong>Reinvestment</strong> for activation in the next cycle. No payment proof is required.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => reinvestMutation.mutate()}
            disabled={!isBalanceSufficient || reinvestMutation.isPending || numUnits < 1}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${reinvestMutation.isPending ? "animate-spin" : ""}`} />
            {reinvestMutation.isPending ? "Processing..." : `Confirm Reinvestment ($${totalAmount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
