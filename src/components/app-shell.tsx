import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSignOut, type SessionProfile } from "@/hooks/use-session";
import { NAV_GROUPS, ROLE_LABELS, primaryRole } from "@/lib/permissions";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function useBreadcrumbs() {
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return { group: group.label, page: item.title };
      }
    }
  }
  return { group: "Tổng quan", page: "Trang" };
}

export function AppShell({
  profile,
  clinicName,
  logoUrl,
  children,
}: {
  profile: SessionProfile;
  clinicName: string;
  logoUrl: string | null;
  children: ReactNode;
}) {
  const signOut = useSignOut();
  const crumbs = useBreadcrumbs();
  const role = primaryRole(profile.roles);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
        <AppSidebar roles={profile.roles} clinicName={clinicName} logoUrl={logoUrl} />

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-30 flex h-14 w-full min-w-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <span className="hidden h-5 w-px bg-border sm:block" />
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="text-muted-foreground">
                      {crumbs.group}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">{crumbs.page}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Thông báo"
                className="text-muted-foreground hover:text-foreground"
              >
                <Bell className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 px-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary">
                        {initials(profile.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[10rem] text-left md:block">
                      <span className="block truncate text-sm font-medium leading-tight">
                        {profile.fullName}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {ROLE_LABELS[role]}
                      </span>
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{profile.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <User className="mr-2 size-4" />
                    Hồ sơ cá nhân
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void signOut()}>
                    <LogOut className="mr-2 size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
            {children}
          </main>

          <footer className="mt-auto border-t border-border/70 px-4 py-4 text-xs text-muted-foreground md:px-8">
            <span>{clinicName}</span>
            <Badge variant="secondary" className="ml-2 align-middle font-normal">
              Hệ thống nội bộ
            </Badge>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

