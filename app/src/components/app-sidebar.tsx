"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Film,
  Play,
  Users,
  Settings2,
  FileText,
  Mic,
  BookImage,
  UserSquare2,
  Clapperboard,
  Upload,
  History,
  Settings,
  Flame,
  Zap,
  TrendingUp,
  Calendar,
  Compass,
  Activity,
  ScrollText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const intelligenceItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Videos", href: "/videos", icon: Film },
  { title: "Viral Alerts", href: "/viral-alerts", icon: Flame, badge: "alerts" },
  { title: "Trends", href: "/trends", icon: TrendingUp },
  { title: "Reports", href: "/reports", icon: ScrollText },
  { title: "Discover", href: "/discover", icon: Compass },
];

const pipelineItems = [
  { title: "Run Pipeline", href: "/run", icon: Play },
  { title: "Run History", href: "/runs", icon: History },
  { title: "Manual Import", href: "/import", icon: Upload },
];

const setupItems = [
  { title: "Creators", href: "/creators", icon: Users },
  { title: "Configs", href: "/configs", icon: Settings2 },
];

const studioItems = [
  { title: "My Scripts", href: "/scripts", icon: FileText, badge: "approval" },
  { title: "Generated Videos", href: "/generated", icon: Clapperboard },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "Performance", href: "/performance", icon: Activity },
  { title: "Avatars", href: "/avatars", icon: UserSquare2 },
  { title: "Voice Profiles", href: "/voice-profile", icon: Mic },
  { title: "Prompt Library", href: "/prompt-library", icon: BookImage },
];

const systemItems = [
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [pendingApproval, setPendingApproval] = useState(0);
  const [viralAlerts, setViralAlerts] = useState(0);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/scripts")
        .then((r) => r.json())
        .then((scripts: { videoStatus?: string }[]) => {
          setPendingApproval(scripts.filter((s) => s.videoStatus === "awaiting_approval").length);
        })
        .catch(() => {});
      fetch("/api/scheduler/alerts?unseen=true")
        .then((r) => r.json())
        .then((alerts: { id: string }[]) => {
          setViralAlerts(Array.isArray(alerts) ? alerts.length : 0);
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  const renderItems = (items: typeof intelligenceItems) =>
    items.map((item) => {
      const isActive = pathname === item.href;
      const badge =
        item.badge === "approval" ? pendingApproval : item.badge === "alerts" ? viralAlerts : 0;
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className="h-10 rounded-xl px-3 transition-all duration-200"
          >
            <Link href={item.href}>
              <item.icon className={`h-4 w-4 ${isActive ? "text-neon" : ""}`} />
              <span className="text-[13px] flex-1">{item.title}</span>
              {badge > 0 && (
                <span className="ml-auto inline-flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full text-[10px] font-bold bg-neon/15 text-neon border border-neon/25">
                  {badge}
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar className="border-r border-white/[0.06]">
      <SidebarHeader className="px-5 py-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-neon/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon to-emerald-500 shadow-lg">
              <Zap className="h-5 w-5 text-black fill-black" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight gradient-text">Virality System</h1>
            <p className="text-[10px] text-muted-foreground">Social Media Intelligence</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(intelligenceItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/[0.05]" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            Pipeline
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(pipelineItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/[0.05]" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            Setup
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(setupItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/[0.05]" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neon/60 mb-1">
            Studio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(studioItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/[0.05]" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(systemItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-5 py-4">
        <p className="text-[10px] text-muted-foreground/50">
          v2.0 · <span className="text-foreground/70">Multi-Platform</span>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
