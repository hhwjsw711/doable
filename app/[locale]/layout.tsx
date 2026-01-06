import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Provider } from "../provider";
import { HydrationBoundary } from "@/components/hydration-boundary";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = "https://thegroupfinder.com";
  const localePrefix = locale === 'en' ? '/en' : '/zh';

  return {
    title: t('title'),
    description: t('description'),
    keywords: t('keywords').split(', '),
    authors: [{ name: "Kartik Labhshetwar" }],
    creator: "Kartik Labhshetwar",
    publisher: "Kartik Labhshetwar",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      url: `${baseUrl}${localePrefix}`,
      siteName: t('openGraph.siteName'),
      title: t('openGraph.title'),
      description: t('openGraph.description'),
      images: [
        {
          url: "/open-graph.png",
          width: 1200,
          height: 630,
          alt: t('openGraph.imageAlt'),
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@hhwjsw711",
      creator: "@hhwjsw711",
      title: t('twitter.title'),
      description: t('twitter.description'),
      images: ["/open-graph.png"],
    },
    alternates: {
      canonical: `${baseUrl}${localePrefix}`,
      languages: {
        'en': `${baseUrl}/en`,
        'zh': `${baseUrl}/zh`,
      },
    },
    category: "productivity",
  };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="google-site-verification" content="Tt-T3oOKSZ7mMbdBRswKjFzxP2Okmgt4sSHK9BXt8jo" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="158d23fd-3fec-46cb-a533-9f1136de3fe7"></script>
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <ErrorBoundaryWrapper>
            <HydrationBoundary>
              <Provider>{children}</Provider>
            </HydrationBoundary>
          </ErrorBoundaryWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
