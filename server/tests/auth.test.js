import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPrismaMock } from './helpers/prisma-mock.js'

/**
 * Phase 2 — authentication.
 *
 * Every expectation traces to a specific line of the Laravel source. Where a message is
 * asserted verbatim it is because the storefront displays that exact string.
 *
 * Prisma is mocked so this suite runs before the production dump has been restored
 * locally. It verifies business rules, not SQL.
 */

const prismaMock = createPrismaMock()
vi.mock('../src/config/database.js', () => ({
  default: prismaMock,
  prisma: prismaMock,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

const sentEmails = []
vi.mock('../src/integrations/email/mailer.js', () => ({
  send: vi.fn(async (message) => {
    sentEmails.push(message)
    return true
  }),
  sendAsync: vi.fn(),
  adminRecipient: () => 'admin@example.com',
  default: {},
}))

const request = (await import('supertest')).default
const app = (await import('../src/app.js')).default
const authService = await import('../src/services/auth.service.js')
const { hashPassword } = await import('../src/utils/password.js')
const bcrypt = (await import('bcrypt')).default
const { verifyAuthToken, AUTH_COOKIE } = await import('../src/utils/auth-token.js')

const PASSWORD = 'secret123'
let customerHash
let adminHash

beforeEach(async () => {
  customerHash ??= await hashPassword(PASSWORD)
  adminHash ??= await hashPassword(PASSWORD)

  // Laravel-style $2y$ hash, to prove the D5 fix holds through the whole stack.
  const laravelStyle = `$2y$${customerHash.slice(4)}`

  prismaMock.__tables.user.length = 0
  prismaMock.__tables.passwordResetToken.length = 0
  prismaMock.__tables.passwordResetAttempt.length = 0
  sentEmails.length = 0

  prismaMock.__tables.user.push(
    {
      id: 1n,
      name: 'Asha Menon',
      username: null,
      email: 'asha@example.com',
      phone: '9876543210',
      password: laravelStyle,
      role: 'customer',
      isActive: true,
      loginProvider: 'email',
      avatar: null,
    },
    {
      id: 2n,
      name: 'Inactive User',
      username: null,
      email: 'inactive@example.com',
      password: laravelStyle,
      role: 'customer',
      isActive: false,
      loginProvider: 'email',
      avatar: null,
    },
    {
      id: 3n,
      name: 'Site Admin',
      username: 'siteadmin',
      email: 'admin@example.com',
      password: adminHash,
      role: 'admin',
      isActive: true,
      loginProvider: 'email',
      avatar: null,
    },
  )
})

const cookieFor = (res) => {
  const raw = res.headers['set-cookie'] ?? []
  return raw.find((c) => c.startsWith(`${AUTH_COOKIE}=`)) ?? ''
}

// ─────────────────────────────────────────────────────── customer login

describe('POST /api/v1/auth/login', () => {
  it('signs in a customer whose password is a Laravel $2y$ hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe('Signed in successfully.')
    expect(res.body.data.user.email).toBe('asha@example.com')
    expect(res.body.data.redirect).toBe('/account/overview')
  })

  it('issues an HTTP-only cookie holding a JWT, not a body token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: PASSWORD })

    const cookie = cookieFor(res)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite')

    const token = cookie.split(';')[0].split('=')[1]
    const payload = verifyAuthToken(decodeURIComponent(token))
    expect(payload.sub).toBe('1')
    expect(payload.role).toBe('customer')

    // The token must never also appear in the JSON body, where JS could read it.
    expect(JSON.stringify(res.body)).not.toContain(token)
  })

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: PASSWORD })

    const body = JSON.stringify(res.body)
    expect(body).not.toContain('$2y$')
    expect(body).not.toContain('$2b$')
    expect(res.body.data.user).not.toHaveProperty('password')
    expect(res.body.data.user).not.toHaveProperty('rememberToken')
  })

  it('is case-insensitive on the email, matching the normalised lookup', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: '  ASHA@Example.com  ', password: PASSWORD })
    expect(res.status).toBe(200)
  })

  it('rejects a wrong password with Laravel\'s exact message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: 'wrong-password' })

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('These credentials do not match our records.')
  })

  it('gives an unknown email the SAME message as a wrong password', async () => {
    // Distinguishing them would let an attacker enumerate registered addresses.
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: 'wrong-password' })

    expect(unknown.status).toBe(wrong.status)
    expect(unknown.body.message).toBe(wrong.body.message)
  })

  it('refuses a deactivated account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@example.com', password: PASSWORD })

    expect(res.status).toBe(422)
    expect(cookieFor(res)).toBe('')
  })

  it('refuses an ADMIN through the customer endpoint', async () => {
    // CustomerAuthController scopes its lookup to role='customer'.
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: PASSWORD })

    expect(res.status).toBe(422)
    expect(cookieFor(res)).toBe('')
  })

  it('validates the request body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '1' })
    expect(res.status).toBe(422)
    expect(res.body.errors).toHaveProperty('email')
  })
})

