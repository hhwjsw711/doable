'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateProjectData, UpdateProjectData } from '@/lib/types'
import { UserSelector } from '@/components/shared/user-selector'
import { UserAvatar } from '@/components/shared/user-avatar'
import { 
  User, 
  X, 
  MoreHorizontal, 
  Settings, 
  Tag, 
  MoreVertical,
  ChevronRight,
  Calendar,
  ArrowRight,
  Target,
  Users,
  Gem,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations, useLocale } from 'next-intl'

// Create schema function that accepts translation function
const createProjectSchema = (t: any) => z.object({
  name: z.string().min(1, t('validation.nameRequired')).max(255, t('validation.nameTooLong')),
  description: z.string().optional(),
  key: z.string().min(1, t('validation.keyRequired')).max(10, t('validation.keyTooLong')).regex(/^[A-Z0-9]+$/, t('validation.keyFormat')),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, t('validation.invalidColor')),
  icon: z.string().optional(),
  leadId: z.string().optional(),
  status: z.enum(['active', 'completed', 'canceled']),
})

type ProjectFormData = z.infer<ReturnType<typeof createProjectSchema>>

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateProjectData | UpdateProjectData) => Promise<void>
  initialData?: Partial<ProjectFormData>
  title?: string
  description?: string
  teamId?: string
  projectId?: string
}

