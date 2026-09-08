import nodemailer from 'nodemailer'
import env from '../../config/env.js'
import logger from '../../config/logger.js'

/**
 * SMTP transport, mirroring Laravel's mail config (smtp.gmail.com:587, STARTTLS).
 *
 * FAILURE POLICY — load-bearing. Laravel wrapped every send in try/catch so a mail
 * failure could never fail an order (CheckoutService::sendOrderEmails). That is preserved
 * here and strengthened: because Laravel ran QUEUE_CONNECTION=sync, Gmail's latency sat
 * on the checkout critical path (audit R8). send() is fire-and-forget by default, so a
 * slow SMTP server no longer delays the customer's response.
 */

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!env.mailConfigured) return null

  transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE, // false for 587 (STARTTLS), true for 465
    auth: { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD },
    pool: true,
    maxConnections: 3,
  })

  return transporter
}

const fromAddress = () =>
  env.MAIL_FROM_ADDRESS ? `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>` : env.MAIL_FROM_NAME

/**
 * Send an email. Resolves to true/false; never rejects, so no caller can accidentally
 * fail a business operation because SMTP was down.
 *
 * @param {{to: string, subject: string, html: string, text?: string}} message
 */
export async function send({ to, subject, html, text }) {
  if (!to) {
    logger.warn({ subject }, 'Email skipped — no recipient')
    return false
  }

  const transport = getTransporter()
  if (!transport) {
    // Not an error in development, where SMTP is usually unconfigured.
    logger.warn({ to, subject }, 'Email skipped — mail is not configured')
    return false
  }

  try {
    const info = await transport.sendMail({ from: fromAddress(), to, subject, html, text })
    logger.info({ to, subject, messageId: info.messageId }, 'Email sent')
    return true
  } catch (error) {
    logger.error({ err: error, to, subject }, 'Email failed')
    return false
  }
}

/**
 * Send without awaiting. Use on any request path where the customer should not wait for
 * SMTP — checkout in particular. Errors are swallowed by send() and logged.
 */
export function sendAsync(message) {
  void send(message)
}

/** Admin notification recipient, matching config('mail.admin_address') and its fallback. */
export const adminRecipient = () => env.mailAdminAddress

export default { send, sendAsync, adminRecipient }
