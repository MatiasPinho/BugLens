import * as fs from 'node:fs'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as path from 'node:path'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import * as WebSocket from 'ws'

const SUPABASE_AUTH_STORAGE_KEY = 'buglens-supabase-auth'
const GOOGLE_AUTH_TIMEOUT_MS = 120_000

export interface SupabaseTeamConfig {
  url: string
  publishableKey: string
  defaultProjectSlug: string
  defaultProjectName: string
  activeProjectId?: string
}

export interface TeamProject {
  id: string
  name: string
  slug: string
}

export interface SupabaseTeamStatus {
  configured: boolean
  authenticated: boolean
  user?: {
    id: string
    email?: string
  }
  project?: TeamProject
  projects?: TeamProject[]
  error?: string
}

interface DefaultProjectRpcRow {
  project_id: string
  project_name_result: string
  project_slug_result: string
}

class SupabaseFileStorage {
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
      const parsed = JSON.parse(raw) as unknown
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

export function createSupabaseTeamClient(
  config: SupabaseTeamConfig,
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

export async function getSupabaseTeamStatus(
  client: SupabaseClient | null,
  config: SupabaseTeamConfig,
): Promise<SupabaseTeamStatus> {
  if (!client) return { configured: false, authenticated: false }

  const { data, error } = await client.auth.getUser()
  if (error || !data.user) {
    return { configured: true, authenticated: false, error: error?.message }
  }

  let projects = await listSupabaseProjects(client)
  if (projects.length === 0) {
    const project = await ensureDefaultProject(client, config)
    projects = [project]
  }
  const project =
    projects.find((item) => item.id === config.activeProjectId) ??
    projects.find((item) => item.slug === config.defaultProjectSlug) ??
    projects[0]
  return {
    configured: true,
    authenticated: true,
    user: serializeUser(data.user),
    project,
    projects,
  }
}

export async function startSupabaseGoogleAuth(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  electronShell: { openExternal(url: string): Promise<void> },
): Promise<SupabaseTeamStatus> {
  const { server, redirectTo, waitForCode } = await createLocalCallbackServer()

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })
    if (error) throw error
    if (!data.url) throw new Error('Supabase no devolvió una URL de autenticación.')

    await electronShell.openExternal(data.url)
    const code = await waitForCode

    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError

    const defaultProject = await ensureDefaultProject(client, config)
    const projects = await listSupabaseProjects(client)
    const project =
      projects.find((item) => item.id === config.activeProjectId) ??
      projects.find((item) => item.id === defaultProject.id) ??
      defaultProject
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('No se pudo leer el usuario autenticado.')

    return {
      configured: true,
      authenticated: true,
      user: serializeUser(user),
      project,
      projects: projects.length > 0 ? projects : [project],
    }
  } finally {
    server.close()
  }
}

export async function signOutSupabaseTeam(client: SupabaseClient | null): Promise<void> {
  if (!client) return
  await client.auth.signOut()
}

async function ensureDefaultProject(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
): Promise<TeamProject> {
  const existing = await findDefaultProject(client, config.defaultProjectSlug)
  if (existing) return existing

  const { data, error } = await client
    .rpc('ensure_default_project', {
      project_name: config.defaultProjectName,
      project_slug: config.defaultProjectSlug,
    })
    .single()

  if (error) throw error
  const project = data as DefaultProjectRpcRow
  return {
    id: project.project_id,
    name: project.project_name_result,
    slug: project.project_slug_result,
  }
}

export async function listSupabaseProjects(client: SupabaseClient): Promise<TeamProject[]> {
  const { data, error } = await client
    .from('projects')
    .select('id, name, slug')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createSupabaseProject(
  client: SupabaseClient,
  name: string,
  slug: string,
): Promise<TeamProject> {
  const { data, error } = await client
    .rpc('create_project', {
      project_name: name,
      project_slug: slug,
    })
    .single()

  if (error) throw error
  const project = data as DefaultProjectRpcRow
  return {
    id: project.project_id,
    name: project.project_name_result,
    slug: project.project_slug_result,
  }
}

async function findDefaultProject(
  client: SupabaseClient,
  slug: string,
): Promise<TeamProject | null> {
  const { data, error } = await client
    .from('projects')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data
}

function serializeUser(user: User): SupabaseTeamStatus['user'] {
  return {
    id: user.id,
    email: user.email,
  }
}

async function createLocalCallbackServer(): Promise<{
  server: http.Server
  redirectTo: string
  waitForCode: Promise<string>
}> {
  let settleCode: (code: string) => void
  let settleError: (err: Error) => void

  const waitForCode = new Promise<string>((resolve, reject) => {
    settleCode = resolve
    settleError = reject
  })

  const timeout = setTimeout(() => {
    settleError(new Error('Tiempo agotado esperando el login de Google.'))
  }, GOOGLE_AUTH_TIMEOUT_MS)

  const server = http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (requestUrl.pathname !== '/auth/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = requestUrl.searchParams.get('code')
      const error =
        requestUrl.searchParams.get('error_description') ?? requestUrl.searchParams.get('error')
      if (error) throw new Error(error)
      if (!code) throw new Error('Google no devolvió código de autenticación.')

      clearTimeout(timeout)
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<html><body><p>Login completado. Ya podés volver a buglens.</p></body></html>')
      settleCode(code)
    } catch (err) {
      clearTimeout(timeout)
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(err instanceof Error ? err.message : String(err))
      settleError(err instanceof Error ? err : new Error(String(err)))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  return {
    server,
    redirectTo: `http://127.0.0.1:${address.port}/auth/callback`,
    waitForCode,
  }
}
