import { ref, get, push, set, remove, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS, FIELD_LABELS } from '@/utils/fieldTerms'
import type { TemplateFile, TemplatePartDraft, Part, CueItem, CheckItem, FieldType, Project } from '@/types'

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

// ─── 내부 헬퍼: 파트 목록 빌드 ────────────────────────────────
async function buildTemplateParts(projectId: string): Promise<TemplatePartDraft[]> {
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

    // 담당자 정보 불러오기
    const managerSnap = await get(ref(db, `partManagers/${projectId}/${part.id}`))
    const manager = managerSnap.exists() ? managerSnap.val() : null

    templateParts.push({
      name: part.name,
      color: part.color,
      order: part.order,
      isParticipant: part.isParticipant ?? false,
      ...(manager ? { manager } : {}),
      cueItems: cueItems.map((c) => {
        const cueLinkedChecks = checkItems.filter((ch) => ch.cueId === c.id)
        return {
          title: c.title,
          ...(c.dDay !== undefined ? { dDay: c.dDay } : {}),
          ...(c.date ? { date: c.date } : {}),
          startTime: c.startTime,
          durationMin: c.durationMin,
          memo: c.memo,
          ...(cueLinkedChecks.length > 0 ? {
            checkItems: cueLinkedChecks.map((ch) => ({
              title: ch.title,
              category: ch.category,
            }))
          } : {}),
        }
      }),
      checkItems: [],  // 파트 레벨 체크리스트 미사용 - 모든 체크리스트는 큐에 연결
    })
  }

  return templateParts
}

// ─── 내부 헬퍼: 프로젝트 기본 정보 → 템플릿 메타 필드 ────────────
async function buildProjectMeta(projectId: string): Promise<{
  projectName?: string
  prepDate?: string
  eventDate?: string
  eventDateEnd?: string
  startTime?: string
  endTime?: string
  location?: string
  contact?: string
  fieldLabel?: string
}> {
  const projectSnap = await get(ref(db, `projects/${projectId}`))
  if (!projectSnap.exists()) return {}

  const project = projectSnap.val() as Project

  return {
    ...(project.name       ? { projectName:   project.name }      : {}),
    ...(project.prepDate   ? { prepDate:       project.prepDate }  : {}),
    ...(project.date       ? { eventDate:      project.date }      : {}),
    ...(project.dateEnd    ? { eventDateEnd:   project.dateEnd }   : {}),
    ...(project.startTime  ? { startTime:      project.startTime } : {}),
    ...(project.endTime    ? { endTime:        project.endTime }   : {}),
    ...(project.venue      ? { location:       project.venue }     : {}),
    ...(project.overview          ? { contact:          project.overview }          : {}),
    ...(project.estimatedPeople   ? { estimatedPeople:  project.estimatedPeople }   : {}),
    ...(project.budget            ? { budget:            project.budget }            : {}),
    fieldLabel: FIELD_LABELS[project.fieldType]?.label ?? project.fieldType,
  }
}


export async function exportProjectAsTemplate(
  projectId: string,
  templateName: string,
  description: string,
  authorName: string,
  fieldType: FieldType,
  password?: string,      // 비밀번호 (선택)
  allowedEmail?: string   // 허용 이메일 (선택)
): Promise<void> {
  const [templateParts, projectMeta] = await Promise.all([
    buildTemplateParts(projectId),
    buildProjectMeta(projectId),
  ])

  const templateFile: TemplateFile = {
    version: '1.0',
    name: templateName,
    fieldType,
    description,
    authorName,
    createdAt: new Date().toISOString(),
    parts: templateParts,
    ...projectMeta,
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

// ─── 현재 프로젝트 → JSON string으로 반환 (다운로드 + 보관함 저장 겸용) ──
export async function exportProjectAsTemplateJson(
  projectId: string,
  templateName: string,
  description: string,
  authorName: string,
  fieldType: FieldType,
  password?: string,
  allowedEmail?: string
): Promise<string> {
  const [templateParts, projectMeta] = await Promise.all([
    buildTemplateParts(projectId),
    buildProjectMeta(projectId),
  ])

  const templateFile: TemplateFile = {
    version: '1.0',
    name: templateName,
    fieldType,
    description,
    authorName,
    createdAt: new Date().toISOString(),
    parts: templateParts,
    ...projectMeta,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
    ...(allowedEmail ? { allowedEmail: allowedEmail.trim().toLowerCase() } : {}),
  }

  return JSON.stringify(templateFile, null, 2)
}

// ─── .thanq 파일 → 프로젝트 파트/큐시트에 적용 ───────────────
export async function applyTemplateToProject(
  projectId: string,
  template: TemplateFile,
  replaceMode: boolean = false
): Promise<void> {

  // 프로젝트 기본 정보 업데이트 (템플릿에 값이 있을 때만)
  const metaUpdate: Record<string, string> = {}
  if (template.projectName)  metaUpdate.name      = template.projectName
  if (template.prepDate)     metaUpdate.prepDate   = template.prepDate
  if (template.eventDate)    metaUpdate.date       = template.eventDate
  if (template.eventDateEnd) metaUpdate.dateEnd    = template.eventDateEnd
  if (template.startTime)    metaUpdate.startTime  = template.startTime
  if (template.endTime)      metaUpdate.endTime    = template.endTime
  if (template.location)     metaUpdate.venue      = template.location
  if (template.estimatedPeople) (metaUpdate as any).estimatedPeople = template.estimatedPeople
  if (template.budget)          (metaUpdate as any).budget           = template.budget
  if (Object.keys(metaUpdate).length > 0) {
    await update(ref(db, `projects/${projectId}`), metaUpdate)
  }

  // 덮어쓰기 모드: 기존 파트·큐·체크리스트 전체 삭제
  if (replaceMode) {
    const existingPartsSnap = await get(ref(db, `parts/${projectId}`))
    if (existingPartsSnap.exists()) {
      const existingParts: Part[] = Object.values(existingPartsSnap.val())
      for (const part of existingParts) {
        await remove(ref(db, `cueItems/${projectId}/${part.id}`))
        await remove(ref(db, `checkItems/${projectId}/${part.id}`))
        await remove(ref(db, `parts/${projectId}/${part.id}`))
      }
    }
  }
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
      isParticipant: tPart.isParticipant ?? false,
      status: 'waiting',
      progress: 0,
      createdAt: new Date().toISOString(),
    })

    // 담당자 정보 복원
    if ((tPart as any).manager) {
      await set(ref(db, `partManagers/${projectId}/${partId}`), (tPart as any).manager)
    }

    for (const [j, cue] of tPart.cueItems.entries()) {
      const cueRef = push(ref(db, `cueItems/${projectId}/${partId}`))
      const cueId = cueRef.key!
      await set(cueRef, {
        id: cueId,
        partId,
        projectId,
        order: j,
        title: cue.title,
        ...(cue.dDay !== undefined ? { dDay: cue.dDay } : {}),
        ...(cue.date ? { date: cue.date } : {}),
        startTime: cue.startTime,
        durationMin: cue.durationMin,
        memo: cue.memo ?? null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // 큐 항목에 직접 연결된 체크리스트 생성 (cueId 연결)
      if (cue.checkItems && cue.checkItems.length > 0) {
        for (const check of cue.checkItems) {
          const checkRef = push(ref(db, `checkItems/${projectId}/${partId}`))
          await set(checkRef, {
            id: checkRef.key,
            partId,
            projectId,
            cueId,           // ← 큐와 연결
            category: check.category,
            title: check.title,
            isDone: false,
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    // 파트 레벨 체크리스트 미사용 - 모든 체크리스트는 큐에 연결됨
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
