import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const Invest = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  // Vercel has no backend API route for investments; make sure we always use Supabase directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [units, setUnits] = useState("");
  const UNIT_PRICE = 70; // $70 per unit

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["investmentPlan", planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data } = await supabase
        .from("investment_plans")
        .select("*")
        .eq("id", planId)
        .single();
      return data;
    },
    enabled: !!planId,
  });

  const createInvestment = useMutation({
    mutationFn: async () => {
      if (!user || !plan) throw new Error("Missing data");
      if (!supabaseUrl) {
        throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
      }
      
      const numUnits = Number(units);
      if (isNaN(numUnits) || numUnits < 1 || !Number.isInteger(numUnits)) {
        throw new Error("Please enter a valid number of units (minimum 1 unit)");
      }

      const investAmount = numUnits * UNIT_PRICE;

      // Set end date to 7 days from now for weekly cycle
      const startDate = new Date().toISOString();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const { error: investmentError } = await supabase.from("investments").insert({
        user_id: user.id,
        plan_id: plan.id,
        amount: investAmount,
        units: numUnits,
        type: plan.name,
        roi: Number(plan.roi_percentage),
        duration: 7, // 7 days for weekly cycle
        start_date: startDate,
        end_date: endDate.toISOString(),
        status: "active",
      });

      if (investmentError) throw investmentError;

      // Create transaction record
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount: investAmount,
        status: "completed",
      });

      if (transactionError) throw transactionError;
    },
    onSuccess: () => {
      toast({ title: "Investment created successfully! Proceed to payment." });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      navigate("/payment");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create investment", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  if (loading || planLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Services
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Investment plan not found</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "low": return "bg-green-500/10 text-green-500";
      case "medium": return "bg-yellow-500/10 text-yellow-500";
      case "high": return "bg-red-500/10 text-red-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/services")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Services
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </div>
              <Badge className={getRiskColor(plan.risk_level || "medium")}>
                {plan.risk_level || "Medium"} Risk
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Unit Price</Label>
                <p className="text-2xl font-bold">$70 per unit</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Weekly ROI</Label>
                <p className="text-2xl font-bold text-success">{plan.roi_percentage}%</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Investment Cycle</Label>
                <p className="text-2xl font-bold">7 days</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Minimum Investment</Label>
                <p className="text-2xl font-bold">1 unit ($70)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="units">Number of Units</Label>
              <Input
                id="units"
                type="number"
                placeholder="Enter number of units (1 unit = $70)"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                min={1}
                step={1}
              />
              <p className="text-sm text-muted-foreground">
                Minimum: 1 unit (${UNIT_PRICE}). Each unit costs ${UNIT_PRICE}. Buy as many units as you want.
              </p>
            </div>

            {units && Number(units) >= 1 && Number.isInteger(Number(units)) && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Number of Units:</span>
                  <span className="font-semibold">{Number(units)} unit{Number(units) !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Investment Amount:</span>
                  <span className="font-semibold">${(Number(units) * UNIT_PRICE).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Weekly Return ({plan.roi_percentage}%):</span>
                  <span className="font-semibold text-success">
                    ${((Number(units) * UNIT_PRICE) * (Number(plan.roi_percentage) / 100)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total After 7 Days:</span>
                  <span className="font-bold text-lg">
                    ${((Number(units) * UNIT_PRICE) + ((Number(units) * UNIT_PRICE) * (Number(plan.roi_percentage) / 100))).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  * You can withdraw accrued returns at the end of each 7-day cycle
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => createInvestment.mutate()}
              disabled={!units || Number(units) < 1 || !Number.isInteger(Number(units)) || createInvestment.isPending}
            >
              {createInvestment.isPending ? "Processing..." : `Invest ${units ? Number(units) : ''} Unit${units && Number(units) !== 1 ? 's' : ''}`}
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Important Notice</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• This is a demonstration platform. No real payments are processed.</p>
            <p>• All investments are for simulation purposes only.</p>
            <p>• Please consult with a financial advisor before making real investment decisions.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Invest;
