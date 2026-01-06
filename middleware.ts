import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Create the i18n middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Handle i18n routing first
    const response = intlMiddleware(request);

    // Extract locale from pathname (format: /en/... or /zh/...)
    const pathnameLocale = pathname.split('/')[1];
    const locale = routing.locales.includes(pathnameLocale as any)
      ? pathnameLocale
      : routing.defaultLocale;

    // Remove locale prefix for auth checks
    const pathnameWithoutLocale = pathname.replace(`/${locale}`, '') || '/';

    // Always allow access to sign-up and sign-in pages - let them handle their own logic
    if (["/sign-in", "/sign-up"].includes(pathnameWithoutLocale)) {
      return response;
    }

    // Check for session cookie - Better Auth uses "better-auth.session_token" by default
    let hasSession = false;
    try {
      // Try the Better Auth helper first
      const sessionCookie = getSessionCookie(request);
      hasSession = !!sessionCookie;
    } catch (error) {
      // Fallback: check for Better Auth cookie directly
      const cookies = request.cookies;
      // Check common Better Auth cookie names
      hasSession = cookies.has("better-auth.session_token") ||
                   cookies.has("better-auth.session");
    }

    // For dashboard routes: redirect unauthenticated users to sign-up
    if (pathnameWithoutLocale.startsWith("/dashboard")) {
      if (!hasSession) {
        const signUpUrl = new URL(`/${locale}/sign-up`, request.url);
        // Preserve the original path as a redirect parameter if needed
        if (pathnameWithoutLocale !== "/dashboard") {
          signUpUrl.searchParams.set("redirect", pathnameWithoutLocale);
        }
        return NextResponse.redirect(signUpUrl);
      }
    }

    return response;
  } catch (error) {
    // If there's an error, allow access to auth pages but redirect dashboard to sign-up
    const { pathname } = request.nextUrl;
    const pathnameLocale = pathname.split('/')[1];
    const locale = routing.locales.includes(pathnameLocale as any)
      ? pathnameLocale
      : routing.defaultLocale;
    const pathnameWithoutLocale = pathname.replace(`/${locale}`, '') || '/';

    if (pathnameWithoutLocale.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL(`/${locale}/sign-up`, request.url));
    }
    // Allow other pages to continue
    return NextResponse.next();
  }
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
