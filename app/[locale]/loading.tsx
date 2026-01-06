'use client'

import { Spinner } from '@/components/ui/spinner'
import { useTranslations } from 'next-intl'

export default function Loading() {
  const t = useTranslations('loading')

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-6">
        <Spinner size="lg" />
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('message')}</p>
        </div>
      </div>
    </div>
  )
}
