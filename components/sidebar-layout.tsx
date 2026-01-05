"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, Menu, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { LogOut, User, Brain } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { AIChatbot } from "./ai/ai-chatbot";

function useSegment(basePath: string) {
  const path = usePathname();
  const result = path.slice(basePath.length, path.length);
  return result ? result : "/";
}

type Item = {
  name: React.ReactNode;
  href?: string;
  icon: LucideIcon;
  type: "item";
  action?: () => void;
};

type Sep = {
  type: "separator";
};

type Label = {
  name: React.ReactNode;
  type: "label";
};

export type SidebarItem = Item | Sep | Label;

function NavItem(props: {
  item: Item;
  onClick?: () => void;
  basePath: string;
  onItemAction?: (action: () => void) => void;
}) {
  const segment = useSegment(props.basePath);
  const selected = props.item.href ? segment === props.item.href : false;

  // If it's an action item (no href), render as button
  if (props.item.action && !props.item.href) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          if (props.item.action) {
            const action = props.item.action;
            action();
            props.onItemAction?.(action);
          }
        }}
        className={cn(
          "group relative flex items-center w-full px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out rounded-lg",
          "hover:bg-secondary/40 text-left",
          "text-muted-foreground hover:text-foreground",
          "focus:outline-none focus-visible:outline-none"
        )}
      >
        <props.item.icon className={cn(
          "mr-3 h-5 w-5 transition-colors duration-200",
          "text-muted-foreground group-hover:text-foreground"
        )} />
        <span className="truncate">{props.item.name}</span>
      </button>
    );
  }

  return (
    <Link
      href={props.basePath + (props.item.href || '')}
      className={cn(
        "group relative flex items-center w-full px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out rounded-lg",
        "hover:bg-secondary/40",
        selected 
          ? "bg-primary text-primary-foreground shadow-lg" 
          : "text-muted-foreground hover:text-foreground",
        "focus:outline-none focus-visible:outline-none"
      )}
      onClick={props.onClick}
      prefetch={true}
    >
      <props.item.icon className={cn(
        "mr-3 h-5 w-5 transition-colors duration-200",
        selected ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span className="truncate">{props.item.name}</span>
    </Link>
  );
}

function SidebarContent(props: {
  onNavigate?: () => void;
  items: SidebarItem[];
  sidebarTop?: React.ReactNode;
  basePath: string;
  onItemAction?: (action: () => void) => void;
}) {
  const path = usePathname();
  const segment = useSegment(props.basePath);

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/50">
      {/* Header */}
      <div className="h-16 flex items-center px-6 shrink-0 border-b border-border/50">
        {props.sidebarTop}
      </div>
      
      {/* Navigation */}
      <div className="flex-1 flex flex-col py-6 overflow-y-auto">
        <div className="px-4">
          {props.items.map((item, index) => {
            if (item.type === "separator") {
              return <Separator key={index} className="my-3" />;
            } else if (item.type === "item") {
              return (
                <div key={index} className="mb-1.5">
                  <NavItem
                    item={item}
                    onClick={props.onNavigate}
                    basePath={props.basePath}
                    onItemAction={props.onItemAction}
                  />
                </div>
              );
            } else {
              return (
                <div key={index} className="px-2 py-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.name}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* GitHub Button Footer */}
      <div className="px-4 py-4 border-t border-border/50 shrink-0">
        <Link
          href="https://github.com/kartiklabhshetwar/doable"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50"
        >
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Proudly Open Source</span>
        </Link>
      </div>
    </div>
  );
}

export type HeaderBreadcrumbItem = { title: string; href: string };

function HeaderBreadcrumb(props: { items: SidebarItem[], baseBreadcrumb?: HeaderBreadcrumbItem[], basePath: string }) {
  const segment = useSegment(props.basePath);
  console.log(segment)
  const item = props.items.find((item) => item.type === 'item' && item.href === segment);
  const title: string | undefined = (item as any)?.name

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {props.baseBreadcrumb?.map((item, index) => [
          <BreadcrumbItem key={`item-${index}`}>
            <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
          </BreadcrumbItem>,
          <BreadcrumbSeparator key={`separator-${index}`} />
        ]).flat()}

        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function SidebarLayout(props: {
  children?: React.ReactNode;
  baseBreadcrumb?: HeaderBreadcrumbItem[];
  items: SidebarItem[];
  sidebarTop?: React.ReactNode;
  basePath: string;
  teamId?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  
  const { data: session } = authClient.useSession();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/sign-in'
  }

  return (
    <div className="w-full flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col h-screen sticky top-0 z-20 transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        <SidebarContent 
          items={props.items} 
          sidebarTop={props.sidebarTop} 
          basePath={props.basePath}
          onItemAction={(action) => action()}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10">
          <div className="flex items-center justify-between h-full px-6">
            {/* Left side - Mobile menu + Breadcrumb */}
            <div className="flex items-center space-x-4">
              {/* Desktop Sidebar Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:inline-flex"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle sidebar</span>
              </Button>

              {/* Mobile Menu */}
              <div className="md:hidden">
                <Sheet
                  onOpenChange={(open) => setSidebarOpen(open)}
                  open={sidebarOpen}
                >
                  <SheetTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle menu</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <SidebarContent
                      onNavigate={() => setSidebarOpen(false)}
                      items={props.items}
                      sidebarTop={props.sidebarTop}
                      basePath={props.basePath}
                    />
                  </SheetContent>
                </Sheet>
              </div>

              {/* Breadcrumb */}
              <HeaderBreadcrumb 
                baseBreadcrumb={props.baseBreadcrumb} 
                basePath={props.basePath} 
                items={props.items} 
              />
            </div>

            {/* Right side - Chatbot Button + User Button */}
            <div className="flex items-center gap-2">
              {session?.user && (
                <>
                  {/* AI Chatbot Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChatbotOpen(true)}
                    className="relative"
                    title="Open Doable AI"
                  >
                    <Brain className="h-5 w-5" />
                  </Button>

                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={session.user.image || undefined} alt={session.user.name || ""} />
                        <AvatarFallback>
                          {session.user.name?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{session.user.name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {session.user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
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
          <div className="px-6 py-6 h-full overflow-auto">
            {props.children}
          </div>
        </main>
      </div>

      {/* AI Chatbot Sheet */}
      <Sheet open={chatbotOpen} onOpenChange={setChatbotOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {props.teamId && <AIChatbot teamId={props.teamId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
