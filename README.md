# ThanQ

> 현장의 모든 사람이 지금 이 순간 뭘 해야 하는지 아는 플랫폼

**ThanQ** = 큐시트(Q) + 한눈에 + 한번에 + 감사(Thank)  
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

## 적용 분야

| 분야 | 주요 기능 |
|------|----------|
| 행사 / 축제 | 부스별 큐시트, 혼잡도, 긴급 공지 |
| 드라마 / 영화 | 씬 큐시트, 콜시트, NG 기록 |
| 콘서트 / 공연 | 세트리스트, 무대 전환, 앙코르 플랜 |
| 패션쇼 | 런웨이 큐시트, 모델 대기, 의상 체크 |
| 스포츠 / 대회 | 경기 진행표, 구역 운영, 응급 대응 |
| 방송 / 생방송 | 방송 큐시트, 카메라 큐, 자막 타이밍 |

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

## Vercel 배포

1. GitHub 저장소를 [Vercel](https://vercel.com)에 연결
2. Environment Variables에 Firebase 설정값 입력
3. Deploy → `thanq.vercel.app` 완료!
