import { ref, get, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS } from '@/utils/fieldTerms'
import type { TemplateFile, TemplatePartDraft, Part, CueItem, CheckItem, FieldType } from '@/types'

// ─── 비밀번호 해시 / 검증 ─────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash
}

// ─── 이메일 검증 ──────────────────────────────────────────────
// 파일에 allowedEmail이 설정된 경우, 현재 로그인된 이메일과 일치해야 열람 가능
export function verifyEmail(currentUserEmail: string | null | undefined, allowedEmail: string): boolean {
  if (!currentUserEmail) return false
  return currentUserEmail.trim().toLowerCase() === allowedEmail.trim().toLowerCase()
}

// ─── 템플릿 잠금 상태 확인 ────────────────────────────────────
// 반환값: 'email' | 'password' | 'both' | null
export function getTemplateLockType(tmpl: TemplateFile): 'email' | 'password' | 'both' | null {
  const hasEmail = !!tmpl.allowedEmail
  const hasPw = !!tmpl.passwordHash
  if (hasEmail && hasPw) return 'both'
  if (hasEmail) return 'email'
  if (hasPw) return 'password'
  return null
}

// ─── 현재 프로젝트 → .thanq 파일로 내보내기 ──────────────────
export async function exportProjectAsTemplate(
  projectId: string,
  templateName: string,
  description: string,
  authorName: string,
  fieldType: FieldType,
  password?: string,      // 비밀번호 (선택)
  allowedEmail?: string   // 허용 이메일 (선택)
): Promise<void> {
  const partsSnap = await get(ref(db, `parts/${projectId}`))
  const parts: Part[] = partsSnap.exists() ? Object.values(partsSnap.val()) : []
  parts.sort((a, b) => a.order - b.order)

  const templateParts: TemplatePartDraft[] = []

  for (const part of parts) {
    const cueSnap = await get(ref(db, `cueItems/${projectId}/${part.id}`))
    const cueItems: CueItem[] = cueSnap.exists() ? Object.values(cueSnap.val()) : []
    cueItems.sort((a, b) => a.order - b.order)

    const checkSnap = await get(ref(db, `checkItems/${projectId}/${part.id}`))
    const checkItems: CheckItem[] = checkSnap.exists() ? Object.values(checkSnap.val()) : []

    templateParts.push({
      name: part.name,
      color: part.color,
      order: part.order,
      cueItems: cueItems.map((c) => ({
        title: c.title,
        startTime: c.startTime,
        durationMin: c.durationMin,
        memo: c.memo,
      })),
      checkItems: checkItems.map((c) => ({
        title: c.title,
        category: c.category,
      })),
    })
  }

  const templateFile: TemplateFile = {
    version: '1.0',
    name: templateName,
    fieldType,
    description,
    authorName,
    createdAt: new Date().toISOString(),
    parts: templateParts,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
    ...(allowedEmail ? { allowedEmail: allowedEmail.trim().toLowerCase() } : {}),
  }

  const json = JSON.stringify(templateFile, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${templateName}.thanq`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── .thanq 파일 → 프로젝트 파트/큐시트에 적용 ───────────────
export async function applyTemplateToProject(
  projectId: string,
  template: TemplateFile
): Promise<void> {
  for (const [i, tPart] of template.parts.entries()) {
    const partRef = push(ref(db, `parts/${projectId}`))
    const partId = partRef.key!
    const color = tPart.color || PART_COLORS[i % PART_COLORS.length]

    await set(partRef, {
      id: partId,
      projectId,
      name: tPart.name,
      color,
      order: tPart.order ?? i,
      status: 'waiting',
      progress: 0,
      createdAt: new Date().toISOString(),
    })

    for (const [j, cue] of tPart.cueItems.entries()) {
      const cueRef = push(ref(db, `cueItems/${projectId}/${partId}`))
      await set(cueRef, {
        id: cueRef.key,
        partId,
        projectId,
        order: j,
        title: cue.title,
        startTime: cue.startTime,
        durationMin: cue.durationMin,
        memo: cue.memo ?? null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    for (const check of tPart.checkItems) {
      const checkRef = push(ref(db, `checkItems/${projectId}/${partId}`))
      await set(checkRef, {
        id: checkRef.key,
        partId,
        projectId,
        category: check.category,
        title: check.title,
        isDone: false,
        createdAt: new Date().toISOString(),
      })
    }
  }
}

// ─── 파일 읽기 ────────────────────────────────────────────────
export function readTemplateFile(file: File): Promise<TemplateFile> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.thanq')) {
      reject(new Error('ThanQ 템플릿 파일(.thanq)만 가져올 수 있어요'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as TemplateFile
        if (parsed.version !== '1.0' || !Array.isArray(parsed.parts)) {
          reject(new Error('올바른 ThanQ 템플릿 파일이 아니에요'))
          return
        }
        resolve(parsed)
      } catch {
        reject(new Error('파일을 읽을 수 없어요'))
      }
    }
    reader.readAsText(file)
  })
}
