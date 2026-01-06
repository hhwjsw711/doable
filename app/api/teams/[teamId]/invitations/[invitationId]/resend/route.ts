import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'
import { sendInvitationEmail, getLocaleFromRequest } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get invitation details
    const invitation = await db.invitation.findUnique({
      where: {
        id: invitationId,
        teamId,
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Extend expiration by 7 more days
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    const updatedInvitation = await db.invitation.update({
      where: {
        id: invitationId,
        teamId,
      },
      data: {
        expiresAt: newExpiresAt,
      },
    })

    // Get team info for email
    const team = await db.team.findUnique({
      where: { id: teamId },
    })

    // Get inviter info
    const inviterName = user.name || user.email || 'Someone'

    // Resend invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${invitation.id}`

    if (process.env.RESEND_API_KEY) {
      try {
        const locale = getLocaleFromRequest(request)
        await sendInvitationEmail({
          email: invitation.email,
          teamName: team?.name || 'the team',
          inviterName,
          role: invitation.role,
          inviteUrl,
          locale,
        })
      } catch (emailError) {
        console.error('Error resending invitation email:', emailError)
        // Don't fail the resend if email fails
      }
    }

    return NextResponse.json(updatedInvitation)
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}

