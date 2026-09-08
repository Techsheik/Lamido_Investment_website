import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pin, AlertTriangle, BellRing, Wrench, Info, Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseAnnouncement, isAnnouncementExpired, Announcement } from "@/lib/announcement-utils";

const Announcements = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Announcements query error:", error);
        return [];
      }

      const parsedList = (data || [])
        .map((item) => parseAnnouncement(item))
        .filter((item) => !isAnnouncementExpired(item));

      // Sort pinned to top first, then by date
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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-amber-500" />
            Community Broadcasts
          </h1>
          <p className="text-muted-foreground mt-2">
            {announcements?.length === 0
              ? "No announcements at this time"
              : `${announcements?.length} announcement${announcements?.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <p className="text-muted-foreground">Loading announcements...</p>
          </div>
        ) : announcements?.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12">
              <p className="text-center text-muted-foreground">No active announcements available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {announcements?.map((item: Announcement) => (
              <Card
                key={item.id}
                className={`overflow-hidden transition-all border ${
                  item.is_pinned
                    ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-background to-amber-500/10 shadow-md"
                    : item.priority === "urgent"
                    ? "border-red-500/30 bg-red-500/5 shadow-sm"
                    : "bg-card hover:shadow-lg"
                }`}
              >
                {item.image_url && (
                  <div className="w-full h-64 overflow-hidden bg-muted">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {item.is_pinned && (
                      <Badge className="bg-amber-500 text-white font-bold text-xs gap-1">
                        <Pin className="w-3 h-3 fill-current" /> FEATURED
                      </Badge>
                    )}
                    {getPriorityBadge(item.priority)}
                  </div>

                  <CardTitle className="text-2xl font-bold">{item.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Published {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {item.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Announcements;
