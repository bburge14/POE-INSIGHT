import { Link, useLocation } from "wouter";
import { Crosshair, TrendingUp, Bookmark, Swords, Shield, Gem } from "lucide-react";
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
          <div className="relative">
            <img src={logoImage} alt="Exile Insight" className="h-10 w-10 rounded object-cover" />
            <div className="absolute -inset-[1px] rounded border border-primary/20 pointer-events-none" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-primary" data-testid="text-app-title">
              EXILE INSIGHT
            </h2>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Trade & Craft</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-muted-foreground/60">
            Tools
          </SidebarGroupLabel>
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
          <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-muted-foreground/60">
            Configuration
          </SidebarGroupLabel>
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
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70">
            <Gem className="h-2.5 w-2.5 mr-1" />
            v1.0
          </Badge>
          <span className="text-[10px] text-muted-foreground/50">poe.ninja powered</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
