# OnCue

> 현장의 모든 사람이 지금 이 순간 뭘 해야 하는지 아는 플랫폼

행사, 촬영, 콘서트 등 대규모 현장 운영을 위한 실시간 협업 플랫폼입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript |
| 스타일링 | Tailwind CSS |
| 상태관리 | Zustand |
| 라우팅 | React Router v6 |
| 백엔드/DB | Firebase (Auth + Realtime DB) |
| 배포 | Vercel |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
# .env.local 파일을 열어 Firebase 설정값을 채워넣으세요
```

### 3. 개발 서버 실행

```bash
npm run dev
```

## Firebase 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트 생성
2. Authentication → 로그인 방법 → 이메일/비밀번호, Google 활성화
3. Realtime Database → 데이터베이스 만들기
4. 프로젝트 설정 → 내 앱 → 웹 앱 추가 → 설정값 복사 → `.env.local` 에 붙여넣기

## 프로젝트 구조

```
src/
├── components/
│   ├── auth/         # 인증 관련 (PrivateRoute 등)
│   ├── layout/       # 레이아웃 (AppLayout, AuthLayout)
│   └── ui/           # 공통 UI 컴포넌트
├── hooks/            # 커스텀 훅 (useAuth 등)
├── lib/              # Firebase 초기화
├── pages/            # 화면 컴포넌트 (10개)
├── store/            # Zustand 상태 관리
├── styles/           # 전역 CSS
├── types/            # TypeScript 타입 정의
└── utils/            # 유틸리티 함수
```

## 화면 목록

| # | 화면 | 상태 |
|---|------|------|
| 1 | 로그인 / 회원가입 | ✅ 완성 |
| 2 | 분야 선택 | ✅ 완성 |
| 3 | 프로젝트 생성 | 🔧 개발 중 |
| 4 | 파트 구성 & 초대 | 🔧 개발 중 |
| 5 | 프로젝트 홈 | 🔧 개발 중 |
| 6 | 담당자 작업 화면 | 🔧 개발 중 |
| 7 | 본부 대시보드 | 🔧 개발 중 |
| 8 | 통합 타임라인 | 🔧 개발 중 |
| 9 | 소통 허브 | 🔧 개발 중 |
| 10 | 당일 실시간 운영 | 🔧 개발 중 |

## Vercel 배포

1. GitHub에 push
2. [Vercel](https://vercel.com)에서 GitHub 저장소 연결
3. Environment Variables에 `.env.local` 값 입력
4. Deploy → 완료!
