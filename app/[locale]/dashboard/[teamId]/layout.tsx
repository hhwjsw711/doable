"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import IconSquareChartLine from "@/components/ui/IconSquareChartLine";
import IconMsgs from "@/components/ui/IconMsgs";
import IconUsers from "@/components/ui/IconUsers";
import IconFiles from "@/components/ui/IconFiles";
import IconDocFolder from "@/components/ui/IconDocFolder";
import { authClient } from "@/lib/auth-client";
import { useParams, useRouter, usePathname } from "next/navigation";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { WorkspaceSelector } from "@/components/shared/workspace-selector";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatbot } from "@/components/ai/ai-chatbot";
import { useTranslations } from "next-intl";

function useSegment(basePath: string) {
  const path = usePathname();
  const result = path.slice(basePath.length, path.length);
  return result ? result : "/";
}

type NavigationItem = {
  nameKey: string; // 翻译键
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  type: "item" | "label";
  action?: () => void;
};

const navigationItems: NavigationItem[] = [
  {
    nameKey: "issues",
    href: "/issues",
    icon: IconFiles,
    type: "item",
  },
  {
    nameKey: "projects",
    href: "/projects",
    icon: IconDocFolder,
    type: "item",
  },
  {
    type: "label",
    nameKey: "management",
  },
  {
    nameKey: "management",
    href: "/management",
    icon: IconSquareChartLine,
    type: "item",
  },
  {
    nameKey: "people",
    href: "/people",
    icon: IconUsers,
    type: "item",
  },
];

function HeaderBreadcrumb({
  items,
  baseBreadcrumb,
  basePath,
  t,
}: {
  items: NavigationItem[];
  baseBreadcrumb?: { title: string; href: string }[];
  basePath: string;
  t: any;
}) {
  const segment = useSegment(basePath);
  const item = items.find(
    (item) => item.type === "item" && item.href === segment,
  );
  const title: string | undefined = item ? t(item.nameKey) : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {baseBreadcrumb
          ?.map((item, index) => [
            <BreadcrumbItem key={`item-${index}`}>
              <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
            </BreadcrumbItem>,
            <BreadcrumbSeparator key={`separator-${index}`} />,
          ])
          .flat()}
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function AppSidebar({
  items,
  basePath,
  sidebarTop,
  t,
}: {
  items: NavigationItem[];
  basePath: string;
  sidebarTop?: React.ReactNode;
  t: any;
}) {
  const segment = useSegment(basePath);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        {sidebarTop}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, index) => {
                if (item.type === "label") {
                  return (
                    <SidebarGroupLabel key={`label-${index}`} className="px-2">
                      {t(item.nameKey)}
                    </SidebarGroupLabel>
                  );
                }

                const isActive = item.href ? segment === item.href : false;

                if (item.action && !item.href) {
                  // Action item (no href)
                  return (
                    <SidebarMenuItem key={`item-${index}`}>
                      <SidebarMenuButton
                        onClick={item.action}
                        isActive={false}
                        tooltip={t(item.nameKey)}
                      >
                        {item.icon && <item.icon />}
                        <span>{t(item.nameKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Navigation item with href
                return (
                  <SidebarMenuItem key={`item-${index}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.nameKey)}
                    >
                      <Link href={basePath + (item.href || "")}>
                        {item.icon && <item.icon />}
                        <span>{t(item.nameKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function Layout(props: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const params = useParams<{ teamId: string }>();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Fetch team data
    const fetchTeam = async () => {
      try {
        const response = await fetch("/api/teams");
        if (response.ok) {
          const teams = await response.json();
          const currentTeam = teams.find((t: any) => t.id === params.teamId);
          if (currentTeam) {
            setTeam(currentTeam);
            setLoading(false);
          } else {
            // If team not found, redirect to dashboard immediately
            setIsRedirecting(true);
            setLoading(false);
            router.replace("/dashboard");
            return; // Exit early to prevent rendering
          }
        } else {
          // If response not ok, redirect to dashboard
          setIsRedirecting(true);
          setLoading(false);
          router.replace("/dashboard");
        }
      } catch (error) {
        console.error("Error fetching team:", error);
        setLoading(false);
        setIsRedirecting(true);
        // Redirect to dashboard on error
        router.replace("/dashboard");
      }
    };
    fetchTeam();
  }, [params.teamId, router]);

  // Detect if user is on Mac
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Add Cmd+K (Mac) or Ctrl+K (Windows/Linux) shortcut to open chatbot
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        // Don't trigger if user is typing in an input, textarea, or contenteditable
        const target = event.target as HTMLElement;
        const isInputElement =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInputElement) {
          event.preventDefault();
          setChatbotOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/sign-in";
  };

  // Don't render anything if redirecting
  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <DashboardLoader message={t('redirecting')} submessage={t('teamNotFound')} />
      </div>
    );
  }

  // Show loading while team is being fetched
  if (loading || !team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <DashboardLoader
          message={t('loadingTeam')}
          submessage={t('fetchingTeamData')}
        />
      </div>
    );
  }

  const basePath = `/dashboard/${team.id}`;
  const baseBreadcrumb = [
    {
      title: team.displayName || team.name,
      href: basePath,
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        items={navigationItems}
        basePath={basePath}
        t={t}
        sidebarTop={
          <WorkspaceSelector
            currentTeamId={team.id}
            currentTeamName={team.name}
          />
        }
      />
      <SidebarInset className="overflow-x-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10">
          <div className="flex items-center justify-between h-full px-6">
            {/* Left side - Sidebar trigger + Breadcrumb */}
            <div className="flex items-center space-x-4">
              <SidebarTrigger />
              <HeaderBreadcrumb
                baseBreadcrumb={baseBreadcrumb}
                basePath={basePath}
                items={navigationItems}
                t={t}
              />
            </div>

            {/* Right side - Chatbot Button + Language Switcher + User Button */}
            <div className="flex items-center gap-2">
              {session?.user && (
                <>
                  {/* AI Chatbot Button */}
                  <div className="border border-border/80 rounded-md p-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setChatbotOpen(true)}
                        className="relative"
                        title={`${t('openDoableAI')} (${isMac ? "⌘" : "Ctrl"}+K)`}
                      >
                        <IconMsgs className="h-8 w-8" />
                      </Button>
                      <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-border/50 bg-muted/50 px-2 font-mono text-[11px] font-medium text-muted-foreground opacity-100 whitespace-nowrap shadow-sm">
                        <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>K
                      </kbd>
                    </div>
                  </div>

                  {/* Language Switcher */}
                  <LanguageSwitcher />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-10 w-10 rounded-full"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={session.user.image || undefined}
                            alt={session.user.name || ""}
                          />
                          <AvatarFallback>
                            {session.user.name?.charAt(0)?.toUpperCase() ||
                              session.user.email?.charAt(0)?.toUpperCase() ||
                              "U"}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56"
                      align="end"
                      forceMount
                    >
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {session.user.name || "User"}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {session.user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{t('signOut')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-background">
          <div className="px-6 py-6 h-full overflow-auto">{props.children}</div>
        </main>
      </SidebarInset>

      {/* AI Chatbot Sheet */}
      <Sheet open={chatbotOpen} onOpenChange={setChatbotOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {team?.id && <AIChatbot teamId={team.id} />}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
