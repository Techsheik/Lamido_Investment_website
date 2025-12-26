import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SignupSuccessDialog } from "@/components/SignupSuccessDialog";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const getFriendlyError = (error: any): string => {
  const msg = error?.message?.toLowerCase() || "";
  if (msg.includes("invalid") && msg.includes("credential")) return "Email or password is incorrect";
  if (msg.includes("user already")) return "An account with this email already exists";
  if (msg.includes("email not confirmed")) return "Please confirm your email before logging in";
  if (msg.includes("database error")) return "Unable to process your request. Please try again.";
  if (msg.includes("failed to save")) return "Unable to save your information. Please try again.";
  if (msg.includes("network")) return "Network connection error. Please try again.";
  return error?.message || "Something went wrong. Please try again.";
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralWarning, setReferralWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [userCode, setUserCode] = useState("");
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const countries = ["Nigeria", "Ghana", "South Africa", "Kenya", "United States", "United Kingdom"];
  
  const nigeriaStates = ["Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu", "Delta", "Anambra", "Ogun"];
  const ghanaStates = ["Greater Accra", "Ashanti", "Western", "Eastern", "Northern"];
  const southAfricaStates = ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape"];
  const kenyaStates = ["Nairobi", "Mombasa", "Kisumu", "Nakuru"];
  const usStates = ["California", "Texas", "Florida", "New York", "Pennsylvania"];
  const ukStates = ["England", "Scotland", "Wales", "Northern Ireland"];
  
  const getStates = () => {
    switch(country) {
      case "Nigeria": return nigeriaStates;
      case "Ghana": return ghanaStates;
      case "South Africa": return southAfricaStates;
      case "Kenya": return kenyaStates;
      case "United States": return usStates;
      case "United Kingdom": return ukStates;
      default: return [];
    }
  };

  // Redirect if already logged in - but wait for loading to complete and don't redirect if showing success dialog
  useEffect(() => {
    if (!loading && user && !showSuccessDialog) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate, showSuccessDialog]);

  if (loading) {
    return (
      <div className="w-screen h-screen fixed inset-0 flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Login Failed",
            description: getFriendlyError(error),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully logged in.",
          });
          navigate("/dashboard");
        }
      } else {
        if (!firstName.trim() || !surname.trim() || !phone.trim() || !country || !state || !lga.trim()) {
          toast({
            title: "Required Fields Missing",
            description: "Please fill in all required fields",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const fullName = `${firstName} ${middleName ? middleName + ' ' : ''}${surname}`;
        const metadata = {
          name: fullName,
          first_name: firstName,
          middle_name: middleName,
          surname: surname,
          phone: phone,
          country: country,
          state: state,
          lga: lga
        };

        const { data, error } = await signUp(email, password, fullName, metadata);
        if (error) {
          toast({
            title: "Sign Up Failed",
            description: getFriendlyError(error),
            variant: "destructive",
          });
        } else if (data?.user) {
          // Wait a bit for the trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (referralCode.trim()) {
            const { data: referralResult, error: referralError } = await supabase
              .rpc('process_referral', {
                p_new_user_id: data.user.id,
                p_referral_code: referralCode.toUpperCase().trim()
              });

            if (referralError) {
              setReferralWarning("Referral code not found or invalid");
            } else if (referralResult?.success) {
              if (referralResult.referral_processed) {
                toast({
                  title: "Referral Recorded",
                  description: "Thanks for using a referral code!",
                });
              }
            }
          }
          
          // Fetch the user code from the profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', data.user.id)
            .maybeSingle();
          
          if (profileData?.referral_code) {
            setUserCode(profileData.referral_code);
            setShowSuccessDialog(true);
          } else {
            toast({
              title: "Account Created!",
              description: "You can now log in with your credentials.",
            });
            setIsLogin(true);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setShowSuccessDialog(false);
    setIsLogin(true);
  };

  return (
    <>
      <SignupSuccessDialog 
        open={showSuccessDialog} 
        onClose={handleDialogClose}
        userCode={userCode}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-muted p-4 py-8">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:flex flex-col justify-center space-y-6 pl-6">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Start Trading Today
              </h2>
              <p className="text-lg text-muted-foreground">
                Join thousands of investors in the Lamido Crypto Trading Community and grow your wealth.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold">Secure & Safe</h4>
                  <p className="text-sm text-muted-foreground">Bank-grade security for your investments</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold">High Returns</h4>
                  <p className="text-sm text-muted-foreground">Competitive ROI on your investments</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold">Expert Support</h4>
                  <p className="text-sm text-muted-foreground">24/7 customer support team</p>
                </div>
              </div>
            </div>
          </div>
          <Card className="w-full shadow-elegant border-border/50 mx-auto">
        <CardHeader className="text-center relative pt-12 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4 hover:shadow-glow-primary transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={logo} alt="Lamido Crypto Trading Community" className="h-12 w-12 object-contain" />
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Lamido Crypto Trading Community</span>
          </div>
          <CardTitle className="text-2xl text-foreground">Welcome</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isLogin ? "login" : "signup"} onValueChange={(v) => setIsLogin(v === "login")}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full hover:shadow-glow-primary transition-all" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname" className="text-foreground">First Name *</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-surname" className="text-foreground">Surname *</Label>
                    <Input
                      id="signup-surname"
                      type="text"
                      placeholder="Doe"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      required
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-middlename" className="text-foreground">Middle Name (Optional)</Label>
                  <Input
                    id="signup-middlename"
                    type="text"
                    placeholder="Middle name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-foreground">Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone" className="text-foreground">Phone Number *</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-country" className="text-foreground">Country *</Label>
                  <select
                    id="signup-country"
                    className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setState("");
                      setLga("");
                    }}
                    required
                  >
                    <option value="" className="bg-card text-foreground">Select Country</option>
                    {countries.map((c) => (
                      <option key={c} value={c} className="bg-card text-foreground">{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-state" className="text-foreground">State *</Label>
                  <select
                    id="signup-state"
                    className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setLga("");
                    }}
                    required
                    disabled={!country}
                  >
                    <option value="" className="bg-card text-foreground">Select State</option>
                    {getStates().map((s) => (
                      <option key={s} value={s} className="bg-card text-foreground">{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-lga" className="text-foreground">LGA/City *</Label>
                  <Input
                    id="signup-lga"
                    type="text"
                    placeholder="Local Government Area"
                    value={lga}
                    onChange={(e) => setLga(e.target.value)}
                    required
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-referral" className="text-foreground">Referral Code <span className="text-muted-foreground">(Optional)</span></Label>
                  <Input
                    id="signup-referral"
                    type="text"
                    placeholder="Enter referral code if you have one"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setReferralWarning("");
                    }}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                  {referralWarning && (
                    <p className="text-sm text-destructive">{referralWarning}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button type="submit" className="w-full hover:shadow-glow-primary transition-all" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
};

export default Auth;
