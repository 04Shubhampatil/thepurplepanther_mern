import env from '../../../config/env.js'
import { layout, button, paragraph, escapeHtml, COLORS } from './layout.js'

/**
 * Port of App\Mail\CustomerPasswordResetMail + emails/auth/reset-password.blade.php.
 *
 * Subject and body copy are reproduced verbatim — customers recognise these emails, and
 * changing the wording is a visible regression.
 *
 * The reset link points at the REACT app (FRONTEND_URL), not the API, because the reset
 * form is now a React page. The path `/reset-password/{token}?email=` is unchanged from
 * Laravel, so links in flight at cutover still resolve.
 */
export function customerPasswordResetMail({ user, token, expiresMinutes = 60 }) {
  const resetUrl =
    `${env.FRONTEND_URL.replace(/\/+$/, '')}/reset-password/${encodeURIComponent(token)}` +
    `?email=${encodeURIComponent(user.email)}`

  const greeting = escapeHtml(user.name || 'there')

  const body = [
    paragraph(
      `Hi ${greeting},<br><br>
       We received a request to reset the password for your ${escapeHtml(env.APP_NAME)} account.
       Click the button below to choose a new password.`,
    ),
    button(resetUrl, 'Reset password'),
    paragraph(
      `This link expires in ${expiresMinutes} minutes.
       If you did not request a password reset, you can ignore this email &mdash; your password will stay the same.`,
      { size: 13, color: COLORS.muted, padding: '0 32px 24px' },
    ),
    `<tr>
      <td style="padding:0 32px 28px;font-size:12px;line-height:1.6;color:${COLORS.faint};word-break:break-all;">
        Or copy this link into your browser:<br>
        <a href="${escapeHtml(resetUrl)}" style="color:${COLORS.brand};">${escapeHtml(resetUrl)}</a>
      </td>
    </tr>`,
  ].join('\n')

  return {
    to: user.email,
    subject: `Reset your password — ${env.APP_NAME}`,
    html: layout({
      eyebrow: 'Security',
      heading: 'Reset your password',
      preheader: 'Reset your Purple Panther password',
      body,
    }),
    text:
      `Hi ${user.name || 'there'},\n\n` +
      `We received a request to reset the password for your ${env.APP_NAME} account.\n\n` +
      `Reset your password: ${resetUrl}\n\n` +
      `This link expires in ${expiresMinutes} minutes. ` +
      `If you did not request a password reset, you can ignore this email.\n`,
  }
}

export default customerPasswordResetMail
