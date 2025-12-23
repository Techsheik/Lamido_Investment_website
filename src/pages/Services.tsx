import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, TrendingUp, Clock, DollarSign, Shield } from "lucide-react";

export default function Services() {
  const navigate = useNavigate();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["investment-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_plans")
        .select("*")
        .eq("is_active", true)
        .order("min_amount");
      
      if (error) throw error;
      return data;
    },
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-success/20 text-success";
      case "medium":
        return "bg-secondary/20 text-secondary";
      case "high":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Investment Plans
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the perfect plan for your financial goals
            </p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-32 bg-muted rounded" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans?.map((plan, index) => (
                <Card
                  key={plan.id}
                  className="p-6 relative overflow-hidden hover:shadow-xl transition-all animate-fade-in group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
                  
                  <div className="relative space-y-4">
                    <div className="flex items-start justify-between">
                      <TrendingUp className="h-8 w-8 text-primary" />
                      <Badge className={getRiskColor(plan.risk_level)}>
                        {plan.risk_level.toUpperCase()}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.description}
                      </p>
                    </div>

                    <div className="space-y-3 py-4 border-t border-b">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Unit Price:</span>
                        <span className="font-semibold">$70 per unit</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Cycle:</span>
                        <span className="font-semibold">7 days (weekly)</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Weekly ROI:</span>
                        <span className="font-semibold text-success">{plan.roi_percentage}%</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Min Investment:</span>
                        <span className="font-semibold">1 unit ($70)</span>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                        {plan.roi_percentage}%
                      </div>
                      <div className="text-sm text-muted-foreground">Returns</div>
                    </div>

                    <Button
                      className="w-full bg-primary hover:bg-primary/90 group-hover:scale-105 transition-transform"
                      onClick={() => navigate(`/invest?plan=${plan.id}`)}
                    >
                      Get Started
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 animate-fade-in" style={{ animationDelay: "0.5s" }}>
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Why Choose Our Investment Plans?</h2>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="space-y-2">
                  <Shield className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Secure & Insured</h3>
                  <p className="text-sm text-muted-foreground">
                    All investments are protected with bank-grade security and insurance
                  </p>
                </div>
                <div className="space-y-2">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Proven Returns</h3>
                  <p className="text-sm text-muted-foreground">
                    Consistent track record of delivering promised returns to investors
                  </p>
                </div>
                <div className="space-y-2">
                  <Clock className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Flexible Terms</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose from various duration options that fit your financial goals
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
