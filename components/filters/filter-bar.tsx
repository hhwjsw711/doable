'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Filter, X, Check, Tag } from 'lucide-react'
import { IssueFilters } from '@/lib/types'
import { Project, WorkflowState, Label } from '@prisma/client'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { translateWorkflowState } from '@/lib/i18n/translate-workflow-state'
import { translateLabel } from '@/lib/i18n/translate-label'

interface FilterBarProps {
  filters: IssueFilters
  onFiltersChange: (filters: IssueFilters) => void
  projects: Project[]
  workflowStates: WorkflowState[]
  labels: Label[]
  className?: string
}

export function FilterBar({
  filters,
  onFiltersChange,
  projects,
  workflowStates,
  labels,
  className
}: FilterBarProps) {
  const t = useTranslations('components.filterBar')
  const tCommon = useTranslations()
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = (key: keyof IssueFilters, value: string[]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilter = (key: keyof IssueFilters) => {
    onFiltersChange({
      ...filters,
      [key]: []
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      assignee: [],
      project: [],
      label: [],
      priority: [],
      search: undefined,
    })
  }

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => 
      Array.isArray(value) ? value.length > 0 : value !== undefined
    ).length
  }

  const hasActiveFilters = getActiveFilterCount() > 0

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            {t('filters')}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{t('filterByStatus')}</DropdownMenuLabel>
          {workflowStates.map((state) => (
            <DropdownMenuCheckboxItem
              key={state.id}
              checked={filters.status?.includes(state.id) || false}
              onCheckedChange={(checked) => {
                const currentStatuses = filters.status || []
                const newStatuses = checked
                  ? [...currentStatuses, state.id]
                  : currentStatuses.filter(id => id !== state.id)
                updateFilter('status', newStatuses)
              }}
            >
              {translateWorkflowState(state.name, tCommon)}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('filterByProject')}</DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuCheckboxItem
              key={project.id}
              checked={filters.project?.includes(project.id) || false}
              onCheckedChange={(checked) => {
                const currentProjects = filters.project || []
                const newProjects = checked
                  ? [...currentProjects, project.id]
                  : currentProjects.filter(id => id !== project.id)
                updateFilter('project', newProjects)
              }}
            >
              {project.name}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('filterByPriority')}</DropdownMenuLabel>
          {[
            { value: 'none', label: t('priorities.none') },
            { value: 'low', label: t('priorities.low') },
            { value: 'medium', label: t('priorities.medium') },
            { value: 'high', label: t('priorities.high') },
            { value: 'urgent', label: t('priorities.urgent') },
          ].map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority.value}
              checked={filters.priority?.includes(priority.value) || false}
              onCheckedChange={(checked) => {
                const currentPriorities = filters.priority || []
                const newPriorities = checked
                  ? [...currentPriorities, priority.value]
                  : currentPriorities.filter(p => p !== priority.value)
                updateFilter('priority', newPriorities)
              }}
            >
              {priority.label}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('filterByLabels')}
            {filters.label && filters.label.length > 0 && (
              <span className="ml-auto h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                {filters.label.length}
              </span>
            )}
          </DropdownMenuLabel>
          {labels.map((label) => {
            const isSelected = filters.label?.includes(label.id) || false
            return (
              <DropdownMenuCheckboxItem
                key={label.id}
                checked={isSelected}
                onCheckedChange={(checked) => {
                  const currentLabels = filters.label || []
                  const newLabels = checked
                    ? [...currentLabels, label.id]
                    : currentLabels.filter(id => id !== label.id)
                  updateFilter('label', newLabels)
                }}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  isSelected && "bg-primary/10"
                )}
              >
                <div 
                  className={cn(
                    "h-3 w-3 rounded-full",
                    isSelected && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: label.color }}
                />
                <span className={cn(
                  "flex-1",
                  isSelected && "font-medium"
                )}>{translateLabel(label.name, tCommon)}</span>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary font-bold" />
                )}
              </DropdownMenuCheckboxItem>
            )
          })}

          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={clearAllFilters}
                className="text-red-600 focus:text-red-600"
              >
                {t('clearAllFilters')}
              </DropdownMenuCheckboxItem>
            </>
          )}
          </DropdownMenuContent>
        </DropdownMenu>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <>
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {filters.status?.map((statusId) => {
              const state = workflowStates.find(s => s.id === statusId)
              return state ? (
                <Badge key={statusId} variant="secondary" className="text-xs">
                  {translateWorkflowState(state.name, tCommon)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => clearFilter('status')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ) : null
            })}
            
            {filters.project?.map((projectId) => {
              const project = projects.find(p => p.id === projectId)
              return project ? (
                <Badge key={projectId} variant="secondary" className="text-xs">
                  {project.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => clearFilter('project')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ) : null
            })}

            {filters.priority?.map((priority) => (
              <Badge key={priority} variant="secondary" className="text-xs">
                {t(`priorities.${priority}`)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => clearFilter('priority')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {filters.label?.map((labelId) => {
              const label = labels.find(l => l.id === labelId)
              return label ? (
                <Badge key={labelId} variant="secondary" className="text-xs">
                  {translateLabel(label.name, tCommon)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => clearFilter('label')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ) : null
            })}
          </div>

          {/* Clear Filters Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Filter className="h-4 w-4 mr-2" />
            {t('clear')}
          </Button>
        </>
      )}
    </div>
  )
}
