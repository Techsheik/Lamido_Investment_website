import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Shield, Users, Award } from "lucide-react";

export default function About() {
  const navigate = useNavigate();

  const stats = [
    { label: "Active Users", value: "50,000+", icon: Users },
    { label: "Total Investments", value: "$500M+", icon: TrendingUp },
    { label: "Success Rate", value: "98%", icon: Award },
    { label: "Secure Transactions", value: "1M+", icon: Shield },
  ];

  const values = [
    {
      title: "Trust & Transparency",
      description: "We believe in complete transparency with our investors. All fees, returns, and risks are clearly communicated.",
      icon: Shield,
    },
    {
      title: "Innovation",
      description: "Leveraging cutting-edge technology to provide the best investment experience and returns.",
      icon: TrendingUp,
    },
    {
      title: "Community First",
      description: "Our success is measured by the success of our investors. Your financial growth is our priority.",
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              About Lamido Crypto Trading Community
            </h1>
            <p className="text-xl text-muted-foreground">
              Empowering Your Financial Future Through Smart Investments
            </p>
          </div>

          <Card className="p-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-2xl font-bold mb-4">Our Story</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Founded in 2020, Lamido Crypto Trading Community was born from a simple belief: everyone deserves access to
                premium investment opportunities that were traditionally reserved for the wealthy elite.
              </p>
              <p>
                We've grown from a small startup to a leading investment platform, serving over 50,000
                investors worldwide. Our mission remains unchanged: to democratize wealth creation through
                innovative investment strategies and cutting-edge technology.
              </p>
              <p>
                Today, we manage over $500M in assets, delivering consistent returns while maintaining
                the highest standards of security and transparency.
              </p>
            </div>
          </Card>

          <div className="grid md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card
                key={stat.label}
                className="p-6 text-center animate-fade-in hover:shadow-lg transition-all"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <stat.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">Our Values</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <Card
                  key={value.title}
                  className="p-6 animate-fade-in hover:shadow-lg transition-all"
                  style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                >
                  <value.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 animate-fade-in" style={{ animationDelay: "0.7s" }}>
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Ready to Start Your Investment Journey?</h2>
              <p className="text-muted-foreground">
                Join thousands of investors who trust Lamido Crypto Trading Community with their financial future.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90"
              >
                Get Started Today
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
