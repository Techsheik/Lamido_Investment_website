import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

const Investments = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [, setRerender] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: investments, isLoading, refetch: refetchInvestments } = useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Investments fetch error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    staleTime: 5000,
  });

  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("weekly_roi_percentage, roi_percentage, total_roi, accrued_return")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5000,
  });

  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        refetchProfile();
        refetchInvestments();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user, refetchProfile, refetchInvestments]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRerender(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading || isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeInvestments = investments?.filter(inv => inv.status !== "rejected") || [];
  const rejectedInvestments = investments?.filter(inv => inv.status === "rejected") || [];
  
  const totalInvested = activeInvestments?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
  const totalROI = activeInvestments?.reduce((sum, inv) => sum + (Number(inv.amount) * Number(inv.roi || userProfile?.weekly_roi_percentage || 10) / 100), 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">My Investments</h1>
            <p className="text-muted-foreground mt-2">Track and manage your investment portfolio</p>
          </div>
          <Button onClick={() => navigate("/services")}>
            <TrendingUp className="h-4 w-4 mr-2" />
            New Investment
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Invested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInvested.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Expected Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${totalROI.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total ROI ($)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${Number(userProfile?.total_roi || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                ROI Rate (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {Number(userProfile?.roi_percentage || 0).toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Weekly ROI (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {Number(userProfile?.weekly_roi_percentage || 10).toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Active Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {investments?.filter(inv => inv.status === "active").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {rejectedInvestments && rejectedInvestments.length > 0 && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              ⚠️ You have {rejectedInvestments.length} declined investment(s). Your invested amount has been refunded. Please contact our support team for more details.
            </p>
          </Card>
        )}

        {activeInvestments && activeInvestments.length > 0 ? (
          <div className="grid gap-6">
            {activeInvestments.map((investment) => {
              const startDate = new Date(investment.start_date || investment.created_at);
              const duration = investment.duration || 7;
              const endDate = investment.end_date ? new Date(investment.end_date) : new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
              const now = new Date();
              
              const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
              const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const daysElapsed = Math.floor((currentDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const progress = Math.min(100, Math.max(0, (daysElapsed / duration) * 100));
              const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

              return (
                <Card key={investment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{investment.type}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Started {startDate.toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={(investment.status === "active" || investment.status === "approved") ? "default" : investment.status === "suspended" ? "destructive" : "secondary"}>
                        {investment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Units</p>
                        <p className="text-xl font-bold">{investment.units || 1} unit{(investment.units || 1) !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="text-xl font-bold">${Number(investment.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Weekly ROI</p>
                        <p className="text-xl font-bold text-success">{Number(investment.roi || userProfile?.weekly_roi_percentage || 10).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Weekly Return</p>
                        <p className="text-xl font-bold text-success">
                          ${(Number(investment.amount) * (Number(investment.roi || userProfile?.weekly_roi_percentage || 10) / 100)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {(investment.status === "pending") && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                          ⏳ Pending admin approval - progress will start once approved
                        </p>
                      </div>
                    )}

                    {(investment.status === "active" || investment.status === "approved" || investment.status === "suspended") && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {investment.status === "suspended" ? "Paused" : `Progress (Day ${Math.min(daysElapsed, duration)} of ${duration})`}
                          </span>
                          <span className="font-medium">
                            {investment.status === "suspended" ? "Suspended by admin" : (daysRemaining > 0 ? `${daysRemaining} days remaining` : "Matured")}
                          </span>
                        </div>
                        <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${investment.status === "suspended" ? "opacity-50" : ""}`}
                            style={{
                              width: `${progress}%`,
                              background: investment.status === "suspended" ? "#94a3b8" : (
                                progress < 33 ? 
                                'linear-gradient(90deg, #ef4444, #f97316)' :
                                progress < 66 ?
                                'linear-gradient(90deg, #f97316, #eab308)' :
                                'linear-gradient(90deg, #eab308, #22c55e)'
                              )
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No investments yet. Start your investment journey today!</p>
              <Button onClick={() => navigate("/services")}>
                Browse Investment Plans
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Investments;
