import * as fs from 'node:fs'
import * as path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as WebSocket from 'ws'

const SUPABASE_AUTH_STORAGE_KEY = 'buglens-supabase-auth'

export interface SupabaseClientConfig {
  url: string
  publishableKey: string
}

export class SupabaseFileStorage {
  constructor(private readonly filePath: string) {}

  getItem(key: string): string | null {
    const values = this.readValues()
    return values[key] ?? null
  }

  setItem(key: string, value: string): void {
    const values = this.readValues()
    values[key] = value
    this.writeValues(values)
  }

  removeItem(key: string): void {
    const values = this.readValues()
    delete values[key]
    this.writeValues(values)
  }

  private readValues(): Record<string, string> {
    try {
      if (!fs.existsSync(this.filePath)) return {}
      const raw = fs.readFileSync(this.filePath, 'utf8')
      if (!raw.trim()) return {}
      const parsed = parseStorageJson(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : { [SUPABASE_AUTH_STORAGE_KEY]: raw }
    } catch {
      return {}
    }
  }

  private writeValues(values: Record<string, string>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(values, null, 2), 'utf8')
  }
}

function parseStorageJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function createPersistentSupabaseClient(
  config: SupabaseClientConfig,
  sessionPath: string,
): SupabaseClient | null {
  if (!config.url.trim() || !config.publishableKey.trim()) return null

  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: new SupabaseFileStorage(sessionPath),
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
    },
    realtime: {
      transport: WebSocket as never,
    },
  })
}
