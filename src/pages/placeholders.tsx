// 화면 3: 프로젝트 생성
export function CreateProjectPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">프로젝트 기본 정보</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-folder-plus text-4xl block mb-3 opacity-40" />
        <p className="text-sm">프로젝트 생성 화면 — 개발 예정</p>
      </div>
    </div>
  )
}

// 화면 5: 프로젝트 홈
export function ProjectHomePage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">프로젝트 홈</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-home text-4xl block mb-3 opacity-40" />
        <p className="text-sm">D-day 바, 진행률, 파트 현황 — 개발 예정</p>
      </div>
    </div>
  )
}

// 화면 6: 담당자 작업
export function MyPartPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">내 파트</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-checklist text-4xl block mb-3 opacity-40" />
        <p className="text-sm">큐시트, 체크리스트, 이슈 — 개발 예정</p>
      </div>
    </div>
  )
}

// 화면 7: 본부 대시보드
export function DashboardPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">본부 대시보드</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-layout-dashboard text-4xl block mb-3 opacity-40" />
        <p className="text-sm">KPI, 파트별 현황, 공지 발송 — 개발 예정</p>
      </div>
    </div>
  )
}

// 화면 8: 통합 타임라인
export function TimelinePage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">통합 타임라인</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-timeline text-4xl block mb-3 opacity-40" />
        <p className="text-sm">시간 흐름 연동, 진행중 강조 — 개발 예정</p>
      </div>
    </div>
  )
}

// 화면 9: 소통 허브
export function CommsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h2 className="text-lg font-bold text-oncue-text mb-4">소통 허브</h2>
      <div className="oncue-card p-5 text-center text-oncue-muted py-12">
        <i className="ti ti-message-circle text-4xl block mb-3 opacity-40" />
        <p className="text-sm">공지, 긴급 연락, 미팅 소집 — 개발 예정</p>
      </div>
    </div>
  )
}
