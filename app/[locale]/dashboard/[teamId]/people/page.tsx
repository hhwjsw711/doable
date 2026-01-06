'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTeamMembers, useTeamInvitations } from '@/lib/hooks/use-team-data'
import { authClient } from '@/lib/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Mail, Trash2, ChevronDown } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import IconUsers from '@/components/ui/IconUsers'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface TeamMember {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
  createdAt: string
}

interface CurrentUser {
  userId: string
  role: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}

export default function PeoplePage() {
  const t = useTranslations('people');
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()

  // Use TanStack Query hooks
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId)
  const { data: invitations = [], isLoading: invitationsLoading } = useTeamInvitations(teamId)
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('developer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)

  const loading = membersLoading || invitationsLoading

  // Get current user's role from session and members
  useEffect(() => {
    if (members.length > 0 && session?.user?.id) {
      const currentUserMember = members.find((m: TeamMember) => 
        m.userId === session.user.id
      )
      
      if (currentUserMember) {
        setCurrentUser({
          userId: currentUserMember.userId,
          role: currentUserMember.role,
        })
      } else {
        // Fallback: if we can't find current user via session, 
        // check if ANY member is admin and assume first admin is current user
        const adminMember = members.find((m: TeamMember) => m.role === 'admin')
        if (adminMember) {
          setCurrentUser({
            userId: adminMember.userId,
            role: adminMember.role,
          })
        }
      }
    }
  }, [members, session])

  // Add event listener to refresh people when chatbot invites team members
  useEffect(() => {
    // This will be handled by query invalidation, but we keep the event listener for compatibility
    const handleRefresh = () => {
      // Queries will automatically refetch when invalidated
    }

    window.addEventListener('refresh-people', handleRefresh)
    
    return () => {
      window.removeEventListener('refresh-people', handleRefresh)
    }
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        setInviteEmail('')
        setInviteRole('developer')
        setInviteDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: ['invitations', teamId] })
        toast.success(t('invitationSentSuccess'), {
          description: t('invitationSentTo', { email: inviteEmail }),
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || t('invitationSentFailed'))
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      toast.error(t('invitationSentFailed'), {
        description: error.message || t('cancel'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations/${invitationId}/resend`, {
        method: 'POST',
      })

      if (response.ok) {
        toast.success(t('invitationResentSuccess'))
      } else {
        throw new Error(t('invitationResentFailed'))
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
      toast.error(t('invitationResentFailed'), {
        description: t('cancel'),
      })
    }
  }

  const handleRemoveInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['invitations', teamId] })
        toast.success(t('invitationRemovedSuccess'))
      } else {
        throw new Error(t('invitationRemovedFailed'))
      }
    } catch (error) {
      console.error('Error removing invitation:', error)
      toast.error(t('invitationRemovedFailed'), {
        description: t('cancel'),
      })
    }
  }

  const handleRemoveMember = () => {
    if (!memberToRemove) return
    
    const executeRemove = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}/members?memberId=${memberToRemove.id}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setRemoveDialogOpen(false)
          setMemberToRemove(null)
          queryClient.invalidateQueries({ queryKey: ['members', teamId] })
          toast.success(t('memberRemovedSuccess'), {
            description: t('memberRemovedFrom', { name: memberToRemove.name }),
          })
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || t('memberRemovedFailed'))
        }
      } catch (error: any) {
        console.error('Error removing member:', error)
        toast.error(t('memberRemovedFailed'), {
          description: error.message || t('cancel'),
        })
      }
    }

    executeRemove()
  }

  const openRemoveDialog = (memberId: string, memberName: string) => {
    setMemberToRemove({ id: memberId, name: memberName })
    setRemoveDialogOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1 sm:mb-2">{t('title')}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {t('subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="font-medium"
          size="sm"
        >
          <IconUsers className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('inviteButton')}</span>
          <span className="sm:hidden">{t('inviteButtonShort')}</span>
        </Button>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('inviteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('inviteDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('emailAddress')}</label>
              <Input
                type="email"
                placeholder={t('emailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-11"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSubmitting && inviteEmail) {
                    handleInvite()
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('role')}</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11"
                  >
                    {inviteRole === 'developer' ? t('developer') :
                     inviteRole === 'admin' ? t('admin') :
                     inviteRole === 'viewer' ? t('viewer') : t('developer')}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuItem onClick={() => setInviteRole('developer')}>
                    {t('developer')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteRole('admin')}>
                    {t('admin')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteRole('viewer')}>
                    {t('viewer')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isSubmitting && (
              <div className="flex items-center justify-center py-2">
                <Spinner size="sm" />
                <span className="ml-2 text-sm text-muted-foreground">{t('sendingInvitation')}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false)
                setInviteEmail('')
                setInviteRole('developer')
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isSubmitting || !inviteEmail}
            >
              {isSubmitting ? t('sending') : t('sendInvitation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t('teamMembersCard')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 min-h-[200px]">
              <div className="flex flex-col items-center space-y-4">
                <Spinner size="md" />
                <p className="text-muted-foreground">{t('loadingMembers')}</p>
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t('noTeamMembers')}
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member: TeamMember) => (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      name={member.userName}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{member.userName}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">{member.userEmail}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs px-2 sm:px-3 py-1 rounded-full font-medium whitespace-nowrap",
                        member.role === 'admin'
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : member.role === 'viewer'
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      )}
                    >
                      {t(member.role as any)}
                    </span>
                    {currentUser?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRemoveDialog(member.id, member.userName)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation h-8 w-8 sm:h-9 sm:w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>{t('pendingInvitations')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation: Invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{invitation.email}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground capitalize">
                        <span className="whitespace-nowrap">{t(invitation.role as any)}</span>
                        <span className="hidden sm:inline"> • </span>
                        <span className="block sm:inline">{t('invited')} {new Date(invitation.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                      className="touch-manipulation text-xs sm:text-sm"
                    >
                      {t('resend')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveInvitation(invitation.id)}
                      className="touch-manipulation h-8 w-8 sm:h-9 sm:w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('removeDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('removeDialogDescription', { name: memberToRemove?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false)
                setMemberToRemove(null)
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
            >
              {t('remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
