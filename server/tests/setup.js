import { installBigIntSerializer } from '../src/utils/json.js'

/**
 * Test environment setup.
 *
 * Production installs the BigInt JSON shim in app.js, so anything reached through an HTTP
 * request already has it. Unit tests that import a service or presenter directly do not
 * load app.js, and would otherwise throw "Do not know how to serialize a BigInt" — an
 * artefact of the harness rather than a real defect. Installing it here makes every suite
 * behave the way the running server does.
 */
installBigIntSerializer()
