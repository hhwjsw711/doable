'use client'

import { cn } from '@/lib/utils'
import { Label } from '@prisma/client'
import { useTranslations } from 'next-intl'
import { translateLabel } from '@/lib/i18n/translate-label'

interface LabelBadgeProps {
  label: Label
  className?: string
  onClick?: () => void
}

export function LabelBadge({ label, className, onClick }: LabelBadgeProps) {
  const tCommon = useTranslations()

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-colors hover:opacity-80',
        onClick && 'hover:bg-gray-100 dark:hover:bg-gray-800',
        className
      )}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        borderColor: `${label.color}40`
      }}
      onClick={onClick}
    >
      {translateLabel(label.name, tCommon)}
    </span>
  )
}
