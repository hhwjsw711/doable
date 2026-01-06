'use client'

import { cn } from '@/lib/utils'
import { PriorityLevel, PRIORITY_LEVELS } from '@/lib/types'
import { AlertTriangle, ChevronUp, Minus, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { translatePriority } from '@/lib/i18n/translate-priority'

interface PriorityIconProps {
  priority: PriorityLevel
  className?: string
  showLabel?: boolean
}

const priorityIcons = {
  none: Minus,
  low: ChevronUp,
  medium: ChevronUp,
  high: AlertTriangle,
  urgent: Zap,
}

export function PriorityIcon({ priority, className, showLabel = false }: PriorityIconProps) {
  const Icon = priorityIcons[priority]
  const config = PRIORITY_LEVELS[priority]
  const tCommon = useTranslations()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Icon
        className="h-4 w-4"
        style={{ color: config.color }}
      />
      {showLabel && (
        <span
          className="text-xs font-medium"
          style={{ color: config.color }}
        >
          {translatePriority(config.label, tCommon)}
        </span>
      )}
    </div>
  )
}
