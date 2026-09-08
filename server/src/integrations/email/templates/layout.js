import env from '../../../config/env.js'

/**
 * Shared email chrome, rebuilt from resources/views/emails/partials/logo-header.blade.php
 * and the surrounding table markup. Inline styles and table layout are kept because email
 * clients still require them.
 *
 * Palette taken from the Blade sources: #f3eef6 page, #3a1651 brand, #e4d8ea borders.
 */

export const COLORS = {
  page: '#f3eef6',
  brand: '#3a1651',
  border: '#e4d8ea',
  body: '#3d3045',
  muted: '#6b5a74',
  faint: '#8a7a90',
  white: '#ffffff',
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * @param {{eyebrow?: string, heading: string, body: string, preheader?: string}} options
 * `body` is trusted HTML assembled by a template module — never raw user input.
 */
export function layout({ eyebrow = '', heading, body, preheader = '' }) {
  const year = new Date().getFullYear()
  const appName = escapeHtml(env.APP_NAME)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:Arial,Helvetica,sans-serif;color:#2a1a33;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:20px;font-family:Georgia,serif;font-size:22px;color:${COLORS.brand};letter-spacing:.04em;">
              ${appName}
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:4px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${COLORS.brand};padding:26px 32px;color:#fff;">
                    ${
                      eyebrow
                        ? `<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.85;margin-bottom:6px;">${escapeHtml(eyebrow)}</div>`
                        : ''
                    }
                    <div style="font-family:Georgia,serif;font-size:26px;color:#fff;">${escapeHtml(heading)}</div>
                  </td>
                </tr>
                ${body}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;font-size:12px;color:${COLORS.faint};">
              &copy; ${year} ${appName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** A primary call-to-action button, matching the Blade markup. */
export function button(href, label) {
  return `<tr>
  <td align="center" style="padding:12px 32px 28px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:${COLORS.brand};color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:.08em;text-transform:uppercase;padding:14px 28px;border-radius:2px;">
      ${escapeHtml(label)}
    </a>
  </td>
</tr>`
}

/** A paragraph block. `html` is trusted template content. */
export function paragraph(html, { size = 15, color = COLORS.body, padding = '28px 32px 12px' } = {}) {
  return `<tr>
  <td style="padding:${padding};font-size:${size}px;line-height:1.6;color:${color};">${html}</td>
</tr>`
}

export default { layout, button, paragraph, escapeHtml, COLORS }
