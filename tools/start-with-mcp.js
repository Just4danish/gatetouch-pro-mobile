#!/usr/bin/env node
const { spawn } = require('child_process')

const env = { ...process.env, EXPO_UNSTABLE_MCP_SERVER: '1' }
const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code) => process.exit(code ?? 0))
