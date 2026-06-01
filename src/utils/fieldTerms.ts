import type { FieldType, FieldTerms } from '@/types'

export const FIELD_TERMS: Record<FieldType, FieldTerms> = {
  event: {
    headquarters: '본부',
    part: '파트',
    manager: '담당자',
    cuesheet: '큐시트',
    checklist: '체크리스트',
  },
  film: {
    headquarters: '제작본부',
    part: '팀',
    manager: '팀장',
    cuesheet: '씬 목록',
    checklist: '촬영 체크리스트',
  },
  concert: {
    headquarters: '공연 본부',
    part: '파트',
    manager: '파트장',
    cuesheet: '세트리스트',
    checklist: '공연 체크리스트',
  },
  fashion: {
    headquarters: '쇼 본부',
    part: '팀',
    manager: '담당자',
    cuesheet: '런웨이 큐시트',
    checklist: '준비 체크리스트',
  },
  sports: {
    headquarters: '운영본부',
    part: '구역',
    manager: '구역장',
    cuesheet: '경기 진행표',
    checklist: '운영 체크리스트',
  },
  broadcast: {
    headquarters: '방송 본부',
    part: '팀',
    manager: 'PD',
    cuesheet: '방송 큐시트',
    checklist: '방송 체크리스트',
  },
  club: {
    headquarters: '운영진',
    part: '그룹',
    manager: '리더',
    cuesheet: '코스 일정',
    checklist: '출발 체크리스트',
  },
  party: {
    headquarters: '파티 운영진',
    part: '역할',
    manager: '담당자',
    cuesheet: '파티 일정',
    checklist: '준비 체크리스트',
  },
  cooking: {
    headquarters: '클래스 운영',
    part: '조',
    manager: '조장',
    cuesheet: '레시피 순서',
    checklist: '재료 체크리스트',
  },
  study: {
    headquarters: '운영진',
    part: '팀',
    manager: '팀장',
    cuesheet: '스터디 일정',
    checklist: '준비 체크리스트',
  },
  travel: {
    headquarters: '여행 운영진',
    part: '그룹',
    manager: '그룹장',
    cuesheet: '여행 일정',
    checklist: '준비물 체크리스트',
  },
  social: {
    headquarters: '주최',
    part: '테이블',
    manager: '호스트',
    cuesheet: '진행 순서',
    checklist: '준비 체크리스트',
  },
  custom: {
    headquarters: '본부',
    part: '파트',
    manager: '담당자',
    cuesheet: '큐시트',
    checklist: '체크리스트',
  },
}

export const FIELD_LABELS: Record<FieldType, { label: string; icon: string; desc: string }> = {
  event:     { label: '행사 / 축제',    icon: 'ti-confetti',    desc: '부스별 큐시트, 혼잡도, 긴급 공지' },
  film:      { label: '드라마 / 영화',  icon: 'ti-movie',       desc: '씬 큐시트, 콜시트, NG 기록' },
  concert:   { label: '콘서트 / 공연',  icon: 'ti-microphone',  desc: '세트리스트, 무대 전환, 앙코르 플랜' },
  fashion:   { label: '패션쇼',         icon: 'ti-hanger',      desc: '런웨이 큐시트, 모델 대기, 의상 체크' },
  sports:    { label: '스포츠 / 대회',  icon: 'ti-trophy',      desc: '경기 진행표, 구역 운영, 응급 대응' },
  broadcast: { label: '방송 / 생방송',  icon: 'ti-device-tv',   desc: '방송 큐시트, 카메라 큐, 자막 타이밍' },
  club:      { label: '모임 / 클럽',    icon: 'ti-users-group', desc: '드라이브, 라이딩, 러닝, 등산' },
  party:     { label: '기념일 / 파티',  icon: 'ti-cake',        desc: '생일파티, 돌잔치, 집들이, 기념일' },
  cooking:   { label: '요리 / 클래스',  icon: 'ti-chef-hat',    desc: '쿠킹클래스, 베이킹, 원데이클래스' },
  study:     { label: '스터디 / 독서',  icon: 'ti-book',        desc: '스터디그룹, 독서모임, 자기계발' },
  travel:    { label: '여행 / 캠핑',    icon: 'ti-plane',       desc: '단체여행, 캠핑, 워크숍, 수련회' },
  social:    { label: '소셜다이닝 / 미팅', icon: 'ti-friends',     desc: '소셜다이닝, 미팅, 네트워킹, 번개모임' },
  custom:    { label: '직접 입력',      icon: 'ti-pencil',      desc: '용어를 직접 설정해서 사용' },
}

// 파트 색상 순환 배정
export const PART_COLORS = [
  '#185FA5', // 파랑
  '#0F6E56', // 초록
  '#854F0B', // 주황
  '#993556', // 분홍
  '#6B3FA0', // 보라
  '#1A6B6B', // 청록
  '#C05621', // 오렌지
]

export function getPartColor(index: number): string {
  return PART_COLORS[index % PART_COLORS.length]
}
