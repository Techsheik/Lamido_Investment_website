import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DollarSign, Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import heroBg from "@/assets/hero-bg.jpg";
import aboutImg from "@/assets/about-img.jpg";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAuthClick = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-card/95 backdrop-blur-md z-50 border-b border-border shadow-elegant">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Lamido Crypto Trading Community" className="h-10 w-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Lamido Crypto Trading Community</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('home')} className="text-foreground hover:text-primary transition-all">Home</button>
              <button onClick={() => scrollToSection('about')} className="text-foreground hover:text-primary transition-all">About</button>
              <button onClick={() => scrollToSection('services')} className="text-foreground hover:text-primary transition-all">Services</button>
              <button onClick={() => scrollToSection('team')} className="text-foreground hover:text-primary transition-all">Achievements</button>
              <Button onClick={handleAuthClick} className="hover:shadow-glow-primary transition-all">
                {user ? "Dashboard" : "Login / Register"}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="Investment Growth" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10"></div>
        </div>
        <div className="container mx-auto px-4 z-10 text-center animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6">
            Secure Your Future with <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Smart Investments</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Join thousands of investors who trust us to grow their wealth through strategic investment solutions in real estate, stocks, crypto, and mutual funds.
          </p>
          <Button 
            size="lg" 
            variant="accent"
            className="text-lg px-8 py-6 hover:shadow-glow-accent"
            onClick={handleAuthClick}
          >
            {user ? "Go to Dashboard" : "Get Started"}
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="services" className="py-24 bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Investment Services</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Secure and profitable cryptocurrency investment solutions
            </p>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <Card className="group hover:shadow-glow-primary transition-all duration-300 hover:-translate-y-2 animate-slide-up border-border">
                <CardContent className="p-8 bg-gradient-to-br from-secondary/10 to-secondary/5">
                  <DollarSign className="h-16 w-16 mb-4 text-secondary mx-auto group-hover:scale-110 transition-transform" />
                  <h3 className="text-2xl font-bold mb-3 text-foreground text-center">Cryptocurrency</h3>
                  <p className="text-muted-foreground text-center">Access digital assets with our secure crypto investment platform</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">About Lamido Crypto Trading Community</h2>
              <p className="text-lg text-muted-foreground mb-6">
                With over 15 years of experience in the financial sector, Lamido Crypto Trading Community has become a trusted partner for investors worldwide. Our mission is to democratize wealth creation by providing accessible, transparent, and profitable investment opportunities.
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                We combine cutting-edge technology with human expertise to deliver personalized investment strategies that align with your financial goals. From beginners to seasoned investors, we provide the tools and guidance you need to succeed.
              </p>
              <div className="grid grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">50K+</div>
                  <div className="text-sm text-muted-foreground">Active Investors</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">$2B+</div>
                  <div className="text-sm text-muted-foreground">Assets Managed</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent mb-2">15+</div>
                  <div className="text-sm text-muted-foreground">Years Experience</div>
                </div>
              </div>
            </div>
            <div className="animate-fade-in">
              <img src={aboutImg} alt="About Lamido Crypto Trading Community" className="rounded-lg shadow-2xl w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Meet Our Expert Team</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our dedicated professionals bring decades of combined experience in finance and investment
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { name: "Michael Thompson", role: "Chief Investment Officer" },
              { name: "Sarah Martinez", role: "Portfolio Manager" },
              { name: "David Chen", role: "Financial Analyst" },
              { name: "Emily Roberts", role: "Client Relations Director" }
            ].map((member, index) => {
              const initials = member.name.split(' ').map(n => n[0]).join('');
              return (
                <Card key={index} className="group hover:shadow-xl transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center">
                      <Avatar className="h-32 w-32 mb-4 bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30">
                        <AvatarFallback className="text-4xl font-bold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-xl font-bold mb-2 text-center">{member.name}</h3>
                      <p className="text-muted-foreground text-center">{member.role}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/50 backdrop-blur-sm border-t border-border text-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Lamido Crypto Trading Community" className="h-8 w-8 object-contain" />
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Lamido Crypto Trading Community</span>
              </div>
              <p className="text-muted-foreground">
                Your trusted partner in building wealth through smart investments.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-foreground">Contact Us</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Lagos, Nigeria</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-5 w-5 text-primary" />
                  <span>+234 800 000 0000</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-5 w-5 text-primary" />
                  <span>info@lamidocrypto.com</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-foreground">Follow Us</h3>
              <div className="flex gap-4">
                <Button variant="ghost" size="icon" className="hover:bg-muted hover:text-primary transition-all">
                  <Facebook className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="hover:bg-muted hover:text-primary transition-all">
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="hover:bg-muted hover:text-primary transition-all">
                  <Linkedin className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="hover:bg-muted hover:text-primary transition-all">
                  <Instagram className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 Lamido Crypto Trading Community. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
