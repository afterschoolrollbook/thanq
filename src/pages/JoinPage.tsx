import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ref, get, set, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export default function JoinPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const code = (params.get('code') ?? '').toUpperCase()
  const partKey = params.get('partKey') ?? ''
  const rolePram = params.get('role') ?? 'staff'
  const partNameParam = decodeURIComponent(params.get('partName') ?? '')

  const [status, setStatus] = useState<'loading' | 'joining' | 'done' | 'error'>('loading')
  const [projectName, setProjectName] = useState('')
  const [partName, setPartName] = useState(partNameParam)
  const [errorMsg, setErrorMsg] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (!code) { setStatus('error'); setErrorMsg('유효하지 않은 초대 링크예요'); return }
    if (!user) {
      // 로그인 후 돌아오도록 저장
      sessionStorage.setItem('join_redirect', window.location.href)
      navigate('/login')
      return
    }
    findProject()
  }, [user, code])

  async function findProject() {
    try {
      // joinCode로 프로젝트 찾기
      const snap = await get(ref(db, 'projects'))
      if (!snap.exists()) { setStatus('error'); setErrorMsg('프로젝트를 찾을 수 없어요'); return }

      const projects = Object.values(snap.val()) as any[]
      const project = projects.find(p => p.joinCode === code || p.id?.slice(-6).toUpperCase() === code)

      if (!project) { setStatus('error'); setErrorMsg(`초대 코드 "${code}"에 해당하는 프로젝트가 없어요`); return }

      setProjectId(project.id)
      setProjectName(project.name)

      // partKey로 실제 partId 찾기
      if (partKey) {
        const pkSnap = await get(ref(db, `partKeyMap/${project.id}/${partKey}`))
        if (pkSnap.exists()) {
          const pkData = pkSnap.val()
          setPartName(pkData.partName ?? partNameParam)
        }
      }

      setStatus('joining')
    } catch (e) {
      setStatus('error')
      setErrorMsg('오류가 발생했어요. 다시 시도해주세요.')
    }
  }

  async function confirmJoin() {
    if (!user || !projectId) return
    setStatus('loading')
    try {
      let finalPartId = ''
      let finalRole = rolePram
      let finalPartName = partName

      // partKey → partId 변환
      if (partKey) {
        const pkSnap = await get(ref(db, `partKeyMap/${projectId}/${partKey}`))
        if (pkSnap.exists()) {
          const pkData = pkSnap.val()
          finalPartId = pkData.partId
          finalRole = pkData.memberRole ?? rolePram
          finalPartName = pkData.partName ?? partName
        }
      }

      // projectMembers에 저장
      await set(ref(db, `projectMembers/${projectId}/${user.uid}`), {
        uid: user.uid,
        displayName: user.displayName ?? '익명',
        role: finalRole,
        partId: finalPartId,
        partName: finalPartName,
        joinedAt: new Date().toISOString(),
      })

      // parts에도 managerId 업데이트 (팀장 역할일 때)
      if (finalPartId && finalRole === 'staff') {
        await update(ref(db, `parts/${projectId}/${finalPartId}`), {
          managerId: user.uid,
          managerName: user.displayName ?? '익명',
        })
      }

      setStatus('done')
      setTimeout(() => navigate(`/p/${projectId}/home`), 1500)
    } catch (e) {
      setStatus('error')
      setErrorMsg('참여 중 오류가 발생했어요.')
    }
  }

  const roleInfo: Record<string, { label: string; desc: string; color: string; icon: string }> = {
    planner:     { label: '기획자',  desc: '모든 팀 수정 가능',  color: '#185FA5', icon: 'ti-shield-check' },
    staff:       { label: '스태프',  desc: '내 파트만 수정 가능', color: '#E8820C', icon: 'ti-user-check' },
    participant: { label: '참가자',  desc: '보기만 가능',        color: '#854F0B', icon: 'ti-eye' },
  }
  const ri = roleInfo[rolePram] ?? roleInfo['staff']

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center px-5">
      <div className="bg-white rounded-[20px] w-full max-w-sm p-6 shadow-sm">

        {/* 로딩 */}
        {status === 'loading' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <i className="ti ti-loader-2 animate-spin text-[#185FA5] text-[32px]"/>
            <p className="text-[13px] text-[#64748B]">확인 중...</p>
          </div>
        )}

        {/* 참여 확인 */}
        {status === 'joining' && (
          <>
            <div className="flex flex-col items-center mb-5">
              <div className="w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center mb-3">
                <i className="ti ti-door-enter text-[#185FA5] text-[28px]"/>
              </div>
              <div className="text-[18px] font-bold text-[#1A1A2E] mb-1">초대를 받았어요!</div>
              <div className="text-[13px] text-[#64748B] text-center">아래 정보를 확인하고 참여해주세요</div>
            </div>

            <div className="bg-[#F4F6F9] rounded-[14px] p-4 mb-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <i className="ti ti-calendar-event text-[#185FA5] text-[18px]"/>
                <div>
                  <div className="text-[11px] text-[#A0AEC0]">프로젝트</div>
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{projectName}</div>
                </div>
              </div>
              {partName && (
                <div className="flex items-center gap-3">
                  <i className="ti ti-users text-[#E8820C] text-[18px]"/>
                  <div>
                    <div className="text-[11px] text-[#A0AEC0]">소속 파트</div>
                    <div className="text-[14px] font-bold text-[#1A1A2E]">{partName}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <i className={`ti ${ri.icon} text-[18px]`} style={{ color: ri.color }}/>
                <div>
                  <div className="text-[11px] text-[#A0AEC0]">역할</div>
                  <div className="text-[14px] font-bold" style={{ color: ri.color }}>{ri.label}</div>
                  <div className="text-[11px] text-[#64748B]">{ri.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <i className="ti ti-user-circle text-[#64748B] text-[18px]"/>
                <div>
                  <div className="text-[11px] text-[#A0AEC0]">참여 계정</div>
                  <div className="text-[13px] font-semibold text-[#1A1A2E]">{user?.displayName}</div>
                  <div className="text-[11px] text-[#64748B]">{user?.email}</div>
                </div>
              </div>
            </div>

            <button onClick={confirmJoin}
              className="w-full h-[46px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-bold mb-2">
              참여하기
            </button>
            <button onClick={() => navigate('/')}
              className="w-full h-[40px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">
              취소
            </button>
          </>
        )}

        {/* 완료 */}
        {status === 'done' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-16 h-16 rounded-full bg-[#EAF3DE] flex items-center justify-center">
              <i className="ti ti-check text-[#3B6D11] text-[32px]"/>
            </div>
            <div className="text-[17px] font-bold text-[#1A1A2E]">참여 완료!</div>
            <div className="text-[13px] text-[#64748B]">프로젝트로 이동할게요...</div>
          </div>
        )}

        {/* 오류 */}
        {status === 'error' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <i className="ti ti-alert-circle text-[#DC2626] text-[32px]"/>
            </div>
            <div className="text-[17px] font-bold text-[#1A1A2E]">참여할 수 없어요</div>
            <div className="text-[13px] text-[#64748B] text-center">{errorMsg}</div>
            <button onClick={() => navigate('/')}
              className="mt-2 h-[40px] px-6 bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold">
              홈으로
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
