"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { TeamSelector } from "@/components/shared/team-selector";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";

export function PageClient() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const hasRedirected = useRef(false);

  // Redirect to sign-up if no session after loading
  useEffect(() => {
    if (!isPending && !session && !hasRedirected.current) {
      hasRedirected.current = true;
      // Use replace instead of push to avoid adding to history
      router.replace("/sign-in");
    }
  }, [isPending, session, router]);

  // Fallback: force redirect if useEffect didn't trigger within 200ms
  useEffect(() => {
    if (!isPending && !session) {
      const timer = setTimeout(() => {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          window.location.href = "/sign-in";
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isPending, session]);

  // If loading, show loader
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <DashboardLoader message={t('loadingTeams')} submessage={t('settingUpWorkspace')} />
      </div>
    );
  }

  // If no session, show redirecting message
  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <DashboardLoader message={t('redirecting')} submessage={t('signInToContinue')} />
      </div>
    );
  }

  // User is authenticated, show team selector
  return <TeamSelector />;
}