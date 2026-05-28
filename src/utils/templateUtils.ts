import { ref, get, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS } from '@/utils/fieldTerms'
import type { TemplateFile, TemplatePartDraft, Part, CueItem, CheckItem, FieldType } from '@/types'

// ─── 현재 프로젝트 → .thanq 파일로 내보내기 ──────────────────
export async function exportProjectAsTemplate(
  projectId: string,
  templateName: string,
  description: string,
  authorName: string,
  fieldType: FieldType
): Promise<void> {
  // 파트 로드
  const partsSnap = await get(ref(db, `parts/${projectId}`))
  const parts: Part[] = partsSnap.exists() ? Object.values(partsSnap.val()) : []
  parts.sort((a, b) => a.order - b.order)

  const templateParts: TemplatePartDraft[] = []

  for (const part of parts) {
    // 큐시트 로드
    const cueSnap = await get(ref(db, `cues/${projectId}/${part.id}`))
    const cueItems: CueItem[] = cueSnap.exists() ? Object.values(cueSnap.val()) : []
    cueItems.sort((a, b) => a.order - b.order)

    // 체크리스트 로드
    const checkSnap = await get(ref(db, `checks/${projectId}/${part.id}`))
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

// ─── .thanq 파일 → 새 프로젝트 파트/큐시트에 적용 ────────────
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

    // 큐시트 적용
    for (const [j, cue] of tPart.cueItems.entries()) {
      const cueRef = push(ref(db, `cues/${projectId}/${partId}`))
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

    // 체크리스트 적용
    for (const check of tPart.checkItems) {
      const checkRef = push(ref(db, `checks/${projectId}/${partId}`))
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

// ─── 파일 읽기 유틸 ───────────────────────────────────────────
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
