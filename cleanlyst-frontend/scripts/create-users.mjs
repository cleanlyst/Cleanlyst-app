import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const baseEnvPath = resolve(projectRoot, '.env')
const localEnvPath = resolve(projectRoot, '.env.create-users.local')

function parseEnvFile(path) {
  if (!existsSync(path)) return {}

  const content = readFileSync(path, 'utf8')
  const entries = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

const env = {
  ...parseEnvFile(baseEnvPath),
  ...parseEnvFile(localEnvPath),
  ...process.env,
}

const requiredKeys = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CUSTOMER_EMAIL',
  'CUSTOMER_PASSWORD',
  'CUSTOMER_FULL_NAME',
  'CLEANER_EMAIL',
  'CLEANER_PASSWORD',
  'CLEANER_FULL_NAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_FULL_NAME',
]

const missingKeys = requiredKeys.filter((key) => !env[key])
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  process.exit(1)
}

if (missingKeys.length) {
  console.error(`Missing required configuration: ${missingKeys.join(', ')}`)
  console.error('Update cleanlyst-frontend/.env.create-users.local and run this script again.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const users = [
  {
    email: env.CUSTOMER_EMAIL,
    password: env.CUSTOMER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: env.CUSTOMER_FULL_NAME,
      role: 'customer',
    },
  },
  {
    email: env.CLEANER_EMAIL,
    password: env.CLEANER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: env.CLEANER_FULL_NAME,
      role: 'cleaner',
    },
  },
  {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: env.ADMIN_FULL_NAME,
      role: 'admin',
    },
  },
]

for (const user of users) {
  const { data, error } = await supabase.auth.admin.createUser(user)

  if (error) {
    console.error(`Failed to create ${user.email}: ${error.message}`)
    continue
  }

  console.log(`Created ${user.user_metadata.role} user: ${data.user?.email}`)
}