// ─────────────────────────────────────────────────────── registration

describe('POST /api/v1/auth/register', () => {
  it('creates a customer and signs them in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New Person', email: 'new@example.com', password: 'abcdef', password_confirmation: 'abcdef' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Account created successfully.')
    expect(cookieFor(res)).toContain('HttpOnly')

    const created = prismaMock.__tables.user.find((u) => u.email === 'new@example.com')
    expect(created.role).toBe('customer')
    expect(created.isActive).toBe(true)
    expect(created.loginProvider).toBe('email')
  })

  it('stores a bcrypt hash, never the plaintext', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New Person', email: 'new@example.com', password: 'abcdef' })

    const created = prismaMock.__tables.user.find((u) => u.email === 'new@example.com')
    expect(created.password).not.toBe('abcdef')
    expect(created.password).toMatch(/^\$2b\$10\$/)
    await expect(bcrypt.compare('abcdef', created.password)).resolves.toBe(true)
  })

  it('rejects a duplicate email with Laravel\'s message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Copy', email: 'asha@example.com', password: 'abcdef' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('This email is already registered.')
  })

  it('rejects a duplicate that differs only in case', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Copy', email: 'ASHA@EXAMPLE.COM', password: 'abcdef' })
    expect(res.status).toBe(422)
  })

  it('rejects a mismatched confirmation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: 'abcdef', password_confirmation: 'different' })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('Passwords do not match.')
  })

  it('enforces the 6-character minimum', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: '12345' })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('Password must be at least 6 characters.')
  })
})

// ─────────────────────────────────────────────────────── session

describe('session endpoints', () => {
  it('GET /me returns null when signed out, without a 401', async () => {
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data.user).toBeNull()
  })

  it('GET /me returns the user when the cookie is present', async () => {
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: PASSWORD })

    const res = await agent.get('/api/v1/auth/me')
    expect(res.body.data.user.email).toBe('asha@example.com')
    expect(res.body.data.user.firstName).toBe('Asha')
    expect(res.body.data.user.lastName).toBe('Menon')
  })

  it('ignores a tampered token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${AUTH_COOKIE}=not.a.valid.jwt`)

    expect(res.status).toBe(200)
    expect(res.body.data.user).toBeNull()
  })

  it('stops recognising a user who is deactivated after signing in', async () => {
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: PASSWORD })

    // The user is reloaded on every request, so this takes effect immediately rather
    // than at token expiry.
    prismaMock.__tables.user.find((u) => u.email === 'asha@example.com').isActive = false

    const res = await agent.get('/api/v1/auth/me')
    expect(res.body.data.user).toBeNull()
  })

  it('POST /logout clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout')
    expect(res.status).toBe(200)
    expect(cookieFor(res)).toMatch(/pp_token=;/)
  })
})

describe('POST /api/v1/auth/check-email', () => {
  it('reports a free address as available', async () => {
    const res = await request(app).post('/api/v1/auth/check-email').send({ email: 'free@example.com' })
    expect(res.body.data.available).toBe(true)
  })

  it('reports a taken address as unavailable', async () => {
    const res = await request(app).post('/api/v1/auth/check-email').send({ email: 'asha@example.com' })
    expect(res.body.data.available).toBe(false)
    expect(res.body.message).toBe('This email is already registered.')
  })

  it('does not report the signed-in user\'s own address as taken', async () => {
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: PASSWORD })

    const res = await agent.post('/api/v1/auth/check-email').send({ email: 'asha@example.com' })
    expect(res.body.data.available).toBe(true)
  })
})

// ─────────────────────────────────────────────────────── password reset

