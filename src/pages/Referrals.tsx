import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Users, Gift, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ReferralData {
  id: string;
  referrer_id: string;
  referree_id: string;
  reward_amount: number;
  reward_given: boolean;
  reward_given_at: string;
  created_at: string;
  referree_name?: string;
  referree_email?: string;
}

const Referrals = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const { data: userProfile, isLoading: profileLoading, isError: profileError, error: queryError } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, balance")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Profile fetch error:", error);
        throw error;
      }
      return data;
    },
    enabled: !!(user?.id),
  });
  
  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("referrals")
        .select(
          `id, referrer_id, referree_id, reward_amount, reward_given, reward_given_at, created_at,
           referree:referree_id (id, name, email)`
        )
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      return (data || []).map((r: any) => ({
        id: r.id,
        referrer_id: r.referrer_id,
        referree_id: r.referree_id,
        reward_amount: r.reward_amount,
        reward_given: r.reward_given,
        reward_given_at: r.reward_given_at,
        created_at: r.created_at,
        referree_name: r.referree?.name,
        referree_email: r.referree?.email,
      }));
    },
    enabled: !!(user?.id),
  });

  const copyToClipboard = () => {
    if (userProfile?.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalRewards = referrals?.reduce(
    (sum, ref) => (ref.reward_given ? sum + ref.reward_amount : sum),
    0
  ) || 0;

  const pendingRewards = referrals?.reduce(
    (sum, ref) => (!ref.reward_given ? sum + ref.reward_amount : sum),
    0
  ) || 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-4xl font-bold">Referral Program</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{referrals?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                People you've referred
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Total Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalRewards.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Credits earned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pending Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">${pendingRewards.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting activation
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle>Your Referral Code</CardTitle>
            <CardDescription>
              Share this code with your friends and earn rewards when they sign up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-card rounded-lg border border-border">
              <code className="flex-1 text-lg font-mono font-bold text-foreground">
                {profileError ? "Error loading code" : profileLoading ? "Loading..." : userProfile?.referral_code || "No code"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="hover:shadow-glow-primary"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Share your code with friends or family</p>
              <p>• They enter it during signup</p>
              <p>• You earn 1,000 bonus credits per successful referral</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
            <CardDescription>
              Track all your referrals and their reward status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <p className="text-muted-foreground">Loading referrals...</p>
            ) : !referrals || referrals.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No referrals yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start sharing your code to earn rewards
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral: ReferralData) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.referree_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {referral.referree_email || "N/A"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${referral.reward_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              referral.reward_given ? "default" : "outline"
                            }
                          >
                            {referral.reward_given ? "Rewarded" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(referral.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Referrals;
