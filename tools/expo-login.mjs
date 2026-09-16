/**
 * Windows-safe Expo browser login.
 * Opens the browser via PowerShell so & in the OAuth URL is not mangled by cmd.exe.
 */
import http from 'http'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const UserSettings = require('expo/node_modules/@expo/cli/build/src/api/user/UserSettings.js')
const UserQuery = require('expo/node_modules/@expo/cli/build/src/api/graphql/queries/UserQuery.js').UserQuery
const { fetchAsync, getResponseDataOrThrow } = require('expo/node_modules/@expo/cli/build/src/api/rest/client.js')

const CLIENT_ID = 'expo-cli'
const EXPO_WEB = 'https://expo.dev'

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
    s.on('error', reject)
  })
}

function waitForCode(port, expectedState, codeVerifier) {
  return new Promise((resolve, reject) => {
    const connections = new Set()
    const server = http.createServer((req, res) => {
      const redirectAndCleanup = (result) => {
        res.writeHead(302, { Location: `${EXPO_WEB}/oauth/expo-cli?result=${result}` })
        res.end()
        server.close()
        for (const c of connections) c.destroy()
      }
      ;(async () => {
        if (!(req.method === 'GET' && req.url?.includes('/auth/callback'))) {
          throw new Error('Unexpected login response')
        }
        const url = new URL(req.url, `http://127.0.0.1:${port}`)
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        if (!code) throw new Error('Missing code')
        if (returnedState !== expectedState) throw new Error('State mismatch')

        const response = await fetchAsync('auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `http://localhost:${port}/auth/callback`,
            code_verifier: codeVerifier,
            client_id: CLIENT_ID,
          }),
        })
        const { session_secret: sessionSecret } = getResponseDataOrThrow(await response.json())
        if (!sessionSecret) throw new Error('No session_secret')
        resolve(sessionSecret)
        redirectAndCleanup('success')
      })().catch((err) => {
        try {
          redirectAndCleanup('error')
        } catch {}
        reject(err)
      })
    })
    server.on('connection', (c) => {
      connections.add(c)
      c.on('close', () => connections.delete(c))
    })
    server.listen(port, '127.0.0.1')
    setTimeout(() => {
      server.close()
      reject(new Error('Login timed out after 3 minutes'))
    }, 180_000)
  })
}

const port = await freePort()
const codeVerifier = b64url(crypto.randomBytes(32))
const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest())
const state = b64url(crypto.randomBytes(32))
const redirectUri = `http://localhost:${port}/auth/callback`
const authUrl =
  `${EXPO_WEB}/login?client_id=${CLIENT_ID}` +
  `&redirect_uri=${redirectUri}` +
  `&response_type=code` +
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256` +
  `&state=${state}` +
  `&confirm_account=true`

console.log('Opening browser — sign in to Expo, then return here.')
console.log(authUrl)
spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${authUrl.replace(/'/g, "''")}'`], {
  detached: true,
  stdio: 'ignore',
}).unref()

const sessionSecret = await waitForCode(port, state, codeVerifier)
const userData = await UserQuery.meUserActorAsync({ 'expo-session': sessionSecret })
await UserSettings.setSessionAsync({
  sessionSecret,
  userId: userData.id,
  username: userData.username,
  currentConnection: 'Browser-Flow-Authentication',
})
console.log(`Logged in as @${userData.username}`)
