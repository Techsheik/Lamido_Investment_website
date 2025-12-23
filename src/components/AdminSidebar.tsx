import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Receipt,
  Settings,
  User,
  Briefcase,
  Package,
  Megaphone,
  Shield,
  FileCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Investments", url: "/admin/investments", icon: TrendingUp },
  { title: "Transactions", url: "/admin/transactions", icon: Receipt },
  { title: "Transaction Proofs", url: "/admin/transaction-proofs", icon: FileCheck },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
  { title: "Admin Management", url: "/admin/management", icon: Shield },
  { title: "Investor Management", url: "/admin/investor-management", icon: Briefcase },
  { title: "Plan Builder", url: "/admin/plan-builder", icon: Package },
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "Profile", url: "/admin/profile", icon: User },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold">
            {!collapsed && "Admin Panel"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