export function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
  teamId,
  projectId,
}: ProjectDialogProps) {
  const t = useTranslations('components.projectDialog');
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [targetDateOpen, setTargetDateOpen] = useState(false)
  
  // Milestone state
  const [milestones, setMilestones] = useState<Array<{ name: string; description: string; targetDate: Date | null }>>([])
  const [milestoneName, setMilestoneName] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneTargetDate, setMilestoneTargetDate] = useState<Date | null>(null)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  
  // Get lead name
  const [leadName, setLeadName] = useState<string>('')
  
  // Project members state
  const [projectMembers, setProjectMembers] = useState<Array<{
    id: string
    userId: string
    userName: string
    userEmail: string
    displayName: string
    email: string
    profileImageUrl?: string
  }>>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string
    userId: string
    displayName: string
    email: string
    profileImageUrl?: string
  }>>([])

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(createProjectSchema(t)),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      key: initialData?.key || '',
      color: initialData?.color || '#6366f1',
      icon: initialData?.icon || '',
      leadId: initialData?.leadId || '',
      status: initialData?.status || 'active',
    },
  })

  const currentLeadId = form.watch('leadId')
  const projectName = form.watch('name')

  useEffect(() => {
    if (open && initialData) {
      form.reset(initialData)
    } else if (open) {
      form.reset({
        name: '',
        description: '',
        key: '',
        color: '#6366f1',
        icon: '',
        leadId: '',
        status: 'active',
      })
      setMilestones([])
      setShowMilestoneForm(false)
    }
  }, [open, initialData, form])

  useEffect(() => {
    if (currentLeadId && teamId) {
      fetch(`/api/teams/${teamId}/members`)
        .then(res => res.json())
        .then(members => {
          const member = members.find((m: any) => m.userId === currentLeadId)
          setLeadName(member?.userName || '')
        })
        .catch(() => setLeadName(''))
    } else {
      setLeadName('')
    }
  }, [currentLeadId, teamId])

  // Fetch project members when editing
  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!open || !projectId || !teamId) {
        setProjectMembers([])
        return
      }

      try {
        setMembersLoading(true)
        const response = await fetch(`/api/teams/${teamId}/projects/${projectId}/members`)
        if (response.ok) {
          const members = await response.json()
          setProjectMembers(members)
        }
      } catch (error) {
        console.error('Error fetching project members:', error)
      } finally {
        setMembersLoading(false)
      }
    }

    fetchProjectMembers()
  }, [open, projectId, teamId])

  // Fetch team members for selection
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!teamId || !open) {
        return
      }

      try {
        const response = await fetch(`/api/teams/${teamId}/members`)
        if (response.ok) {
          const members = await response.json()
          setTeamMembers(members)
        }
      } catch (error) {
        console.error('Error fetching team members:', error)
      }
    }

    fetchTeamMembers()
  }, [teamId, open])

  const handleAddMember = async (userId: string) => {
    if (!projectId || !teamId) return

    try {
      const response = await fetch(`/api/teams/${teamId}/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        const newMember = await response.json()
        setProjectMembers([...projectMembers, newMember])
      } else {
        const error = await response.json()
        setError(error.error || t('errors.failedToAddMember'))
      }
    } catch (error) {
      console.error('Error adding member:', error)
      setError(t('errors.failedToAddMember'))
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!projectId || !teamId) return

    try {
      const response = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/members?memberId=${memberId}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        setProjectMembers(projectMembers.filter(m => m.id !== memberId))
      } else {
        const error = await response.json()
        setError(error.error || t('errors.failedToRemoveMember'))
      }
    } catch (error) {
      console.error('Error removing member:', error)
      setError(t('errors.failedToRemoveMember'))
    }
  }

  // Close calendar when clicking outside
  useEffect(() => {
    if (calendarOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.calendar-container') && !target.closest('.date-input')) {
          setCalendarOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [calendarOpen])

  const generateProjectKey = (name: string): string => {
    if (!name) return ''
    // Take first 3 uppercase letters/numbers from the name
    const cleaned = name.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    return cleaned.substring(0, 3) || t('defaultKeyPrefix')
  }

  const handleSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true)
    try {
      // Auto-generate key if not provided for new projects
      const projectKey = data.key || generateProjectKey(data.name)
      
      await onSubmit({
        ...data,
        key: projectKey,
        leadId: data.leadId || undefined,
        icon: data.icon || undefined,
      })
      form.reset()
      setMilestones([])
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddMilestone = () => {
    if (milestoneName.trim()) {
      setMilestones([...milestones, {
        name: milestoneName,
        description: milestoneDescription,
        targetDate: milestoneTargetDate
      }])
      setMilestoneName('')
      setMilestoneDescription('')
      setMilestoneTargetDate(null)
      setShowMilestoneForm(false)
    }
  }

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  // Calendar helpers
  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    // JavaScript getDay() returns 0-6 (Sunday-Saturday)
    // We want Monday=0, so adjust: (day + 6) % 7
    const day = new Date(year, month, 1).getDay()
    return (day + 6) % 7 // Convert Sunday=0 to Monday=0
  }

  // Get localized month and day names
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1))
  )
  const dayNames = Array.from({ length: 7 }, (_, i) => {
    // Start from Monday (i+1 because Sunday=0, Monday=1)
    const date = new Date(2000, 0, 3 + i) // Jan 3, 2000 was a Monday
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).slice(0, 2)
  })

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth)
    const days = []
    
    // Previous month days
    const prevMonthDays = getDaysInMonth(calendarYear, calendarMonth - 1)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: prevMonthDays - i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(calendarYear, calendarMonth, i)
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = milestoneTargetDate && 
        date.toDateString() === milestoneTargetDate.toDateString()
      days.push({
        date: i,
        isCurrentMonth: true,
        isToday,
        isSelected
      })
    }
    
    // Next month days to fill the grid
    const totalCells = Math.ceil(days.length / 7) * 7
    const remainingCells = totalCells - days.length
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }
    
    return days
  }

  const handleDateSelect = (day: number) => {
    const date = new Date(calendarYear, calendarMonth, day)
    setMilestoneTargetDate(date)
    setCalendarOpen(false)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 [&>button]:hidden max-h-[90vh] overflow-y-auto">
        {/* Custom Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {initialData ? t('editProject') : t('newProject')}
            </span>
            
            {/* Close Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col">
            <div className="flex-1 px-6 py-6 space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder={t('placeholders.name')} 
                          className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-0 bg-transparent w-full placeholder:text-foreground/60"
                          {...field}
                          autoFocus={!initialData}
                          value={field.value || ''}
                          onChange={(e) => {
                            field.onChange(e)
                          }}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder={t('placeholders.description')}
                          className="text-sm border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[60px] text-muted-foreground"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Project Key */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{t('placeholders.key')}</h3>
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => {
                    const autoGeneratedKey = projectName ? generateProjectKey(projectName) || t('defaultKeyPrefix') : t('defaultKeyPrefix')
                    return (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder={autoGeneratedKey}
                            className="text-sm font-mono border border-input bg-background px-3 py-2 h-9 rounded-md focus-visible:ring-1 focus-visible:ring-ring max-w-[120px]"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              // Convert to uppercase and filter invalid characters
                              const upperValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                              field.onChange(upperValue)
                            }}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          {t('keyHelperText')}
                        </p>
                      </FormItem>
                    )
                  }}
                />
              </div>

              {/* Property Buttons Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <div className="h-4 w-4 rounded-full border-2 border-dashed flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      </div>
                      <span>
                        {form.watch('status') === 'active' ? t('status.active') :
                         form.watch('status') === 'completed' ? t('status.completed') :
                         form.watch('status') === 'canceled' ? t('status.canceled') : t('status.backlog')}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem
                      onClick={() => form.setValue('status', 'active')}
                      className="flex items-center justify-between"
                    >
                      <span>{t('status.active')}</span>
                      {form.watch('status') === 'active' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => form.setValue('status', 'completed')}
                      className="flex items-center justify-between"
                    >
                      <span>{t('status.completed')}</span>
                      {form.watch('status') === 'completed' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => form.setValue('status', 'canceled')}
                      className="flex items-center justify-between"
                    >
                      <span>{t('status.canceled')}</span>
                      {form.watch('status') === 'canceled' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Lead Button */}
                <DropdownMenu open={leadOpen} onOpenChange={setLeadOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <User className="h-4 w-4" />
                      <span>{leadName || t('lead')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <FormField
                      control={form.control}
                      name="leadId"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <UserSelector
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value === 'unassigned' ? '' : value)
                                setLeadOpen(false)
                              }}
                              placeholder={t('placeholders.selectLead')}
                              teamId={teamId}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Members Button */}
                <DropdownMenu open={membersOpen} onOpenChange={setMembersOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <Users className="h-4 w-4" />
                      <span>
                        {projectMembers.length > 0 ? t('membersCount', { count: projectMembers.length }) : t('members')}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 p-2">
                    {!projectId ? (
                      <p className="text-sm text-muted-foreground px-2 py-1">
                        {t('saveFirstToAddMembers')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="px-2 py-1.5 border-b">
                          <p className="text-sm font-medium">{t('projectMembers')}</p>
                          <p className="text-xs text-muted-foreground">
                            {projectMembers.length} {projectMembers.length === 1 ? t('member') : t('membersPlural')}
                          </p>
                        </div>
                        {membersLoading ? (
                          <div className="px-2 py-4 text-center">
                            <p className="text-sm text-muted-foreground">{t('loadingMembers')}</p>
                          </div>
                        ) : (
                          <>
                            {projectMembers.length > 0 && (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {projectMembers.map((member) => (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 group"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <UserAvatar
                                        name={member.displayName}
                                        imageUrl={member.profileImageUrl}
                                        size="sm"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {member.displayName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {member.email}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleRemoveMember(member.id)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="px-2 pt-2 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {t('addTeamMember')}
                              </p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {teamMembers
                                  .filter(
                                    (tm) => !projectMembers.some((pm) => pm.userId === tm.userId)
                                  )
                                  .map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                      onClick={() => handleAddMember(member.userId)}
                                    >
                                      <UserAvatar
                                        name={member.displayName}
                                        imageUrl={member.profileImageUrl}
                                        size="sm"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {member.displayName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {member.email}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                {teamMembers.filter(
                                  (tm) => !projectMembers.some((pm) => pm.userId === tm.userId)
                                ).length === 0 && (
                                  <p className="text-xs text-muted-foreground px-2 py-1">
                                    {t('allMembersAdded')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Start Date Button */}
                <DropdownMenu open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>{t('startDate')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      {t('startDateComingSoon')}
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Target Date Button */}
                <DropdownMenu open={targetDateOpen} onOpenChange={setTargetDateOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <Target className="h-4 w-4" />
                      <span>{t('targetDate')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      {t('targetDateComingSoon')}
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Labels Button */}
                <DropdownMenu open={labelsOpen} onOpenChange={setLabelsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2">
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      {t('labelsComingSoon')}
                    </p>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>



              {/* Milestones Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{t('createMilestone')}</h3>
                </div>

                {milestones.length > 0 && (
                  <div className="space-y-2">
                    {milestones.map((milestone, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                        <Gem className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{milestone.name}</div>
                          {milestone.description && (
                            <div className="text-xs text-muted-foreground">{milestone.description}</div>
                          )}
                          {milestone.targetDate && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('target')}: {formatDate(milestone.targetDate)}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveMilestone(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showMilestoneForm ? (
                  <div className="space-y-4 p-4 border rounded-md bg-muted/30 relative">
                    <div className="flex items-center gap-3">
                      <Gem className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder={t('placeholders.milestoneName')}
                        value={milestoneName}
                        onChange={(e) => setMilestoneName(e.target.value)}
                        className="flex-1"
                      />
                    </div>

                    <Textarea
                      placeholder={t('placeholders.milestoneDescription')}
                      value={milestoneDescription}
                      onChange={(e) => setMilestoneDescription(e.target.value)}
                      className="resize-none min-h-[80px]"
                    />

                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Input
                          placeholder={t('placeholders.targetDate')}
                          value={formatDate(milestoneTargetDate)}
                          readOnly
                          onClick={() => setCalendarOpen(!calendarOpen)}
                          className="cursor-pointer date-input"
                        />
                        {calendarOpen && (
                          <div 
                            className="calendar-container absolute z-50 top-full left-0 mt-1 bg-popover border rounded-md shadow-lg p-4 w-64"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  if (calendarMonth === 0) {
                                    setCalendarYear(calendarYear - 1)
                                    setCalendarMonth(11)
                                  } else {
                                    setCalendarMonth(calendarMonth - 1)
                                  }
                                }}
                              >
                                <ChevronRight className="h-4 w-4 rotate-180" />
                              </Button>
                              <span className="font-medium text-sm">
                                {monthNames[calendarMonth]} {calendarYear}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  if (calendarMonth === 11) {
                                    setCalendarYear(calendarYear + 1)
                                    setCalendarMonth(0)
                                  } else {
                                    setCalendarMonth(calendarMonth + 1)
                                  }
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                              {dayNames.map((day) => (
                                <div key={day} className="text-xs text-muted-foreground text-center py-1">
                                  {day}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {renderCalendar().map((day, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => day.isCurrentMonth && handleDateSelect(day.date)}
                                  className={cn(
                                    "h-8 w-8 rounded text-xs hover:bg-muted transition-colors",
                                    !day.isCurrentMonth && "text-muted-foreground/40",
                                    day.isToday && "bg-primary/10 text-primary font-medium",
                                    day.isSelected && "bg-primary text-primary-foreground"
                                  )}
                                  disabled={!day.isCurrentMonth}
                                >
                                  {day.date}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowMilestoneForm(false)
                            setMilestoneName('')
                            setMilestoneDescription('')
                            setMilestoneTargetDate(null)
                          }}
                        >
                          {t('actions.cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddMilestone}
                          disabled={!milestoneName.trim()}
                        >
                          {t('addMilestone')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowMilestoneForm(true)}
                  >
                    <Gem className="h-4 w-4 mr-2" />
                    {t('addMilestone')}
                  </Button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t space-y-3">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    onOpenChange(false)
                  }}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting
                    ? (initialData ? t('actions.updating') : t('actions.creating'))
                    : (initialData ? t('actions.updateProject') : t('actions.createProject'))
                  }
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
