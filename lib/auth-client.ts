"use client"

import { createAuthClient } from "better-auth/react"
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins"

// Get the base URL for the client
const getBaseURL = () => {
  // In the browser, use the current origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  // Fallback to environment variable
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
  ],
})

export type Session = typeof authClient.$Infer.Session

// Export specific methods for easier use
export const { signIn, signUp, signOut, useSession } = authClient

