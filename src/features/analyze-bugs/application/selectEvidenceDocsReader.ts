import type { GoogleDocContent } from '../../../shared/contracts/bugTypes.js'

export interface EvidenceDocsReader {
  isAuthenticated(): boolean
  readDocuments(urls: string[]): Promise<GoogleDocContent[]>
}

export interface EvidenceDocsReaderSelection {
  reader: EvidenceDocsReader | null
  access: 'browser' | 'oauth' | 'none'
  log: { level: 'info' | 'warn'; message: string }
}

export function selectEvidenceDocsReader(
  browserReader: EvidenceDocsReader,
  oauthReader: EvidenceDocsReader,
): EvidenceDocsReaderSelection {
  if (browserReader.isAuthenticated()) {
    return {
      reader: browserReader,
      access: 'browser',
      log: { level: 'info', message: 'Acceso a Google Docs via sesion del navegador' },
    }
  }

  if (oauthReader.isAuthenticated()) {
    return {
      reader: oauthReader,
      access: 'oauth',
      log: {
        level: 'info',
        message: 'Acceso a Google Docs via OAuth (sin capturas - requiere sesion del navegador)',
      },
    }
  }

  return {
    reader: null,
    access: 'none',
    log: { level: 'warn', message: 'Google no autenticado - bugs sin documentos de evidencia' },
  }
}
