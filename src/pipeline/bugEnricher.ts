import type { EnrichedBug, GoogleDocContent, RawBug } from '../types/index.js'

// Duck-typed interface — both GoogleDocsReader and BrowserDocsReader satisfy this
interface DocsReader {
  readDocuments(urls: string[]): Promise<GoogleDocContent[]>
}

export class BugEnricher {
  // Cache por URL durante la corrida: un mismo Google Doc suele estar referenciado
  // por muchos bugs (un doc documenta varios). Sin esto se re-descargaba (navegador
  // headless + capturas) una vez POR BUG — el costo dominante del batch.
  private docCache = new Map<string, Promise<GoogleDocContent>>()

  constructor(private docsReader: DocsReader | null) {}

  private fetchDoc(url: string): Promise<GoogleDocContent> {
    let p = this.docCache.get(url)
    if (!p) {
      p = this.docsReader!.readDocuments([url]).then((r) => r[0])
      this.docCache.set(url, p)
    }
    return p
  }

  /**
   * Enriches a single bug: fetches its Google Docs (text + screenshots).
   * Never throws — errors are embedded inside the doc objects.
   */
  async enrich(bug: RawBug): Promise<EnrichedBug> {
    let googleDocs: GoogleDocContent[] = []
    if (bug.googleDocLinks.length > 0 && this.docsReader) {
      googleDocs = await Promise.all(bug.googleDocLinks.map((u) => this.fetchDoc(u)))
    }
    return { raw: bug, googleDocs }
  }

  /**
   * Enriches a list of bugs sequentially, calling the progress callback after each one.
   */
  async enrichAll(
    bugs: RawBug[],
    onProgress?: (current: number, total: number, bugTitle: string) => void,
  ): Promise<EnrichedBug[]> {
    const results: EnrichedBug[] = []
    for (let i = 0; i < bugs.length; i++) {
      const bug = bugs[i]
      onProgress?.(i + 1, bugs.length, bug.title)
      results.push(await this.enrich(bug))
    }
    return results
  }
}
