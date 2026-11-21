import { BadRequestException } from '@nestjs/common'
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { diskStorage } from 'multer'

/**
 * Options Multer réutilisables : enregistre le fichier dans uploads/<dossier>/
 * avec un nom aléatoire (on ne garde jamais le nom choisi par l'utilisateur sur le disque).
 */
export function uploadOptions(folder: string, kind: 'image' | 'pdf', maxMb: number): MulterOptions {
  const dir = join(process.cwd(), 'uploads', folder)
  mkdirSync(dir, { recursive: true })
  return {
    storage: diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase() || (kind === 'pdf' ? '.pdf' : '.jpg')}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = kind === 'image' ? file.mimetype.startsWith('image/') : file.mimetype === 'application/pdf'
      cb(ok ? null : new BadRequestException(kind === 'image' ? 'Le fichier doit être une image (JPG, PNG…).' : 'Le fichier doit être un PDF.'), ok)
    },
  }
}

/** URL publique d'un fichier enregistré */
export const publicUrl = (folder: string, filename: string) => `/api/uploads/${folder}/${filename}`

/** Supprime le fichier lié à une URL publique (silencieux s'il n'existe plus) */
export function removeUpload(url: string | null | undefined) {
  if (!url?.startsWith('/api/uploads/')) return
  rmSync(join(process.cwd(), 'uploads', url.replace('/api/uploads/', '')), { force: true })
}
