'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('error')

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Route Error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-4 max-w-lg">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-destructive/10 blur-3xl rounded-full" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('title')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('heading')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('message')}
          </p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mt-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Error Details (Dev Only)
              </summary>
              <div className="mt-2 p-4 bg-muted rounded-lg text-xs font-mono overflow-auto max-h-40">
                <div className="text-destructive font-semibold mb-2">
                  {error.message}
                </div>
                {error.digest && (
                  <div className="text-muted-foreground mb-2">
                    Digest: {error.digest}
                  </div>
                )}
                {error.stack && (
                  <pre className="text-muted-foreground whitespace-pre-wrap break-words">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
          <Button onClick={reset} size="lg" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('retry')}
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              {t('backHome')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
