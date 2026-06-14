import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'
import { promisify } from 'node:util'
import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import type { DocImage, GoogleDocContent } from '../types/index.js'

const execFile = promisify(childProcess.execFile)

const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
]

// Extracts document ID from a Google Docs/Drive URL
function extractDocId(docUrl: string): { id: string; type: 'doc' | 'drive' } | null {
  // Google Docs: https://docs.google.com/document/d/<ID>/...
  const docsMatch = docUrl.match(
    /docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/([a-zA-Z0-9_-]+)/,
  )
  if (docsMatch) return { id: docsMatch[1], type: 'doc' }

  // Google Drive: https://drive.google.com/file/d/<ID>/... or ?id=<ID>
  const driveMatch = docUrl.match(
    /drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/,
  )
  if (driveMatch) return { id: driveMatch[1] ?? driveMatch[2], type: 'drive' }

  return null
}

export class GoogleDocsReader {
  private oauth2Client: OAuth2Client
  private tokenPath: string

  constructor(clientId: string, clientSecret: string, tokenPath: string) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/oauth2callback',
    )
    this.tokenPath = tokenPath
  }

  /**
   * Returns true if there's a valid saved token.
   */
  isAuthenticated(): boolean {
    if (!fs.existsSync(this.tokenPath)) return false
    try {
      const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'))
      this.oauth2Client.setCredentials(token)
      return true
    } catch {
      return false
    }
  }

  /**
   * Launches a local HTTP server to handle the OAuth2 callback,
   * then opens the browser for the user to authorize.
   * Returns the authorization URL for the renderer to open.
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    })
  }

  /**
   * Starts a local server on port 3000 to receive the OAuth callback.
   * Resolves with the authenticated client when done.
   */
  async waitForCallback(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsed = url.parse(req.url ?? '', true)
          if (parsed.pathname !== '/oauth2callback') return

          const code = parsed.query['code']
          if (!code || typeof code !== 'string') {
            res.end('Error: no se recibió el código de autorización.')
            reject(new Error('No authorization code received'))
            return
          }

          const { tokens } = await this.oauth2Client.getToken(code)
          this.oauth2Client.setCredentials(tokens)

          // Persist token
          fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true })
          fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2))

          res.end('<html><body><h2>¡Autorizado! Podés cerrar esta ventana.</h2></body></html>')
          server.close()
          resolve()
        } catch (err) {
          res.end('Error durante la autorización.')
          server.close()
          reject(err)
        }
      })

      server.listen(3000, () => {
        console.log('Waiting for Google OAuth callback on http://localhost:3000/oauth2callback')
      })

      server.on('error', reject)

      // Timeout after 5 minutes
      setTimeout(
        () => {
          server.close()
          reject(new Error('OAuth timeout: el usuario no autorizó en 5 minutos'))
        },
        5 * 60 * 1000,
      )
    })
  }

  /**
   * Revokes and deletes the saved token.
   */
  async revokeAuth(): Promise<void> {
    if (fs.existsSync(this.tokenPath)) {
      try {
        await this.oauth2Client.revokeCredentials()
      } catch {
        // ignore revoke errors
      }
      fs.unlinkSync(this.tokenPath)
    }
  }

  /**
   * Reads the content of a Google Doc by URL.
   */
  async readDocument(docUrl: string): Promise<GoogleDocContent> {
    const parsed = extractDocId(docUrl)
    if (!parsed) {
      return {
        url: docUrl,
        title: '',
        text: '',
        accessible: false,
        error: 'URL no reconocida como Google Doc o Drive',
      }
    }

    try {
      if (parsed.type === 'doc') {
        return await this.readGoogleDoc(docUrl, parsed.id)
      } else {
        return await this.readDriveFile(docUrl, parsed.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        url: docUrl,
        title: '',
        text: '',
        accessible: false,
        error: `Error al leer el documento: ${message}`,
      }
    }
  }

  private async readGoogleDoc(docUrl: string, docId: string): Promise<GoogleDocContent> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

    // Export as HTML — get raw bytes so we can detect ZIP (Google returns ZIP for docs with images)
    const exported = await drive.files.export(
      { fileId: docId, mimeType: 'text/html' },
      { responseType: 'arraybuffer' },
    )

    const rawBuf = Buffer.from(exported.data as unknown as ArrayBuffer)

    // ZIP magic bytes PK\x03\x04 — Google wraps HTML+images in a ZIP for rich docs
    if (rawBuf[0] === 0x50 && rawBuf[1] === 0x4b) {
      return await extractFromZipExport(docUrl, rawBuf)
    }

    const html = rawBuf.toString('utf-8')
    const title = extractTitleFromHtml(html) || docId
    const text = htmlToPlainText(html)
    const images = await downloadImagesFromHtml(html, this.oauth2Client)

    return { url: docUrl, title, text, accessible: true, images }
  }

  private async readDriveFile(docUrl: string, fileId: string): Promise<GoogleDocContent> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

    // Get file metadata to know the MIME type
    const meta = await drive.files.get({ fileId, fields: 'name,mimeType' })
    const mimeType = meta.data.mimeType ?? ''
    const title = meta.data.name ?? 'Sin título'

    let text = ''
    let images: DocImage[] = []

    if (mimeType === 'application/vnd.google-apps.document') {
      const exported = await drive.files.export(
        { fileId, mimeType: 'text/html' },
        { responseType: 'arraybuffer' },
      )
      const rawBuf = Buffer.from(exported.data as unknown as ArrayBuffer)
      if (rawBuf[0] === 0x50 && rawBuf[1] === 0x4b) {
        return await extractFromZipExport(docUrl, rawBuf)
      }
      const html = rawBuf.toString('utf-8')
      text = htmlToPlainText(html)
      images = await downloadImagesFromHtml(html, this.oauth2Client)
    } else if (mimeType.startsWith('text/')) {
      const downloaded = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' })
      text = typeof downloaded.data === 'string' ? downloaded.data : ''
    } else {
      text = `[Archivo de tipo ${mimeType} — no se puede extraer texto]`
    }

    return { url: docUrl, title, text, accessible: true, images }
  }

  /**
   * Reads multiple documents, never throwing — errors are embedded in GoogleDocContent.
   */
  async readDocuments(urls: string[]): Promise<GoogleDocContent[]> {
    const results: GoogleDocContent[] = []
    for (const u of urls) {
      results.push(await this.readDocument(u))
    }
    return results
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readdirRecursive(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) results.push(...(await readdirRecursive(full)))
    else results.push(full)
  }
  return results
}

