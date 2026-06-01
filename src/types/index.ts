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
  | 'party'      // 기념일/파티
  | 'cooking'    // 요리/클래스
  | 'study'      // 스터디/독서모임
  | 'travel'     // 여행/캠핑
  | 'social'     // 소셜다이닝/미팅
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
  prepDate?: string      // 준비 시작일 (ISO date)
  date: string           // 행사 시작일 (D-day 기준, ISO date)
  dateEnd?: string       // 행사 종료일 (여러 날 행사일 때만)
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
  isParticipant?: boolean  // true = 참가자 그룹, false/undefined = 행사진행 파트
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
  dDay?: number          // 행사일 기준 상대 일수 (0=당일, -1=D-1, -7=D-7 등)
  date?: string          // ISO date string (YYYY-MM-DD) — 미설정 시 행사 당일
  startTime: string      // HH:mm
  durationMin: number
  assignee?: string
  assigneeName?: string
  memo?: string
  status: CueStatus
  cardColor?: string     // 큐카드 개별 색상 (미설정 시 파트 색상 사용)
  photos?: Record<string, { url: string; name: string; uploadedAt: string }>
  createdAt: string
  updatedAt: string
}

// ─── 체크리스트 ───────────────────────────────────────────
export type CheckCategory = 'prep' | 'contact' | 'setup' | 'custom'

export interface CheckItem {
  id: string
  partId: string
  projectId: string
  cueId?: string        // 연결된 큐시트 항목 ID (선택)
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
  isParticipant?: boolean  // true = 참가자 그룹
  cueItems: Array<{
    title: string
    dDay?: number          // 행사일 기준 상대 일수 (0=당일, -1=D-1, -7=D-7 등)
    date?: string          // ISO date string (YYYY-MM-DD)
    startTime: string
    durationMin: number
    memo?: string
    checkItems?: Array<{   // 큐 항목에 직접 연결된 체크리스트
      title: string
      category: string
    }>
  }>
  checkItems: never[]      // 파트 레벨 체크리스트 미사용
  manager?: { name: string; alias: string; phone: string; email: string } // 담당자 정보
}

export interface TemplateFile {
  version: '1.0'
  name: string
  fieldType: FieldType
  fieldLabel?: string      // 분야 표시 레이블 (예: '모임 / 클럽')
  description: string
  authorName: string
  partnersId?: string      // 쿠팡 파트너스 ID (재료 링크 수익용)
  createdAt: string
  parts: TemplatePartDraft[]
  passwordHash?: string    // SHA-256 해시 (비밀번호 설정 시)
  allowedEmail?: string    // 허용된 이메일 (설정 시 해당 이메일 로그인한 사람만 열람 가능)
  // 프로젝트 기본 정보 (템플릿에서 자동 채우기용)
  projectName?: string     // 행사명 예시
  prepDate?: string        // 준비 시작일 예시 (ISO date)
  eventDate?: string       // 행사 시작일 예시 (ISO date)
  eventDateEnd?: string    // 행사 종료일 예시 (여러 날)
  startTime?: string       // 행사 시작 시간 (HH:mm)
  endTime?: string         // 행사 종료 시간 (HH:mm)
  location?: string        // 장소 예시
  contact?: string         // 연락처 예시
  estimatedPeople?: number // 예상 인원
  budget?: number          // 예산
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
