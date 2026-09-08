import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut, User, Bell, TrendingUp, Megaphone, AlertTriangle, BellRing, Wrench, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InvestmentNotificationBanner } from "@/components/InvestmentNotificationBanner";
import { parseAnnouncement, isAnnouncementExpired, Announcement } from "@/lib/announcement-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_code, referral_code, balance")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch admin broadcast announcements for notification menu
  const { data: announcements = [] } = useQuery({
    queryKey: ["header-bell-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) return [];

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

  // Fetch investment updates
  const { data: maturedInvestments = [] } = useQuery({
    queryKey: ["matured-header-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "approved", "completed"]);

      if (!data) return [];
      const now = new Date();
      return data.filter((inv: any) => {
        const startDate = new Date(inv.start_date || inv.created_at);
        const duration = Number(inv.duration) || 7;
        const endDate = inv.end_date 
          ? new Date(inv.end_date) 
          : new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
        return now.getTime() >= endDate.getTime() || inv.status === "completed";
      });
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const totalNotifications = announcements.length + maturedInvestments.length;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = user?.user_metadata?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "U";

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px]">URGENT</Badge>;
      case "important":
        return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px]">IMPORTANT</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">MAINTENANCE</Badge>;
      default:
        return <Badge variant="outline" className="text-blue-500 border-blue-500/30 text-[10px]">NOTICE</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger />
              <div className="ml-auto flex items-center gap-3">
                {profile?.user_code && (
                  <Badge variant="outline" className="text-sm font-mono hidden sm:inline-flex">
                    User Code: {profile.user_code}
                  </Badge>
                )}

                {/* Notifications Bell Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      {totalNotifications > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-2 ring-background animate-pulse">
                          {totalNotifications}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-80 sm:w-96">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span className="font-semibold">Notifications</span>
                      {totalNotifications > 0 && (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">
                          {totalNotifications} New
                        </Badge>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {totalNotifications === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No new notifications
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto space-y-1.5 p-1">
                        {/* 1. Admin Broadcast Announcements */}
                        {announcements.map((anc) => (
                          <DropdownMenuItem 
                            key={anc.id}
                            className="cursor-pointer flex flex-col items-start p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 focus:bg-amber-500/10 transition-colors"
                            onClick={() => setSelectedAnnouncement(anc)}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground line-clamp-1">
                                <Megaphone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                {anc.title}
                              </div>
                              {getPriorityBadge(anc.priority)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {anc.content}
                            </p>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1.5 flex items-center gap-1">
                              Click to view announcement →
                            </span>
                          </DropdownMenuItem>
                        ))}

                        {/* 2. Matured Investments & Distributions */}
                        {maturedInvestments.map((inv: any) => {
                          const roi = Number(inv.roi) || 10;
                          const returnVal = (Number(inv.amount) * (roi / 100)).toFixed(2);
                          return (
                            <DropdownMenuItem 
                              key={inv.id}
                              className="cursor-pointer flex flex-col items-start p-2.5 rounded-lg focus:bg-accent"
                              onClick={() => navigate("/investments")}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Due Date Reached / Distributed!
                              </div>
                              <p className="text-xs font-medium text-foreground mt-0.5">
                                {inv.type} (${Number(inv.amount).toLocaleString()})
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Return of +${returnVal} processed.
                              </p>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user?.user_metadata?.name || "User"}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6">
            <InvestmentNotificationBanner />
            {children}
          </main>
        </div>
      </div>

      {/* FULL ANNOUNCEMENT DETAIL POPUP MODAL */}
      {selectedAnnouncement && (
        <Dialog open={true} onOpenChange={() => setSelectedAnnouncement(null)}>
          <DialogContent className="max-w-lg border-amber-500/40">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-amber-500" />
                {getPriorityBadge(selectedAnnouncement.priority)}
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {selectedAnnouncement.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Official announcement from Lamido Trading Community Admin
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 max-h-[60vh] overflow-y-auto">
              {selectedAnnouncement.image_url && (
                <div className="rounded-lg overflow-hidden border max-h-56">
                  <img src={selectedAnnouncement.image_url} alt={selectedAnnouncement.title} className="w-full h-56 object-cover" />
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                {selectedAnnouncement.content}
              </p>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAnnouncement(null);
                  navigate("/announcements");
                }}
                className="gap-1.5 text-xs w-full sm:w-auto"
              >
                View All Broadcasts <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={() => setSelectedAnnouncement(null)}
                className="bg-primary text-primary-foreground font-semibold gap-1.5 w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4" /> Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SidebarProvider>
  );
}
