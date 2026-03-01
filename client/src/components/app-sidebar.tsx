import { Link, useLocation } from "wouter";
import { Crosshair, TrendingUp, Settings, Bookmark, Swords, Shield } from "lucide-react";
import logoImage from "@assets/image_1771177688499.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  { title: "Item Advisor", url: "/", icon: Crosshair },
  { title: "Market Prices", url: "/market", icon: TrendingUp },
  { title: "Saved Items", url: "/saved", icon: Bookmark },
];

const configItems = [
  { title: "Build Weights", url: "/weights", icon: Swords },
  { title: "Meta Bases", url: "/bases", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Exile Insight" className="h-9 w-9 rounded-md object-cover" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight" data-testid="text-app-title">Exile Insight</h2>
            <p className="text-xs text-muted-foreground">Trade & Craft Tool</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">v1.0</Badge>
          <span className="text-xs text-muted-foreground">poe.ninja powered</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
