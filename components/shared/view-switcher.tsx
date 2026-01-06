'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { List, Columns, Table } from 'lucide-react'
import { ViewType } from '@/lib/types'
import { useTranslations } from 'next-intl'

interface ViewSwitcherProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  views?: ViewType[]
  className?: string
}

export function ViewSwitcher({ currentView, onViewChange, views, className }: ViewSwitcherProps) {
  const t = useTranslations('components.viewSwitcher');

  const viewConfig = {
    list: {
      label: t('list'),
      icon: List,
      description: t('listView')
    },
    board: {
      label: t('board'),
      icon: Columns,
      description: t('kanbanBoard')
    },
    table: {
      label: t('table'),
      icon: Table,
      description: t('tableView')
    }
  }

  const availableViews = views || Object.keys(viewConfig) as ViewType[]
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {availableViews.map((view) => {
        const config = viewConfig[view]
        const Icon = config.icon
        const isActive = currentView === view
        
        return (
          <Button
            key={view}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(view)}
            className={cn(
              'flex items-center gap-2',
              isActive && 'bg-primary text-primary-foreground'
            )}
            title={config.description}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{config.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
