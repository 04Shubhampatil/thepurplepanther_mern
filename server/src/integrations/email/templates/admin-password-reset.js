import env from '../../../config/env.js'
import { layout, button, paragraph, escapeHtml, COLORS } from './layout.js'

/**
 * The admin equivalent of CustomerPasswordResetMail.
 *
 * There is no admin mailable in the Laravel source to port: Admin\AuthController leaves the
 * email to the framework's default ResetPassword notification, which builds its URL from
 * `route('password.reset')` — a name the app never registers, because the admin routes are
 * declared inside `->name('admin.')`. The source therefore raises RouteNotFoundException
 * instead of sending anything, so there is no original wording to reproduce and this
 * follows the customer mail's structure with the admin's own destination.
 *
 * The link points at the REACT admin reset route, matching Laravel's admin path shape
 * (`/admin/reset-password/{token}?email=`), so the token and address arrive the same way
 * the customer flow delivers them.
 */
export function adminPasswordResetMail({ user, token, expiresMinutes = 60 }) {
  const resetUrl =
    `${env.FRONTEND_URL.replace(/\/+$/, '')}/admin/reset-password/${encodeURIComponent(token)}` +
    `?email=${encodeURIComponent(user.email)}`

  const greeting = escapeHtml(user.name || 'there')

  const body = [
    paragraph(
      `Hi ${greeting},<br><br>
       We received a request to reset the password for your ${escapeHtml(env.APP_NAME)} admin account.
       Click the button below to choose a new password.`,
    ),
    button(resetUrl, 'Reset password'),
    paragraph(
      `This link expires in ${expiresMinutes} minutes and can be used once.
       If you did not request a password reset, ignore this email &mdash; your password will stay the same.`,
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
    subject: `Reset your admin password — ${env.APP_NAME}`,
    html: layout({
      eyebrow: 'Security',
      heading: 'Reset your admin password',
      preheader: 'Reset your Purple Panther admin password',
      body,
    }),
    text:
      `Hi ${user.name || 'there'},\n\n` +
      `We received a request to reset the password for your ${env.APP_NAME} admin account.\n\n` +
      `Reset your password: ${resetUrl}\n\n` +
      `This link expires in ${expiresMinutes} minutes and can be used once. ` +
      `If you did not request a password reset, ignore this email.\n`,
  }
}

export default adminPasswordResetMail
