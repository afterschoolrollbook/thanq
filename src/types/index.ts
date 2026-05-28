// ─── 사용자 & 권한 ───────────────────────────────────────
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest'

export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  emailVerified: boolean
  createdAt: string
  isPro?: boolean   // Pro 플랜 여부 (Firebase users/{uid}/isPro)
}

// ─── 분야 ────────────────────────────────────────────────
export type FieldType =
  | 'event'      // 행사/축제
  | 'film'       // 드라마/영화
  | 'concert'    // 콘서트/공연
  | 'fashion'    // 패션쇼
  | 'sports'     // 스포츠/대회
  | 'broadcast'  // 방송/생방송
  | 'club'       // 모임/클럽
  | 'custom'     // 직접 입력

export interface FieldTerms {
  headquarters: string    // 본부, 제작본부, 운영본부, ...
  part: string           // 파트, 팀, 부서, ...
  manager: string        // 담당자, 팀장, 책임자, ...
  cuesheet: string       // 큐시트, 씬 목록, 세트리스트, ...
  checklist: string      // 체크리스트
}

// ─── 프로젝트 ─────────────────────────────────────────────
export type ProjectStatus = 'planning' | 'ready' | 'live' | 'done'

export interface Project {
  id: string
  name: string
  fieldType: FieldType
  fieldTerms: FieldTerms
  date: string           // ISO date string
  startTime: string      // HH:mm
  endTime: string        // HH:mm
  venue: string
  estimatedPeople: number
  budget?: number
  overview?: string
  status: ProjectStatus
  ownerId: string
  joinCode: string
  createdAt: string
  updatedAt: string
}

// ─── 파트 ────────────────────────────────────────────────
export type PartStatus = 'waiting' | 'ready' | 'ongoing' | 'done' | 'delay'

export interface Part {
  id: string
  projectId: string
  name: string
  color: string          // hex code
  managerId?: string
  managerName?: string
  status: PartStatus
  progress: number       // 0~100
  order: number
  createdAt: string
}

// ─── 큐시트 항목 ───────────────────────────────────────────
export type CueStatus = 'pending' | 'ongoing' | 'done' | 'delay'

export interface CueItem {
  id: string
  partId: string
  projectId: string
  order: number
  title: string
  startTime: string      // HH:mm
  durationMin: number
  assignee?: string
  memo?: string
  status: CueStatus
  createdAt: string
  updatedAt: string
}

// ─── 체크리스트 ───────────────────────────────────────────
export type CheckCategory = 'prep' | 'contact' | 'setup' | 'custom'

export interface CheckItem {
  id: string
  partId: string
  projectId: string
  category: CheckCategory
  title: string
  isDone: boolean
  dueDate?: string
  assignee?: string
  createdAt: string
}

// ─── 이슈 / 메모 ──────────────────────────────────────────
export type IssueLevel = 'info' | 'warning' | 'urgent'

export interface Issue {
  id: string
  partId: string
  projectId: string
  level: IssueLevel
  content: string
  authorId: string
  authorName: string
  isResolved: boolean
  createdAt: string
}

// ─── 공지 / 소통 ──────────────────────────────────────────
export type NoticeType = 'notice' | 'urgent' | 'meeting' | 'file'

export interface Notice {
  id: string
  projectId: string
  type: NoticeType
  title: string
  content: string
  targetPartIds: string[]   // 빈 배열 = 전체
  authorId: string
  authorName: string
  readByUids: string[]
  createdAt: string
}

// ─── 멤버십 ───────────────────────────────────────────────
export interface ProjectMember {
  uid: string
  projectId: string
  partId?: string
  role: UserRole
  displayName: string
  joinedAt: string
}

// ─── 블로그 ───────────────────────────────────────────────
export type BlogCategory = 'notice' | 'tip' | 'template' | 'free'

export interface BlogPost {
  id: string
  title: string
  content: string
  category: BlogCategory
  authorId: string
  authorName: string
  likes: number
  viewCount: number
  templateFile?: string   // JSON string (템플릿 첨부 시)
  templateName?: string   // 첨부 템플릿 이름
  createdAt: string
  updatedAt: string
}

// ─── 템플릿 파일 구조 ─────────────────────────────────────
export interface TemplatePartDraft {
  name: string
  color: string
  order: number
  cueItems: Array<{
    title: string
    startTime: string
    durationMin: number
    memo?: string
  }>
  checkItems: Array<{
    title: string
    category: string
  }>
}

export interface TemplateFile {
  version: '1.0'
  name: string
  fieldType: FieldType
  description: string
  authorName: string
  createdAt: string
  parts: TemplatePartDraft[]
  passwordHash?: string    // SHA-256 해시 (비밀번호 설정 시)
  allowedEmail?: string    // 허용된 이메일 (설정 시 해당 이메일 로그인한 사람만 열람 가능)
}

// ─── 쿠폰 ────────────────────────────────────────────────
/**
 * Firebase Realtime DB: coupons/{CODE}
 *
 * type
 *   'duration'  — N일 무료 Pro (마케팅/회원가입 유도용)
 *   'permanent' — 영구 Pro 전환
 *
 * maxUses  0 = 무제한
 * usedBy   { [uid]: ISO 사용 일시 }
 * expiresAt  쿠폰 자체 유효기간 (지나면 사용 불가)
 */
export interface Coupon {
  code: string
  type: 'duration' | 'permanent'
  durationDays?: number              // type === 'duration' 일 때 필수
  maxUses: number                    // 0 = 무제한
  usedCount: number
  usedBy?: Record<string, string>    // uid → 사용 일시 (ISO string)
  createdAt: string
  expiresAt?: string                 // 쿠폰 자체 만료일 (ISO string)
  memo: string                       // 관리자용 메모
  active: boolean
}
