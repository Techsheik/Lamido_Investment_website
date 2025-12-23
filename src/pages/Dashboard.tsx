import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: investments } = useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalInvested = investments?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const activeInvestments = investments?.filter(inv => inv.status === "active").length || 0;
  const totalROI = investments?.reduce((sum, inv) => sum + (Number(inv.amount) * Number(inv.roi) / 100), 0) || 0;
  
  // Calculate Total Accrued Return (only for investments that have completed at least 7 days)
  const totalAccruedReturn = investments?.reduce((sum, inv) => {
    if (inv.status !== "active" || !inv.start_date) return sum;
    
    const startDate = new Date(inv.start_date);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only count returns if investment has completed at least 7 days
    if (daysPassed >= 7) {
      const totalReturn = Number(inv.amount) * Number(inv.roi) / 100;
      return sum + totalReturn;
    }
    
    return sum;
  }, 0) || 0;

  // Calculate total units
  const totalUnits = investments?.reduce((sum, inv) => sum + (inv.units || 1), 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your investments and track your portfolio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalInvested.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalInvested === 0 ? "Start investing today" : `${totalUnits} unit${totalUnits !== 1 ? 's' : ''} invested`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Accrued Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${totalAccruedReturn.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Available to withdraw (7+ days)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expected Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${totalROI.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total ROI at maturity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeInvestments}</div>
              <p className="text-xs text-muted-foreground mt-1">Investment plans</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="w-full" onClick={() => navigate("/services")}>
                Browse Investment Plans
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/deposit")}>
                Deposit Funds
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/payment")}>
                Make Payment
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/investments")}>
                View My Investments
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/transactions")}>
                Transaction History
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/announcements")}>
                View Announcements
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
