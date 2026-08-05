import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut, User, Bell, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InvestmentNotificationBanner } from "@/components/InvestmentNotificationBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = user?.user_metadata?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "U";

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
                      {maturedInvestments.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white ring-2 ring-background animate-pulse">
                          {maturedInvestments.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Notifications</span>
                      {maturedInvestments.length > 0 && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                          {maturedInvestments.length} Matured
                        </Badge>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {maturedInvestments.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        No new notifications
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-1 p-1">
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
                                <Sparkles className="h-3.5 w-3.5" /> Due Date Reached!
                              </div>
                              <p className="text-xs font-medium text-foreground mt-0.5">
                                {inv.type} (${Number(inv.amount).toLocaleString()})
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Return of +${returnVal} ready for withdrawal.
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
    </SidebarProvider>
  );
}
