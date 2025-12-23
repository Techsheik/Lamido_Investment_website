import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Bell, Lock, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-primary-glow flex items-center justify-center">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Moon className="h-5 w-5 text-primary" />
                Appearance
              </h3>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark theme
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive investment updates via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    defaultChecked
                    onCheckedChange={(checked) =>
                      toast.success(
                        checked
                          ? "Email notifications enabled"
                          : "Email notifications disabled"
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="transaction-alerts">Transaction Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about deposits and withdrawals
                    </p>
                  </div>
                  <Switch
                    id="transaction-alerts"
                    defaultChecked
                    onCheckedChange={(checked) =>
                      toast.success(
                        checked
                          ? "Transaction alerts enabled"
                          : "Transaction alerts disabled"
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="investment-reminders">Investment Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Remind me about investment maturity dates
                    </p>
                  </div>
                  <Switch
                    id="investment-reminders"
                    defaultChecked
                    onCheckedChange={(checked) =>
                      toast.success(
                        checked
                          ? "Investment reminders enabled"
                          : "Investment reminders disabled"
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Security
              </h3>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info("Password change coming soon")}
                >
                  Change Password
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info("2FA setup coming soon")}
                >
                  Enable Two-Factor Authentication
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => toast.info("Account deactivation requires admin approval")}
              >
                Deactivate Account
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
