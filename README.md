# ThanQ

> 현장의 모든 사람이 지금 이 순간 뭘 해야 하는지 아는 플랫폼

**ThanQ** = 큐시트(Q) + 한눈에 + 한번에 + 감사(Thank)  
행사, 촬영, 콘서트 등 대규모 현장 운영을 위한 실시간 협업 플랫폼입니다.

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

## 화면 목록

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
| 7 | `/blog/write` | 블로그 글쓰기 (템플릿 첨부 가능) | ✅ 완성 |
| 8 | `/onboarding/field` | 분야 선택 | ✅ 완성 |
| 9 | `/onboarding/create` | 프로젝트 생성 | ✅ 완성 |
| 10 | `/onboarding/parts/:id` | 파트 구성 & 초대 | ✅ 완성 |
| 11 | `/p/:id/home` | 프로젝트 홈 (템플릿 내보내기/가져오기) | ✅ 완성 |
| 12 | `/p/:id/my-part` | 담당자 작업 화면 (큐시트 + 체크리스트) | ✅ 완성 |
| 13 | `/p/:id/dashboard` | 본부 대시보드 | ✅ 완성 |
| 14 | `/p/:id/timeline` | 통합 타임라인 | ✅ 완성 |
| 15 | `/p/:id/comms` | 소통 허브 | ✅ 완성 |
| 16 | `/p/:id/live` | 당일 실시간 운영 | ✅ 완성 |
| 17 | `/p/:id/ptt` | 🎙️ 무전 (푸시투토크) | ✅ 완성 |
| 18 | `/p/:id/admin` | 프로젝트 관리자 | ✅ 완성 |

### 관리자 (Firebase DB admins 등록 필요)

| # | 경로 | 화면 | 상태 |
|---|------|------|------|
| 19 | `/admin` | 사이트 전체 관리자 콘솔 | ✅ 완성 |

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

등록 후 `/admin` 경로에서 사이트 전체 관리자 콘솔 접근 가능합니다.

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
├── admins/{uid}                       # 사이트 관리자 여부
├── blog/{postId}                      # 블로그 게시글 (템플릿 첨부 포함)
├── blogLikes/{postId}/{uid}           # 블로그 좋아요
├── drafts/{uid}                       # 프로젝트 생성 임시저장
├── projects/{projectId}               # 프로젝트 정보
├── projectMembers/{projectId}/{uid}   # 프로젝트 멤버
├── parts/{projectId}/{partId}         # 파트 정보
├── cueItems/{projectId}/{partId}      # 큐시트 항목
└── checkItems/{projectId}/{partId}    # 체크리스트 항목
```

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
├── pages/            # 페이지 컴포넌트 19개
├── store/            # Zustand 상태 관리
├── styles/           # 전역 CSS
├── types/            # TypeScript 타입 정의
└── utils/            # fieldTerms, templateUtils, joinCode
```

---

## Vercel 배포

1. GitHub 저장소를 [Vercel](https://vercel.com)에 연결
2. Environment Variables에 Firebase 설정값 입력:

| 변수명 | 설명 |
|--------|------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_DATABASE_URL` | Realtime DB URL |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |

3. Deploy → `thanq-beta.vercel.app` 완료!
