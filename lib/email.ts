import { Resend } from 'resend'
import { getTranslations } from 'next-intl/server'

// Initialize Resend if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Get locale from request headers or cookies
 * Priority: NEXT_LOCALE cookie > Accept-Language header > 'en' (default)
 */
export function getLocaleFromRequest(request?: Request): string {
  if (!request) return 'en'

  try {
    // Try to get locale from NEXT_LOCALE cookie (set by next-intl)
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

      if (cookies.NEXT_LOCALE && ['en', 'zh'].includes(cookies.NEXT_LOCALE)) {
        return cookies.NEXT_LOCALE
      }
    }

    // Fallback to Accept-Language header
    const acceptLanguage = request.headers.get('accept-language')
    if (acceptLanguage) {
      // Parse Accept-Language: "zh-CN,zh;q=0.9,en;q=0.8"
      const preferredLang = acceptLanguage.split(',')[0]?.split('-')[0]
      if (preferredLang && ['en', 'zh'].includes(preferredLang)) {
        return preferredLang
      }
    }
  } catch (error) {
    console.error('Error getting locale from request:', error)
  }

  return 'en'
}

const emailTemplate = (
  teamName: string,
  inviterName: string,
  role: string,
  inviteUrl: string,
  t: Awaited<ReturnType<typeof getTranslations<'emails.invitation'>>>
) => `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('title', { teamName })}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                  ${t('title', { teamName })}
                </h1>
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  ${t.rich('bodyIntro', { teamName, inviterName, role })}
                </p>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  ${t('bodyAction')}
                </p>
                <a href="${inviteUrl}" style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 500; margin-bottom: 24px;">
                  ${t('acceptButton')}
                </a>
                <p style="margin: 0; font-size: 14px; color: #888; line-height: 1.5;">
                  ${t('urlFallback')}<br>
                  <a href="${inviteUrl}" style="color: #0066cc; word-break: break-all;">${inviteUrl}</a>
                </p>
                <hr style="margin: 32px 0; border: none; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; font-size: 14px; color: #888;">
                  ${t('footer')}
                </p>
              </div>
            </div>
          </body>
        </html>
      `

const otpEmailTemplate = (
  otp: string,
  type: 'sign-in' | 'email-verification',
  t: Awaited<ReturnType<typeof getTranslations<'emails.otp'>>>
) => {
  const title = type === 'sign-in' ? t('signIn.title') : t('emailVerification.title')
  const description = type === 'sign-in' ? t('signIn.description') : t('emailVerification.description')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
              ${title}
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
              ${description}
            </p>
            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0066cc; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
            </div>
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #888; line-height: 1.5;">
              ${t('expiryNotice')}
            </p>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 14px; color: #888;">
              ${t('footer')}
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function sendOTPEmail(params: {
  email: string
  otp: string
  type: 'sign-in' | 'email-verification'
  locale?: string
}) {
  const { email, otp, type, locale = 'en' } = params

  try {
    // Check if Resend is configured
    if (!resend || !process.env.RESEND_API_KEY) {
      console.log('📧 EMAIL DISABLED - Resend API key not configured')
      console.log(`📧 OTP for ${email}: ${otp}`)
      console.log('   💡 Tip: Add RESEND_API_KEY to .env')
      return { success: true, skipped: true }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@thegroupfinder.com'

    // Get translations for the specified locale
    const t = await getTranslations({ locale, namespace: 'emails.otp' })
    const subject = type === 'sign-in'
      ? t('signIn.subject')
      : t('emailVerification.subject')

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html: otpEmailTemplate(otp, type, t),
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log('✅ OTP email sent via Resend:', data)
    return { success: true }
  } catch (error: any) {
    console.error('Error sending OTP email:', error)
    console.log(`📧 OTP for ${email}: ${otp}`)
    return { success: false, error }
  }
}

export async function sendInvitationEmail(params: {
  email: string
  teamName: string
  inviterName: string
  role: string
  inviteUrl: string
  locale?: string
}) {
  const { email, teamName, inviterName, role, inviteUrl, locale = 'en' } = params

  try {
    // Check if Resend is configured
    if (!resend || !process.env.RESEND_API_KEY) {
      console.log('📧 EMAIL DISABLED - Resend API key not configured')
      console.log('📧 Copy this invitation URL to manually invite users:')
      console.log('   Invitation URL:', inviteUrl)
      console.log('   For email:', email)
      console.log('   💡 Tip: Add RESEND_API_KEY to .env')
      return { success: true, skipped: true }
    }

    // Get translations for the specified locale
    const t = await getTranslations({ locale, namespace: 'emails.invitation' })

    // Send email via Resend
    // Use verified domain: doable.kartiklabhshetwar.me
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@doable.kartikk.tech'

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: t('subject', { teamName }),
      html: emailTemplate(teamName, inviterName, role, inviteUrl, t),
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log('✅ Email sent via Resend:', data)
    return { success: true }
  } catch (error: any) {
    console.error('Error sending invitation email:', error)
    console.log('📧 Invitation created in database, but email failed.')
    console.log('📧 Copy this invitation URL to manually invite:')
    console.log('   URL:', inviteUrl)
    return { success: false, error }
  }
}
