/**
 * Test environment setup. Runs before any test module is imported.
 *
 * Test credentials are set here rather than read from `.env` so the suite is hermetic:
 * it behaves identically on a developer machine with no Razorpay keys, on CI, and in a
 * checkout of this repo. dotenv does not overwrite variables that are already present in
 * process.env, so these win over whatever `.env` holds.
 *
 * These values are obvious fakes and grant access to nothing. Real credentials must never
 * appear in the repository — see docs/env-mapping.md §11.
 */
process.env.NODE_ENV = 'test'

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_0000000000'
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret-not-a-real-key'
process.env.RAZORPAY_CURRENCY ||= 'INR'

process.env.JWT_SECRET ||= 'test-jwt-secret-at-least-32-characters-long'
process.env.SESSION_SECRET ||= 'test-session-secret-at-least-32-characters'
process.env.META_CATALOG_FEED_TOKEN ||= 'test-meta-catalog-feed-token-value'
process.env.DATABASE_URL ||= 'mysql://test:test@localhost:3306/purple_panther_test'

process.env.APP_URL ||= 'http://localhost:5000'
process.env.FRONTEND_URL ||= 'http://localhost:5173'
process.env.MEDIA_BASE_URL ||= 'http://localhost:5000/storage'

const { installBigIntSerializer } = await import('../src/utils/json.js')

/**
 * Production installs the BigInt JSON shim in app.js, so anything reached through an HTTP
 * request already has it. Unit tests that import a service or presenter directly do not
 * load app.js and would otherwise throw "Do not know how to serialize a BigInt" — an
 * artefact of the harness rather than a real defect.
 */
installBigIntSerializer()
