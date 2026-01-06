'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'

export default function InvitePage({ params }: { params: Promise<{ invitationId: string }> }) {
  const t = useTranslations();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'not-found' | 'expired' | 'need-login'>('loading')
  const [error, setError] = useState<string>('')
  const [teamId, setTeamId] = useState<string>('')
  const [invitationId, setInvitationId] = useState<string>('')
  const [invitationEmail, setInvitationEmail] = useState<string>('')
  const router = useRouter()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    const fetchParams = async () => {
      const resolvedParams = await params
      setInvitationId(resolvedParams.invitationId)
    }
    fetchParams()
  }, [params])

  useEffect(() => {
    if (!invitationId) return

    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${invitationId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setStatus('not-found')
          } else {
            setStatus('error')
            setError(t('invite.error.failedToLoad'))
          }
          return
        }

        const data = await response.json()
        setTeamId(data.teamId)
        setInvitationEmail(data.email)

        // Check if already accepted or expired
        if (data.status === 'accepted') {
          setStatus('success')
          return
        }

        if (new Date(data.expiresAt) < new Date()) {
          setStatus('expired')
          return
        }

        // Check if user is logged in
        if (!session?.user) {
          setStatus('need-login')
          return
        }

        // Check if email matches
        if (session.user.email !== data.email) {
          setStatus('need-login')
          setError(t('invite.wrongAccount.mismatchMessage', { invitedEmail: data.email, currentEmail: session.user.email }))
          return
        }

        // Invitation is valid and ready to accept
        setStatus('ready')
      } catch (error) {
        console.error('Error fetching invitation:', error)
        setStatus('error')
        setError(t('invite.error.failedToLoad'))
      }
    }

    fetchInvitation()
  }, [invitationId, session])

  const handleAccept = async () => {
    try {
      setStatus('accepting')
      
      const response = await fetch(`/api/teams/${teamId}/invitations/${invitationId}/accept`, {
        method: 'POST',
      })

      if (response.ok) {
        setStatus('success')
        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push(`/dashboard/${teamId}`)
        }, 2000)
      } else {
        const errorData = await response.json()
        setStatus('error')
        setError(errorData.error || t('invite.error.failedToAccept'))
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      setStatus('error')
      setError(t('invite.error.failedToAccept'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('invite.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center py-8">
              <div className="flex flex-col items-center space-y-4">
                <Spinner size="md" />
                <p className="text-muted-foreground">{t('invite.loading')}</p>
              </div>
            </div>
          )}

          {status === 'accepting' && (
            <div className="text-center py-8">
              <div className="flex flex-col items-center space-y-4">
                <Spinner size="md" />
                <p className="text-muted-foreground">{t('invite.accepting')}</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <h3 className="text-xl font-semibold">{t('invite.success.title')}</h3>
              <p className="text-muted-foreground">{t('invite.success.message')}</p>
            </div>
          )}

          {status === 'not-found' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-600" />
              <h3 className="text-xl font-semibold">{t('invite.notFound.title')}</h3>
              <p className="text-muted-foreground">
                {t('invite.notFound.message')}
              </p>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
              <h3 className="text-xl font-semibold">{t('invite.expired.title')}</h3>
              <p className="text-muted-foreground">
                {t('invite.expired.message')}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
              <h3 className="text-xl font-semibold">{t('invite.error.title')}</h3>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => window.location.reload()}>{t('invite.error.tryAgain')}</Button>
            </div>
          )}

          {status === 'ready' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-blue-600" />
              <h3 className="text-xl font-semibold">{t('invite.ready.title')}</h3>
              <p className="text-muted-foreground">{t('invite.ready.message')}</p>
              <Button onClick={handleAccept} className="w-full" size="lg">
                {t('invite.ready.acceptButton')}
              </Button>
            </div>
          )}

          {status === 'need-login' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-blue-600" />
              <h3 className="text-xl font-semibold">{t('invite.wrongAccount.title')}</h3>
              {error ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground">{error}</p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">
                      {t('invite.wrongAccount.invitationFor')}
                    </p>
                    <p className="text-sm text-primary font-semibold">{invitationEmail}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('invite.wrongAccount.currentlyLoggedIn')} {session?.user?.email}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('invite.wrongAccount.switchPrompt')}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {t('invite.wrongAccount.needLogin')}
                </p>
              )}
              <div className="flex gap-2 justify-center pt-4">
                <Button
                  onClick={async () => {
                    try {
                      await authClient.signOut()
                      // Redirect to sign-in after successful sign out
                      window.location.href = `/sign-in?redirect=/invite/${invitationId}`
                    } catch (error) {
                      console.error('Error signing out:', error)
                      // Still redirect even if sign out fails
                      window.location.href = `/sign-in?redirect=/invite/${invitationId}`
                    }
                  }}
                  variant="default"
                  size="lg"
                  className="min-w-[140px]"
                >
                  {t('invite.wrongAccount.switchButton')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

