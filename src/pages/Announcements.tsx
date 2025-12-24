import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
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
          <h1 className="text-4xl font-bold">Announcements</h1>
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
              <p className="text-center text-muted-foreground">No announcements available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements?.map((announcement: any) => (
              <Card key={announcement.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {announcement.image_url && (
                  <div className="w-full h-64 overflow-hidden bg-muted">
                    <img 
                      src={announcement.image_url} 
                      alt={announcement.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{announcement.title}</CardTitle>
                  <CardDescription>
                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                    {announcement.content}
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
