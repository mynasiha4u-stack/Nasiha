// scripts/_loadenv.js
//
// Tiny env-loader for the Node scripts. Reads `.env.scripts.local` (or
// `.env.local`) from the project root and injects each line into process.env.
//
// Why this exists: typing GOOGLE_MAPS_API_KEY=... ANTHROPIC_API_KEY=... etc.
// inline on every command is brittle. With this loader, you save all 4 keys
// ONCE in `.env.scripts.local` and every script just runs as `node scripts/foo.js`.
//
// The file is .gitignored so keys never get committed.
//
// File format (one per line, no surrounding quotes needed):
//   GOOGLE_MAPS_API_KEY=AIza...
//   ANTHROPIC_API_KEY=sk-ant-...
//   OPENAI_API_KEY=sk-proj-...
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// Explicit env vars take precedence over the file (so you can still override
// any single var inline if you ever need to).

const fs = require('fs')
const path = require('path')

const CANDIDATES = [
  path.resolve(__dirname, '..', '.env.scripts.local'),
  path.resolve(__dirname, '..', '.env.local'),
]

let loadedFrom = null
for (const file of CANDIDATES) {
  if (!fs.existsSync(file)) continue
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    // Explicit env vars win — don't overwrite
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
  loadedFrom = file
  break
}

if (loadedFrom) {
  console.log(`[env loaded from ${path.basename(loadedFrom)}]`)
}
