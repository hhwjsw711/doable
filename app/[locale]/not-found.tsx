'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { FileQuestion, Home, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  const t = useTranslations('notFound')

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-6 text-center px-4 max-w-lg">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
          <FileQuestion className="relative h-24 w-24 text-muted-foreground/70" />
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('title')}
            </div>
            <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              404
            </h1>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">
            {t('heading')}
          </h2>
          <p className="text-muted-foreground">
            {t('message')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              {t('backHome')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              {t('backDashboard')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
