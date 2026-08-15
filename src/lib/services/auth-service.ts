/**
 * Local account management (device-level auth).
 *
 * The app ships without a backend authentication server, so accounts live on
 * the device itself: a small registry in localStorage maps display names to
 * real database User rows (one email per account, e.g. acct-<random>@local).
 *
 * This gives each household member / device owner their own isolated
 * timeline, categories, conversations, habits, templates and goals — and a
 * way to switch between them — while keeping the database real (SQLite).
 *
 * For cloud deployment this is replaced by real auth (see HOSTING_GUIDE.md):
 * the rest of the code already scopes every query by `userId`, so no data
 * layer change is required.
 */
import { db } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/types'

export interface LocalAccount {
  id: string // database User id
  name: string
  createdAt: string
}

const REGISTRY_KEY = 'lt-account-registry'
const ACTIVE_KEY = 'lt-active-account'

function readRegistry(): LocalAccount[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]')
  } catch {
    return []
  }
}

function writeRegistry(accounts: LocalAccount[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(accounts))
}

export function getLocalAccounts(): LocalAccount[] {
  return readRegistry()
}

export function getActiveAccountId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveAccountId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

/**
 * Create a new account. The database gets its own User row (and default
 * categories), and the registry is updated. Returns the new account.
 */
export async function createLocalAccount(name: string): Promise<LocalAccount> {
  const email = `acct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@life-timeline.local`
  const user = await db.user.create({
    data: {
      email,
      name,
      timezone: 'Africa/Cairo',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({
          name: c.name,
          color: c.color,
          icon: c.icon,
          isDefault: true,
        })),
      },
    },
  })
  const account: LocalAccount = { id: user.id, name, createdAt: new Date().toISOString() }
  const registry = readRegistry()
  registry.push(account)
  writeRegistry(registry)
  setActiveAccountId(user.id)
  return account
}

export function removeLocalAccount(id: string) {
  const registry = readRegistry().filter((a) => a.id !== id)
  writeRegistry(registry)
  if (getActiveAccountId() === id) {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function renameLocalAccount(id: string, name: string) {
  const registry = readRegistry().map((a) => (a.id === id ? { ...a, name } : a))
  writeRegistry(registry)
}