async function extractFromZipExport(url: string, zipBuf: Buffer): Promise<GoogleDocContent> {
  const MAX_IMAGES = 8
  const MIN_BYTES = 2 * 1024
  const MAX_BYTES = 2 * 1024 * 1024

  const tmpZip = path.join(
    os.tmpdir(),
    `gdoc_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`,
  )
  const tmpDir = tmpZip.replace('.zip', '_out')

  try {
    await fs.promises.writeFile(tmpZip, zipBuf)
    await execFile('unzip', ['-o', tmpZip, '-d', tmpDir])

    const allFiles = await readdirRecursive(tmpDir)
    const htmlFile = allFiles.find((f) => f.endsWith('.html'))
    if (!htmlFile) throw new Error('No HTML found in ZIP export')

    const html = await fs.promises.readFile(htmlFile, 'utf-8')
    const text = htmlToPlainText(html)
    const lines = text.split('\n').filter((l) => l.trim())
    const title = extractTitleFromHtml(html) || lines[0]?.slice(0, 100) || 'Sin título'

    const imageFiles = allFiles.filter((f) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(f))
    const images: DocImage[] = []
    for (const imgFile of imageFiles.slice(0, MAX_IMAGES)) {
      try {
        const buf = await fs.promises.readFile(imgFile)
        if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) continue
        const ext = path.extname(imgFile).slice(1).toLowerCase()
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
        images.push({ data: buf.toString('base64'), mimeType })
      } catch {
        /* skip */
      }
    }

    return { url, title, text: text.trim(), accessible: true, images }
  } finally {
    await fs.promises.rm(tmpZip, { force: true }).catch(() => {})
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

function extractTitleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim() : ''
}

function htmlToPlainText(html: string): string {
  // Strip tags, decode common HTML entities
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

async function downloadImagesFromHtml(html: string, auth: OAuth2Client): Promise<DocImage[]> {
  const MAX_IMAGES = 8
  const MIN_BYTES = 2 * 1024
  const MAX_BYTES = 2 * 1024 * 1024

  const imgRe = /<img[^>]+>/gi
  const srcRe = /\bsrc="([^"]+)"/i

  const srcs: string[] = []
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(html)) !== null) {
    const srcMatch = srcRe.exec(m[0])
    if (!srcMatch) continue
    const src = srcMatch[1]
    if (src.startsWith('http') || src.startsWith('data:image/')) srcs.push(src)
  }

  const images: DocImage[] = []
  for (const src of srcs.slice(0, MAX_IMAGES * 2)) {
    if (images.length >= MAX_IMAGES) break
    try {
      if (src.startsWith('data:image/')) {
        const commaIdx = src.indexOf(',')
        if (commaIdx === -1) continue
        const mimeType = src.slice(5, commaIdx).replace(';base64', '').trim()
        const b64 = src.slice(commaIdx + 1)
        const approxBytes = Math.round(b64.length * 0.75)
        if (approxBytes < MIN_BYTES || approxBytes > MAX_BYTES) continue
        images.push({ data: b64, mimeType })
      } else {
        const res = await auth.request<ArrayBuffer>({ url: src, responseType: 'arraybuffer' })
        const buf = Buffer.from(res.data as unknown as ArrayBuffer)
        if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) continue
        const ct = (res.headers as Record<string, string>)['content-type'] ?? ''
        const mimeType = ct.split(';')[0].trim()
        if (!mimeType.startsWith('image/')) continue
        images.push({ data: buf.toString('base64'), mimeType })
      }
    } catch {
      // silently skip failed images
    }
  }
  return images
}
