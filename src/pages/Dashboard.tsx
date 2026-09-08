import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TrendingUp, ArrowUpRight, Megaphone, ArrowRight, Pin, AlertTriangle, BellRing, Wrench, Info, CheckCircle2 } from "lucide-react";
import { parseAnnouncement, isAnnouncementExpired, Announcement } from "@/lib/announcement-utils";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [popupDismissed, setPopupDismissed] = useState(false);

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
    refetchInterval: 10000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("accrued_return, total_roi")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: userDistributions = [] } = useQuery({
    queryKey: ["dash-user-distributions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cycle_distributions")
        .select("profit, total_return")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: announcements } = useQuery({
    queryKey: ["user-dashboard-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const parsedList = (data || [])
        .map((item) => parseAnnouncement(item))
        .filter((item) => !isAnnouncementExpired(item));

      return parsedList.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    refetchInterval: 10000,
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

  const heroAnnouncement = announcements && announcements.length > 0 ? announcements[0] : null;
  const popupAnnouncement = announcements?.find((a) => a.show_popup);

  // Count active, approved, AND completed investments for accurate portfolio totals
  const validInvestments = investments?.filter(inv =>
    inv.status === "active" || inv.status === "approved" || inv.status === "completed"
  ) || [];

  const totalInvested = validInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const activeInvestments = validInvestments.length;
  const totalUnits = validInvestments.reduce((sum, inv) => sum + (Number(inv.units) || 1), 0);

  // Real admin-confirmed profit from cycle_distributions table
  const totalDistributedProfit = userDistributions.reduce((sum, d) => sum + Number(d.profit || 0), 0);
  const totalAccruedReturn = totalDistributedProfit > 0
    ? totalDistributedProfit
    : Number(profile?.accrued_return || profile?.total_roi || 0);

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" /> URGENT ALERT
          </Badge>
        );
      case "important":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 font-semibold">
            <BellRing className="w-3 h-3" /> IMPORTANT
          </Badge>
        );
      case "maintenance":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold">
            <Wrench className="w-3 h-3" /> MAINTENANCE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500/30 gap-1 font-semibold">
            <Info className="w-3 h-3" /> NOTICE
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your investments and track your portfolio</p>
        </div>

        {/* Featured / Latest Announcement Hero Banner */}
        {heroAnnouncement && (
          <Card
            className={`transition-all border ${
              heroAnnouncement.is_pinned
                ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-background to-amber-500/5 shadow-md"
                : heroAnnouncement.priority === "urgent"
                ? "border-red-500/40 bg-gradient-to-r from-red-500/10 via-background to-red-500/5"
                : "bg-gradient-to-r from-primary/10 via-background to-blue-500/10 border-primary/30"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-500" />
                  {heroAnnouncement.is_pinned && (
                    <Badge className="bg-amber-500 text-white font-bold text-xs gap-1">
                      <Pin className="w-3 h-3 fill-current" /> FEATURED
                    </Badge>
                  )}
                  {getPriorityBadge(heroAnnouncement.priority)}
                  <CardTitle className="text-base font-bold text-foreground">
                    {heroAnnouncement.title}
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/announcements")}>
                  View All Broadcasts <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {heroAnnouncement.content}
              </p>
            </CardContent>
          </Card>
        )}

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
                Total Profit Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${totalAccruedReturn.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Distributed at the end of each 7-day cycle</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Share Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">{totalUnits} Units</div>
              <p className="text-xs text-muted-foreground mt-1">Eligible for community profit distribution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Investment Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{activeInvestments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeInvestments === 0 ? "No active plans" : "Plans participating in community ROI"}
              </p>
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

      {/* Interactive Urgent Popup Modal Banner */}
      {popupAnnouncement && !popupDismissed && (
        <Dialog open={true} onOpenChange={() => setPopupDismissed(true)}>
          <DialogContent className="max-w-md border-amber-500/40">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-amber-500 animate-bounce" />
                {getPriorityBadge(popupAnnouncement.priority)}
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {popupAnnouncement.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Official announcement from Lamido Trading Community Admin
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {popupAnnouncement.image_url && (
                <div className="rounded-lg overflow-hidden border max-h-48">
                  <img src={popupAnnouncement.image_url} alt={popupAnnouncement.title} className="w-full h-48 object-cover" />
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                {popupAnnouncement.content}
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setPopupDismissed(true)}
                className="w-full bg-primary text-primary-foreground font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> I Understand & Dismiss
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
