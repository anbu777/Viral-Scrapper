"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Film, Play, Users, Settings2, FileText, Mic, BookImage, UserSquare2, Clapperboard, HeartPulse, Upload, History } from "lucide-react";
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

const navItems = [
  { title: "Videos", href: "/videos", icon: Film },
  { title: "Run Pipeline", href: "/run", icon: Play },
  { title: "Run History", href: "/runs", icon: History },
  { title: "Manual Import", href: "/import", icon: Upload },
  { title: "Creators", href: "/creators", icon: Users },
  { title: "Configs", href: "/configs", icon: Settings2 },
  { title: "Provider Health", href: "/settings", icon: HeartPulse },
];

const scriptItems = [
  { title: "My Scripts", href: "/scripts", icon: FileText },
  { title: "Generated Videos", href: "/generated", icon: Clapperboard },
  { title: "Avatars", href: "/avatars", icon: UserSquare2 },
  { title: "Avatar Profiles", href: "/voice-profile", icon: Mic },
  { title: "Prompt Library", href: "/prompt-library", icon: BookImage },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(0);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((videos: { dateAdded: string }[]) => {
        if (videos.length > 0 && videos[0].dateAdded) {
          setLastRun(videos[0].dateAdded);
        }
      })
      .catch(() => {});

    const refreshPending = () => {
      fetch("/api/scripts")
        .then((r) => r.json())
        .then((scripts: { videoStatus?: string }[]) => {
          setPendingApproval(scripts.filter((s) => s.videoStatus === "awaiting_approval").length);
        })
        .catch(() => {});
    };
    refreshPending();
    const interval = setInterval(refreshPending, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar className="border-r border-white/[0.06]">
      <SidebarHeader className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon/10 border border-neon/20 glow-sm">
            <Film className="h-4 w-4 text-neon" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">Virality System</h1>
            <p className="text-[11px] text-muted-foreground">Instagram Reels AI</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-10 rounded-xl px-3 transition-all duration-200"
                    >
                      <Link href={item.href}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-neon" : ""}`} />
                        <span className="text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/[0.05]" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neon/50 mb-1">
            Script Studio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {scriptItems.map((item) => {
                const isActive = pathname === item.href;
                const showBadge = item.href === "/generated" && pendingApproval > 0;
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
                        {showBadge && (
                          <span className="ml-auto inline-flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full text-[10px] font-bold bg-neon/15 text-neon border border-neon/25">
                            {pendingApproval}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {lastRun && (
        <SidebarFooter className="px-5 py-4">
          <p className="text-[11px] text-muted-foreground">
            Last pipeline: <span className="text-foreground/70">{lastRun}</span>
          </p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
