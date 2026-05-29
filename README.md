# ThanQ

> 현장의 모든 사람이 지금 이 순간 뭘 해야 하는지 아는 플랫폼

**ThanQ** = 큐시트(Q) + 한눈에 + 한번에 + 감사(Thank)  
행사, 촬영, 콘서트 등 대규모 현장 운영을 위한 실시간 협업 플랫폼입니다.

- **GitHub**: [afterschoolrollbook/thanq](https://github.com/afterschoolrollbook/thanq)
- **배포 URL**: [thanq-beta.vercel.app](https://thanq-beta.vercel.app)
- **Firebase 프로젝트**: thanq-dc193

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript |
| 스타일링 | Tailwind CSS |
| 상태관리 | Zustand |
| 라우팅 | React Router v6 |
| 백엔드/DB | Firebase (Auth + Realtime DB) |
| 실시간 음성 | WebRTC (푸시투토크 무전) |
| 알림 | Firebase Cloud Messaging (FCM) |
| 에러 추적 | Sentry |
| 배포 | Vercel |

---

## 적용 분야

| 분야 | 주요 기능 |
|------|----------|
| 행사 / 축제 | 부스별 큐시트, 혼잡도, 긴급 공지 |
| 드라마 / 영화 | 씬 큐시트, 콜시트, NG 기록 |
| 콘서트 / 공연 | 세트리스트, 무대 전환, 앙코르 플랜 |
| 패션쇼 | 런웨이 큐시트, 모델 대기, 의상 체크 |
| 스포츠 / 대회 | 경기 진행표, 구역 운영, 응급 대응 |
| 방송 / 생방송 | 방송 큐시트, 카메라 큐, 자막 타이밍 |
| 모임 / 클럽 | 코스 일정, 출발 체크리스트, 그룹 관리 |

---

## 화면 목록 (총 20개)

### 공개 페이지 (로그인 불필요)

| # | 경로 | 화면 | 상태 |
|---|------|------|------|
| 1 | `/` | 메인 랜딩 페이지 | ✅ 완성 |
| 2 | `/login` | 로그인 / 회원가입 | ✅ 완성 |
| 3 | `/blog` | 블로그 목록 | ✅ 완성 |
| 4 | `/blog/:postId` | 블로그 게시글 상세 | ✅ 완성 |
| 5 | `/templates` | 템플릿 공유 목록 | ✅ 완성 |

### 로그인 필요

| # | 경로 | 화면 | 상태 |
|---|------|------|------|
| 6 | `/dashboard` | 메인 대시보드 | ✅ 완성 |
| 7 | `/projects` | 내 프로젝트 목록 | ✅ 완성 |
| 8 | `/blog/write` | 블로그 글쓰기 (템플릿 첨부 가능) | ✅ 완성 |
| 9 | `/onboarding/field` | 분야 선택 | ✅ 완성 |
| 10 | `/onboarding/create` | 프로젝트 생성 | ✅ 완성 |
| 11 | `/onboarding/parts/:id` | 파트 구성 & 초대 | ✅ 완성 |
| 12 | `/p/:id/home` | 프로젝트 홈 (템플릿 내보내기/가져오기) | ✅ 완성 |
| 13 | `/p/:id/my-part` | 담당자 작업 화면 (큐시트 + 체크리스트) | ✅ 완성 |
| 14 | `/p/:id/dashboard` | 본부 대시보드 | ✅ 완성 |
| 15 | `/p/:id/timeline` | 통합 타임라인 | ✅ 완성 |
| 16 | `/p/:id/comms` | 소통 허브 | ✅ 완성 |
| 17 | `/p/:id/live` | 당일 실시간 운영 | ✅ 완성 |
| 18 | `/p/:id/ptt` | 🎙️ 무전 (푸시투토크) | ✅ 완성 |
| 19 | `/p/:id/admin` | 프로젝트 관리자 | ✅ 완성 |

### 관리자 (Firebase DB admins 등록 필요)

| # | 경로 | 화면 | 상태 |
|---|------|------|------|
| 20 | `/admin` | 사이트 전체 관리자 콘솔 | ✅ 완성 |

---

## 개발 시작

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

> **주의**: 실행 전 반드시 `.env` 파일에 Firebase 환경 변수를 설정하세요.

---

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 값을 입력합니다:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Firebase Console → 프로젝트 설정 → 앱에서 확인할 수 있습니다.

---

## Vercel 배포

1. GitHub 저장소를 [Vercel](https://vercel.com)에 연결
2. Environment Variables에 위 Firebase 설정값 입력
3. Deploy → `thanq-beta.vercel.app` 완료!

`vercel.json`에 SPA 라우팅 처리가 포함되어 있습니다.

---

## 플랜 구성

| 기능 | Free | Pro (₩9,900/월) |
|------|------|----------------|
| 프로젝트 생성 | ✅ | ✅ |
| 파트 직접 입력 | ✅ | ✅ |
| 큐시트 · 체크리스트 | ✅ | ✅ |
| 팀원 초대 | ✅ | ✅ |
| 템플릿 저장 · 불러오기 | ❌ | ✅ |
| PTT 무전 | ❌ | ✅ |

### 쿠폰 시스템

Pro 업그레이드 시 쿠폰 코드 입력 가능. 쿠폰 종류:
- `duration` — N일 무료 Pro 제공 (마케팅/회원가입 유도용)
- `permanent` — 영구 Pro 전환

쿠폰은 관리자 콘솔(`/admin` → 쿠폰 탭)에서 생성 및 관리합니다.

---

## 템플릿 파일 (.thanq) 시스템

회원 간 행사 구성을 파일로 주고받는 기능입니다.

### 흐름

```
[프로젝트 홈] → "템플릿으로 저장" → .thanq 파일 다운로드
      ↓
[블로그 글쓰기] → .thanq 파일 첨부 → 게시
      ↓
[/templates 페이지] → 누구나 탐색 및 다운로드
      ↓
[프로젝트 홈] → "템플릿 가져오기" → 파트 + 큐시트 + 체크리스트 자동 세팅
```

### 파일 구조 (JSON)

```json
{
  "version": "1.0",
  "name": "템플릿 이름",
  "fieldType": "event",
  "description": "설명",
  "authorName": "작성자",
  "createdAt": "ISO 날짜",
  "parts": [
    {
      "name": "파트명",
      "color": "#hex",
      "order": 0,
      "cueItems": [
        { "title": "항목명", "startTime": "14:00", "durationMin": 30, "memo": "메모" }
      ],
      "checkItems": [
        { "title": "체크항목", "category": "준비물" }
      ]
    }
  ]
}
```

---

## 관리자 설정

Firebase Realtime Database에서 직접 등록합니다.

```
admins
└── {사용자 UID}: true
```

UID는 Firebase Console → Authentication → Users에서 확인합니다.  
등록 후 `/admin` 경로에서 사이트 전체 관리자 콘솔에 접근할 수 있습니다.

> 접근 제어: 미로그인 → PrivateRoute 차단 / 로그인 + 비관리자 → 권한 없음 화면 / 로그인 + admins/{uid}: true → 콘솔 표시

---

### 관리자 콘솔 — 6개 탭 상세

#### ① 대시보드 (`dashboard`)

서비스 전체 현황을 한눈에 파악합니다.

| 카드 | 데이터 출처 |
|------|------------|
| 전체 회원 수 | `users/` 노드 항목 수 (실시간) |
| 전체 프로젝트 수 | `projects/` 노드 항목 수 (실시간) |
| 오늘 활성 수 | 당일 접속 기록 (구현 예정) |
| PTT 호출 수 | `pttHistory/` 누적 건수 (실시간) |

하단에 **요금제 분포**(Free/Pro 회원 수)와 **쿠폰 현황**(발행 수·활성 수·총 사용 횟수) 요약 카드가 표시됩니다.

#### ② 회원 관리 (`users`)

전체 회원 목록을 조회하고 플랜을 수동으로 변경합니다.

- 이름 또는 이메일로 실시간 필터링
- 회원별 이메일, 이름, 현재 플랜(Free/Pro), Pro 만료일(`proExpiresAt`) 표시
- 드롭다운으로 Free ↔ Pro 즉시 전환 → `users/{uid}/isPro` Firebase 업데이트

#### ③ PTT AI (`ptt`)

음성 명령으로 프로젝트 PTT 채널에 연결하는 관리자 전용 AI 무전 기능입니다.

- 드롭다운으로 프로젝트를 선택하면 파트 목록과 채널이 자동 로드됩니다.
- 채널 구성: **총책임자(1번)** → 파트 담당자(2번~) → 크루 전체(마지막번)
- AI 버튼을 누르고 채널 번호나 이름을 말하면 Claude API가 대상을 파악해 자동 연결합니다.
- 연결 완료 시 "{번호}번, {이름}에게 연결이 되었습니다" TTS 음성이 자동 출력됩니다.
- 관리자 연결은 `pttHistory/{projectId}`에 `[관리자]` 접두사로 기록됩니다.

**음성 파싱 우선순위:** ① "N번" 숫자 매칭 → ② 이름/파트명 직접 매칭 → ③ "전체"/"크루" 키워드 → ④ Claude API 자연어 분석

**연결 상태:** `idle` → `listening` → `processing` → `connected` 4단계

#### ④ 쿠폰 발행 (`coupons`)

Pro 플랜 무료 제공을 위한 쿠폰을 생성·관리합니다.

**발행 옵션:**

| 항목 | 설명 |
|------|------|
| 쿠폰 코드 | 직접 입력 또는 자동 생성 (`XXXX-XXXX` 형식, 중복 불가) |
| 쿠폰 종류 | `duration` (기간 무료) / `permanent` (영구 Pro) |
| 무료 기간 | 7일 / 14일 / 30일 / 90일 버튼 또는 직접 입력 (`duration` 전용) |
| 최대 사용 횟수 | 0(무제한) / 1 / 10 / 50 / 100 선택 |
| 쿠폰 만료일 | 이 날짜 이후 코드 자체가 사용 불가 (선택) |
| 관리자 메모 | 내부용 메모, 사용자에게 표시되지 않음 (선택) |

**목록 관리:** 활성/비활성 토글 슬라이더 · 삭제(confirm 팝업) · 만료됨/소진됨 상태 배지 자동 표시

#### ⑤ 플랜 (`plans`)

현재 운영 중인 요금제 구성을 확인합니다.

| 플랜 | 가격 | 주요 기능 |
|------|------|----------|
| Free | 무료 | 프로젝트 생성, 파트 입력, 큐시트·체크리스트, 팀원 초대 |
| Pro | ₩9,900/월 | Free 전체 + 템플릿 저장·불러오기, PTT 무전, 우선 지원 |

현재는 쿠폰으로만 Pro 활성화가 가능합니다. 카드 결제(Stripe) 연동은 Phase 4에서 추가 예정입니다.

#### ⑥ 공지 (`notice`)

전체 사용자에게 공지를 발송합니다.

- 텍스트 영역에 내용 입력 후 "전체 발송" 클릭
- Firebase `siteNotices/` 에 저장 → 앱에서 배너/알림으로 표시
- 발송 완료 시 "✓ 공지가 발송되었어요" 3초 표시 후 폼 초기화

---

## 🎙️ 무전 기능 (푸시투토크)

현장 무전기를 앱으로 대체 — 버튼을 누르는 동안 실시간 음성이 전송됩니다.

### 동작 방식

- 🔴 버튼 누르는 동안 → 녹음 + 실시간 전송
- 🟢 손 떼면 → 자동 전송 완료
- 📱 상대방 폰에서 자동 재생 (백그라운드에서도 동작)

### 전송 대상 선택

- **전체 전송** — 프로젝트 전원에게
- **파트 전송** — 특정 파트(음향팀, 무대팀 등)에게만
- **1:1 전송** — 특정 담당자에게만

### PTT 추가 기능

| 기능 | 설명 |
|------|------|
| 즐겨찾기 | 자주 연락하는 대상 상단 고정 |
| 단축키 | 숫자 키(1~9)로 대상 즉시 선택 |
| 별명 설정 | 대상에 커스텀 이름 지정 |
| 오디오 기기 선택 | 마이크 입력 장치 직접 선택 |
| 권한 그룹 | 총괄 / 담당자 / 전체 3단계로 구분 표시 |

### 기술 구현

| 기술 | 역할 |
|------|------|
| WebRTC | 실시간 P2P 음성 스트리밍 |
| Firebase Realtime DB | 채널 상태 및 수신자 관리 |
| Web Audio API | 마이크 입력 처리 |
| FCM | 백그라운드 수신 알림 |

---

## Firebase DB 구조

```
/
├── admins/{uid}                          # 사이트 관리자 여부
├── users/{uid}                           # 사용자 정보 및 플랜
├── blog/{postId}                         # 블로그 게시글 (템플릿 첨부 포함)
├── blogLikes/{postId}/{uid}              # 블로그 좋아요
├── coupons/{code}                        # 쿠폰 정보
├── drafts/{uid}                          # 프로젝트 생성 임시저장
├── projects/{projectId}                  # 프로젝트 정보
├── projectMembers/{projectId}/{uid}      # 프로젝트 멤버
├── parts/{projectId}/{partId}            # 파트 정보
├── cueItems/{projectId}/{partId}         # 큐시트 항목
├── checkItems/{projectId}/{partId}       # 체크리스트 항목
├── notices/{projectId}/{noticeId}        # 공지사항 (소통 허브)
├── pttHistory/{projectId}                # 무전 히스토리
├── pttFavorites/{projectId}/{uid}        # PTT 즐겨찾기
├── pttShortcuts/{projectId}/{uid}        # PTT 단축키 설정
└── pttAliases/{projectId}/{uid}          # PTT 대상 별명 설정
```

---

## 디자인 시스템

### 색상

| 용도 | 색상 코드 | 사용처 |
|------|----------|--------|
| Primary Blue | `#185FA5` | 메인 버튼, 활성 탭, 강조 |
| Blue Light | `#E6F1FB` | 배경, 카드 강조 |
| Blue Mid | `#B5D4F4` | 보조 텍스트, 칩 |
| Green | `#0F6E56` | 음향팀, 완료 상태 |
| Amber | `#854F0B` | 푸드존, 지연 경고 |
| Red | `#E24B4A` | 긴급, 알림 뱃지 |
| Text Dark | `#1A1A2E` | 본문 텍스트 |
| Text Muted | `#64748B` | 보조 텍스트 |
| Gray BG | `#F4F6F9` | 페이지 배경 |
| 완료 | `#3B6D11` / `#EAF3DE` | 완료 상태 배지 |
| 지연 | `#854F0B` / `#FAEEDA` | 지연 상태 배지 |
| 긴급 | `#A32D2D` / `#FCEBEB` | 긴급 상태 배지 |
| 대기 | `#5F5E5A` / `#F1EFE8` | 대기 상태 배지 |

### UI 규칙

- 카드 `border-radius`: 14px
- 버튼 `border-radius`: 10px
- 폰트: Pretendard / Apple SD Gothic Neo / Noto Sans KR
- 아이콘: Tabler Icons (`@tabler/icons-webfont` CDN)
- 하단 탭 5개 고정: 홈 / 타임라인 / 내파트 / 대시보드 / 소통

---

## 개발 규칙

| # | 규칙 |
|---|------|
| 1 | 모든 데이터는 Firebase Realtime DB에 실시간 저장 — sessionStorage 사용 금지 |
| 2 | Topbar, BottomTabBar는 `Common.tsx` 컴포넌트 사용 |
| 3 | AppLayout은 `<Outlet>` 만 렌더링 — 탑바/탭바는 각 페이지가 직접 렌더링 |
| 4 | Tailwind 인라인 색상 사용 (예: `text-[#185FA5]`) — 커스텀 클래스 최소화 |
| 5 | 파일 하나 수정 시 연관 파일도 함께 확인/수정 |
| 6 | TypeScript 타입 오류 0개 확인 후 GitHub 푸시 |
| 7 | Firebase Security Rules 반드시 처음부터 적용 |
| 8 | HTTPS 전용 — JWT Access 1시간 / Refresh 30일 |
| 9 | 카드/결제 정보 서버 저장 금지 — Stripe에 위임 |
| 10 | 모바일 + PC 반응형 필수 지원 |

---

## 프로젝트 구조

```
src/
├── components/
│   ├── auth/         # 인증 (PrivateRoute)
│   ├── layout/       # 레이아웃 (AppLayout, AuthLayout)
│   ├── template/     # 템플릿 모달 (TemplateExportModal, TemplateImportModal)
│   └── ui/           # 공통 UI (Topbar, BottomTabBar, StatusBadge 등)
├── hooks/            # 커스텀 훅
├── lib/              # Firebase 초기화
├── pages/            # 페이지 컴포넌트 20개
├── store/            # Zustand 상태 관리
├── styles/           # 전역 CSS
├── types/            # TypeScript 타입 정의
└── utils/            # fieldTerms, templateUtils, joinCode
```

---

*ThanQ — 현장의 모든 순간을 하나로, 처음부터 안전하게*