describe('password reset', () => {
  it('issues a token and emails a link', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'asha@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('A password reset link has been sent to your email.')
    expect(res.body.data.remaining_attempts).toBe(1)
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].to).toBe('asha@example.com')
    expect(sentEmails[0].subject).toContain('Reset your password')
  })

  it('stores only a bcrypt HASH of the token, never the plaintext', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })

    const row = prismaMock.__tables.passwordResetToken[0]
    expect(row.token).toMatch(/^\$2b\$/)

    // The emailed link must not contain the stored value.
    const link = sentEmails[0].text.match(/reset-password\/([^?]+)\?/)[1]
    expect(row.token).not.toBe(decodeURIComponent(link))
    await expect(bcrypt.compare(decodeURIComponent(link), row.token)).resolves.toBe(true)
  })

  it('caps at 2 emails per address per 24 hours (429)', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })

    const third = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'asha@example.com' })

    expect(third.status).toBe(429)
    expect(third.body.message).toContain('limit of 2 password reset emails in 24 hours')
    expect(sentEmails).toHaveLength(2)
  })

  it('does not count attempts older than 24 hours', async () => {
    prismaMock.__tables.passwordResetAttempt.push(
      { email: 'asha@example.com', createdAt: new Date(Date.now() - 25 * 3600 * 1000) },
      { email: 'asha@example.com', createdAt: new Date(Date.now() - 26 * 3600 * 1000) },
    )

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'asha@example.com' })
    expect(res.status).toBe(200)
  })

  it('rejects an unregistered address (parity — see audit R10)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('This email is not registered with us.')
  })

  it('resets the password with a valid token and invalidates the link', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })
    const token = decodeURIComponent(sentEmails[0].text.match(/reset-password\/([^?]+)\?/)[1])

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, email: 'asha@example.com', password: 'brandnew1', password_confirmation: 'brandnew1' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Your password has been reset. Please sign in.')
    expect(res.body.data.redirect).toBe('/login')

    // Single use.
    expect(prismaMock.__tables.passwordResetToken).toHaveLength(0)

    // The new password works and the old one does not.
    const good = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: 'brandnew1' })
    expect(good.status).toBe(200)

    const old = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@example.com', password: PASSWORD })
    expect(old.status).toBe(422)
  })

  it('does not sign the user in on reset', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })
    const token = decodeURIComponent(sentEmails[0].text.match(/reset-password\/([^?]+)\?/)[1])

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, email: 'asha@example.com', password: 'brandnew1' })

    expect(cookieFor(res)).toBe('')
  })

  it('rejects a wrong token', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'totally-wrong-token', email: 'asha@example.com', password: 'brandnew1' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('This reset link is invalid or has expired.')
  })

  it('rejects a token older than 60 minutes', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })
    const token = decodeURIComponent(sentEmails[0].text.match(/reset-password\/([^?]+)\?/)[1])

    prismaMock.__tables.passwordResetToken[0].createdAt = new Date(Date.now() - 61 * 60 * 1000)

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, email: 'asha@example.com', password: 'brandnew1' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('This reset link is invalid or has expired.')
    expect(prismaMock.__tables.passwordResetToken).toHaveLength(0) // expired row cleaned up
  })

  it('rejects a token belonging to a different address', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'asha@example.com' })
    const token = decodeURIComponent(sentEmails[0].text.match(/reset-password\/([^?]+)\?/)[1])

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, email: 'inactive@example.com', password: 'brandnew1' })

    expect(res.status).toBe(422)
  })
})

// ─────────────────────────────────────────────────────── admin

describe('POST /api/v1/admin/auth/login', () => {
  it('signs an admin in by username', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'siteadmin', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('admin')
    expect(res.body.data.redirect).toBe('/admin/dashboard')
  })

  it('signs the same admin in by email through the same field', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin@example.com', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('admin')
  })

  it('refuses a CUSTOMER through the admin endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'asha@example.com', password: PASSWORD })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Invalid username or password.')
    expect(cookieFor(res)).toBe('')
  })

  it('uses one message for every failure mode', async () => {
    const unknown = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'ghost', password: PASSWORD })
    const wrong = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'siteadmin', password: 'nope' })

    expect(unknown.body.message).toBe('Invalid username or password.')
    expect(wrong.body.message).toBe('Invalid username or password.')
  })
})

describe('admin authorisation', () => {
  it('rejects an anonymous request to an admin route with 401', async () => {
    const res = await request(app).get('/api/v1/admin/auth/me')
    expect(res.status).toBe(401)
  })

  it('rejects a signed-in CUSTOMER with 403', async () => {
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: PASSWORD })

    const res = await agent.get('/api/v1/admin/auth/me')
    expect(res.status).toBe(403)
  })

  it('does NOT log the customer out on a failed admin check', async () => {
    // Laravel's AdminMiddleware called auth()->logout() here, silently ending the
    // customer's storefront session and dropping their cart. Deliberate difference.
    const agent = request.agent(app)
    await agent.post('/api/v1/auth/login').send({ email: 'asha@example.com', password: PASSWORD })
    await agent.get('/api/v1/admin/auth/me')

    const res = await agent.get('/api/v1/auth/me')
    expect(res.body.data.user.email).toBe('asha@example.com')
  })

  it('allows a signed-in admin', async () => {
    const agent = request.agent(app)
    await agent.post('/api/v1/admin/auth/login').send({ username: 'siteadmin', password: PASSWORD })

    const res = await agent.get('/api/v1/admin/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('admin')
  })
})

// ─────────────────────────────────────────────────────── service unit

describe('toPublicUser', () => {
  it('splits the name and omits every sensitive field', () => {
    const shaped = authService.toPublicUser({
      id: 1n,
      name: 'Asha Rani Menon',
      email: 'a@b.com',
      phone: '123',
      password: '$2y$10$secret',
      rememberToken: 'nope',
      role: 'customer',
      loginProvider: 'email',
      avatar: null,
    })

    expect(shaped.firstName).toBe('Asha')
    expect(shaped.lastName).toBe('Rani Menon')
    expect(shaped).not.toHaveProperty('password')
    expect(shaped).not.toHaveProperty('rememberToken')
    expect(shaped.avatar).toContain('ui-avatars.com') // matches Laravel's fallback
  })
})
