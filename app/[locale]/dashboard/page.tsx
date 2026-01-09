import { PageClient } from "./page-client";
import { getTranslations } from "next-intl/server";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: `${t('title')} - FizzProject`,
  };
}

export default function Dashboard() {
  return <PageClient />;
}
