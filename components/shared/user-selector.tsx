'use client'

import { useState, useEffect, useMemo } from 'react'
import { authClient } from '@/lib/auth-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useTranslations } from 'next-intl'

interface User {
  id: string
  userId: string
  displayName: string
  email: string
  profileImageUrl?: string
}

interface UserSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  teamId?: string
}

// Global cache for team members
const membersCache = new Map<string, { data: User[], timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function getCachedMembers(teamId: string): User[] | null {
  const cached = membersCache.get(teamId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

function setCachedMembers(teamId: string, data: User[]) {
  membersCache.set(teamId, { data, timestamp: Date.now() })
}

export function UserSelector({
  value,
  onValueChange,
  placeholder,
  className,
  teamId
}: UserSelectorProps) {
  const t = useTranslations('components.userSelector')
  const { data: session } = authClient.useSession()
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Memoize current user to avoid recreating
  const currentUser = useMemo(() => {
    if (!session?.user) return null
    return {
      id: session.user.id,
      userId: session.user.id,
      displayName: session.user.name || session.user.email || 'Unknown',
      email: session.user.email || '',
      profileImageUrl: session.user.image || undefined
    }
  }, [session])

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        setLoading(true)
        
        if (!teamId) {
          // If no teamId provided, just show current user
          if (currentUser) {
            setTeamMembers([currentUser])
            setLoading(false)
          }
          return
        }
        
        // Check cache first
        const cachedMembers = getCachedMembers(teamId)
        if (cachedMembers) {
          setTeamMembers(cachedMembers)
          setLoading(false)
          return
        }
        
        const response = await fetch(`/api/teams/${teamId}/members`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const members = await response.json()
          // Cache the result
          setCachedMembers(teamId, members)
          setTeamMembers(members)
        } else {
          console.error('Failed to fetch team members:', response.statusText)
          // Fallback to current user if API fails
          if (currentUser) {
            setTeamMembers([currentUser])
          }
        }
      } catch (error) {
        console.error('Error fetching team members:', error)
        // Fallback to current user if API fails
        if (currentUser) {
          setTeamMembers([currentUser])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTeamMembers()
  }, [teamId, currentUser])

  const selectedUser = teamMembers.find(member => member.userId === value)

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder={t('loading')} />
        </SelectTrigger>
      </Select>
    )
  }

  // Ensure value is never empty string - use "unassigned" as default
  const selectValue = value && value.trim() !== "" ? value : "unassigned"

  return (
    <Select value={selectValue} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder || t('selectAssignee')}>
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <UserAvatar
                name={selectedUser.displayName}
                imageUrl={selectedUser.profileImageUrl}
                size="sm"
              />
              <span>{selectedUser.displayName}</span>
            </div>
          ) : selectValue === "unassigned" ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-xs text-gray-500">?</span>
              </div>
              <span>{t('unassigned')}</span>
            </div>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-xs text-gray-500">?</span>
            </div>
            <span>{t('unassigned')}</span>
          </div>
        </SelectItem>
        {teamMembers.map((member) => (
          <SelectItem key={member.id} value={member.userId}>
            <div className="flex items-center gap-2">
              <UserAvatar 
                name={member.displayName}
                imageUrl={member.profileImageUrl}
                size="sm"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{member.displayName}</span>
                <span className="text-xs text-gray-500">{member.email}</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
