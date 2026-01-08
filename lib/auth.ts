import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { db } from "./db"
import { emailOTP, twoFactor } from "better-auth/plugins"
import { sendOTPEmail } from "./email"

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  // Social OAuth providers (Google and GitHub)
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: { 
        clientId: process.env.GOOGLE_CLIENT_ID, 
        clientSecret: process.env.GOOGLE_CLIENT_SECRET, 
      }, 
    } : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      github: { 
        clientId: process.env.GITHUB_CLIENT_ID, 
        clientSecret: process.env.GITHUB_CLIENT_SECRET, 
      }, 
    } : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 1000, // 1 hour
    },
  },
  trustedOrigins: async () => {
    const origins = [
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "https://thegroupfinder.com", // Production domain
    ].filter(Boolean) as string[]
    return origins
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp, type }) {
        // Log in development
        if (process.env.NODE_ENV === "development") {
          console.log("📧 OTP verification email sent to", email, "with code", otp);
        }

        // Try to get locale from Next.js cookies
        let locale = 'zh' // Default to Chinese
        try {
          const { cookies } = await import('next/headers')
          const cookieStore = await cookies()
          const localeCookie = cookieStore.get('NEXT_LOCALE')
          if (localeCookie && ['en', 'zh'].includes(localeCookie.value)) {
            locale = localeCookie.value
          }
        } catch (error) {
          console.log('[sendVerificationOTP] Could not read locale from cookies, using default:', locale)
        }

        console.log('[sendVerificationOTP] Sending OTP email with locale:', locale)

        // Send OTP email with locale
        await sendOTPEmail({
          email,
          otp,
          type: type as 'sign-in' | 'email-verification',
          locale,
        });
      },
    }),
    twoFactor(),
    nextCookies(), // Must be last plugin
  ],
})
 
export type Session = typeof auth.$Infer.Session

// Session helpers for server-side
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then(m => m.headers())
  })
  return session?.user?.id
}

export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then(m => m.headers())
  })
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  
  return session.user.id
}

export async function currentUser() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then(m => m.headers())
  })
  return session?.user || null
}

// For backwards compatibility with existing code
export async function getAuthHeaders() {
  return {}
}
