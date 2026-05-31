import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, set, remove, push, update } from 'firebase/database'
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar } from '@/components/ui/Common'
import type { Project, TemplateFile } from '@/types'

// ─── 내 템플릿 저장 경로: userTemplates/{uid}/{id} ───────────
interface SavedTemplate {
  id: string
  savedAt: string
  templateFile: string   // JSON stringified TemplateFile
  name: string
  fieldType: string
  fieldLabel?: string
  authorName: string
}

const FIELD_LABELS: Record<string, { label: string; color: string }> = {
  event:     { label: '행사/축제',   color: '#185FA5' },
  film:      { label: '드라마/영화', color: '#7C3AED' },
  concert:   { label: '콘서트/공연', color: '#BE185D' },
  fashion:   { label: '패션쇼',      color: '#B45309' },
  sports:    { label: '스포츠/대회', color: '#16A34A' },
  broadcast: { label: '방송/생방송', color: '#0891B2' },
  club:      { label: '모임/클럽',   color: '#EA580C' },
  custom:    { label: '기타',        color: '#64748B' },
}

export default function MyPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  // 탭
  const [tab, setTab] = useState<'profile' | 'templates'>('profile')

  // 프로필
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // 전화번호
  const [phone, setPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)

  // 비밀번호
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Pro 플랜 정보
  const [proExpiresAt, setProExpiresAt] = useState<string|null>(null)

  // 통계
  const [projects, setProjects] = useState<Project[]>([])

  // 템플릿 보관함
  const [myTemplates, setMyTemplates] = useState<SavedTemplate[]>([])
  const [tmplLoading, setTmplLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewTmpl, setPreviewTmpl] = useState<SavedTemplate | null>(null)

  // 탈퇴
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 파일 import ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    // 전화번호
    onValue(ref(db, `users/${user.uid}/phone`), (snap) => {
      if (snap.exists()) setPhone(snap.val())
    }, { onlyOnce: true })

    // Pro 만료일
    onValue(ref(db, `users/${user.uid}/proExpiresAt`), (snap) => {
      setProExpiresAt(snap.exists() ? snap.val() : null)
    }, { onlyOnce: true })

    // 내 프로젝트
    const unsub1 = onValue(ref(db, 'projects'), (snap) => {
      if (snap.exists()) {
        const all: Project[] = Object.values(snap.val())
        setProjects(all.filter((p) => p.ownerId === user.uid))
      }
    })
    // 내 템플릿 보관함
    const unsub2 = onValue(ref(db, `userTemplates/${user.uid}`), (snap) => {
      if (snap.exists()) {
        const arr: SavedTemplate[] = Object.values(snap.val())
        arr.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        setMyTemplates(arr)
      } else {
        setMyTemplates([])
      }
      setTmplLoading(false)
    })
    return () => { unsub1(); unsub2() }
  }, [user])

  // ── 전화번호 저장 ──
  async function handleSavePhone() {
    if (!user) return
    setSavingPhone(true)
    await update(ref(db, `users/${user.uid}`), { phone: phone.trim() })
    setPhoneSaved(true)
    setSavingPhone(false)
    setTimeout(() => setPhoneSaved(false), 2000)
  }

  // ── 이름 저장 ──
  async function handleSaveName() {
    if (!displayName.trim() || !auth.currentUser) return
    setSavingName(true)
    await updateProfile(auth.currentUser, { displayName: displayName.trim() })
    setNameSaved(true)
    setSavingName(false)
    setTimeout(() => setNameSaved(false), 2000)
  }

  // ── 비밀번호 변경 ──
  async function handleChangePw() {
    setPwError('')
    if (!currentPw || !newPw || !confirmPw) { setPwError('모든 항목을 입력해주세요'); return }
    if (newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 해요'); return }
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않아요'); return }
    if (!auth.currentUser?.email) { setPwError('이메일 계정만 비밀번호 변경이 가능해요'); return }
    setSavingPw(true)
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPw)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPw)
      setPwSaved(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 2500)
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/wrong-password') setPwError('현재 비밀번호가 올바르지 않아요')
      else setPwError('오류가 발생했어요. 다시 시도해주세요')
    } finally { setSavingPw(false) }
  }

  // ── 탬플릿 다운로드 ──
  function downloadTemplate(t: SavedTemplate) {
    const blob = new Blob([t.templateFile], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${t.name}.thanq`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 탬플릿으로 프로젝트 시작 ──
  function useTemplate(t: SavedTemplate) {
    sessionStorage.setItem('oncue_template', t.templateFile)
    const parsed = JSON.parse(t.templateFile) as TemplateFile
    sessionStorage.setItem('oncue_field', parsed.fieldType)
    navigate('/onboarding/field')
  }

  // ── 탬플릿 삭제 ──
  async function deleteTemplate(id: string) {
    if (!user) return
    setDeletingId(id)
    await remove(ref(db, `userTemplates/${user.uid}/${id}`))
    setDeletingId(null)
  }

  // ── .thanq 파일 가져와서 보관함에 저장 ──
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.name.endsWith('.thanq')) { alert('.thanq 파일만 가져올 수 있어요'); return }
    const text = await file.text()
    try {
      const parsed = JSON.parse(text) as TemplateFile
      if (parsed.version !== '1.0' || !Array.isArray(parsed.parts)) throw new Error()
      const newRef = push(ref(db, `userTemplates/${user.uid}`))
      const saved: SavedTemplate = {
        id: newRef.key!,
        savedAt: new Date().toISOString(),
        templateFile: text,
        name: parsed.name,
        fieldType: parsed.fieldType,
        fieldLabel: parsed.fieldLabel,
        authorName: parsed.authorName,
      }
      await set(newRef, saved)
    } catch { alert('올바른 ThanQ 템플릿 파일이 아니에요') }
    e.target.value = ''
  }

  const live = projects.filter((p) => p.status === 'live').length
  const done = projects.filter((p) => p.status === 'done').length
  const planned = projects.filter((p) => p.status !== 'live' && p.status !== 'done').length
  const joinedAt = auth.currentUser?.metadata.creationTime
    ? new Date(auth.currentUser.metadata.creationTime).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const isGoogle = auth.currentUser?.providerData[0]?.providerId === 'google.com'

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />

      {/* 헤더 프로필 배너 */}
      <div className="bg-[#185FA5] px-5 pt-6 pb-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-[26px] font-bold flex-shrink-0">
            {user?.displayName?.charAt(0) ?? '?'}
          </div>
          <div>
            <div className="text-white text-[18px] font-bold">{user?.displayName ?? '이름 없음'}</div>
            <div className="text-[#B5D4F4] text-[13px] mt-0.5">{user?.email}</div>
            <div className="text-[#B5D4F4] text-[11px] mt-0.5">가입일 {joinedAt}</div>
            {/* 등급 배지 */}
            <div className="mt-2 flex items-center gap-2">
              {user?.isPro ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-[#F59E0B] text-white rounded-full text-[11px] font-bold">
                  <i className="ti ti-crown text-[11px]"/> Pro
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-white/20 text-white rounded-full text-[11px] font-semibold">
                  <i className="ti ti-user text-[11px]"/> Free
                </span>
              )}
              {user?.isPro && proExpiresAt && (
                <span className="text-[11px] text-[#FDE68A]">
                  {(() => {
                    const diff = Math.ceil((new Date(proExpiresAt).getTime() - Date.now()) / 86400000)
                    return diff > 0 ? `${diff}일 남음 (${new Date(proExpiresAt).toLocaleDateString('ko-KR')})` : '만료됨'
                  })()}
                </span>
              )}
              {user?.isPro && !proExpiresAt && (
                <span className="text-[11px] text-[#FDE68A]">영구 Pro</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 통계 카드 (헤더 아래 겹치게) */}
      <div className="max-w-2xl mx-auto px-5 -mt-6">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '진행 중', value: live,    color: '#E24B4A' },
            { label: '예정',   value: planned, color: '#185FA5' },
            { label: '완료',   value: done,    color: '#A0AEC0' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-[14px] border border-[#E2E8F0] p-4 text-center shadow-sm">
              <div className="text-[24px] font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-[12px] p-1 mb-5">
          {([
            { key: 'profile',   label: '내 정보',    icon: 'ti-user' },
            { key: 'templates', label: '내 템플릿',   icon: 'ti-file-invoice' },
          ] as const).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-[13px] font-semibold transition-colors ${
                tab === key ? 'bg-[#185FA5] text-white' : 'text-[#64748B] hover:bg-[#F4F6F9]'
              }`}>
              <i className={`ti ${icon} text-[15px]`} /> {label}
            </button>
          ))}
        </div>

        {/* ── 내 정보 탭 ── */}
        {tab === 'profile' && (
          <div className="flex flex-col gap-4 pb-10">

            {/* 플랜 / 등급 */}
            <section className={card}>
              <div className={sectionTitle}><i className="ti ti-crown text-[#F59E0B]" /> 내 플랜</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user?.isPro ? 'bg-[#FEF3C7]' : 'bg-[#F4F6F9]'}`}>
                    <i className={`ti ti-crown text-[20px] ${user?.isPro ? 'text-[#F59E0B]' : 'text-[#A0AEC0]'}`}/>
                  </div>
                  <div>
                    <div className={`text-[15px] font-bold ${user?.isPro ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
                      {user?.isPro ? 'Pro 플랜' : 'Free 플랜'}
                    </div>
                    <div className="text-[12px] text-[#A0AEC0]">
                      {user?.isPro
                        ? proExpiresAt
                          ? (() => {
                              const diff = Math.ceil((new Date(proExpiresAt).getTime() - Date.now()) / 86400000)
                              return diff > 0
                                ? `${new Date(proExpiresAt).toLocaleDateString('ko-KR')} 만료 · ${diff}일 남음`
                                : '플랜이 만료되었어요'
                            })()
                          : '영구 Pro · 제한 없음'
                        : '템플릿 저장/불러오기 등 제한'}
                    </div>
                  </div>
                </div>
                {!user?.isPro && (
                  <button onClick={() => navigate('/upgrade')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#F59E0B] text-white rounded-[8px] text-[12px] font-semibold hover:bg-[#D97706] transition-colors">
                    <i className="ti ti-crown text-[11px]"/> 업그레이드
                  </button>
                )}
              </div>
            </section>

            {/* 이름 변경 */}
            <section className={card}>
              <div className={sectionTitle}><i className="ti ti-pencil text-[#185FA5]" /> 이름 변경</div>
              <input className={inp} value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false) }}
                placeholder="표시 이름" />
              <button onClick={handleSaveName} disabled={savingName || !displayName.trim()}
                className={`mt-2 ${btn}`}>
                {nameSaved ? <><i className="ti ti-check" /> 저장됐어요!</> : savingName ? '저장 중...' : '저장'}
              </button>
            </section>

            {/* 전화번호 */}
            <section className={card}>
              <div className={sectionTitle}><i className="ti ti-phone text-[#185FA5]" /> 전화번호</div>
              <input className={inp} type="tel" value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneSaved(false) }}
                placeholder="010-0000-0000" />
              <button onClick={handleSavePhone} disabled={savingPhone || !phone.trim()}
                className={`mt-2 ${btn}`}>
                {phoneSaved ? <><i className="ti ti-check" /> 저장됐어요!</> : savingPhone ? '저장 중...' : '저장'}
              </button>
            </section>

            {/* 비밀번호 변경 — 구글 로그인은 숨김 */}
            {!isGoogle && (
              <section className={card}>
                <div className={sectionTitle}><i className="ti ti-lock text-[#185FA5]" /> 비밀번호 변경</div>
                <div className="flex flex-col gap-2">
                  <input className={inp} type="password" placeholder="현재 비밀번호"
                    value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                  <input className={inp} type="password" placeholder="새 비밀번호 (6자 이상)"
                    value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                  <input className={inp} type="password" placeholder="새 비밀번호 확인"
                    value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
                {pwError && <p className="text-[12px] text-[#A32D2D] mt-1.5 flex items-center gap-1"><i className="ti ti-alert-circle" /> {pwError}</p>}
                <button onClick={handleChangePw} disabled={savingPw} className={`mt-2 ${btn}`}>
                  {pwSaved ? <><i className="ti ti-check" /> 변경됐어요!</> : savingPw ? '변경 중...' : '비밀번호 변경'}
                </button>
              </section>
            )}

            {isGoogle && (
              <section className={card}>
                <div className={sectionTitle}><i className="ti ti-brand-google text-[#185FA5]" /> 소셜 계정</div>
                <p className="text-[13px] text-[#64748B]">Google 계정으로 로그인됐어요. 비밀번호 설정은 Google에서 관리해요.</p>
              </section>
            )}

            {/* 계정 탈퇴 */}
            <section className={card}>
              <div className={sectionTitle}><i className="ti ti-trash text-[#A32D2D]" /> 계정 탈퇴</div>
              <p className="text-[13px] text-[#64748B] mb-3">탈퇴하면 모든 데이터가 삭제되고 복구할 수 없어요.</p>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="h-[36px] px-4 border border-[#E2E8F0] rounded-[8px] text-[13px] text-[#A32D2D] hover:bg-[#FEF2F2] transition-colors">
                  탈퇴하기
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (auth.currentUser) await deleteUser(auth.currentUser)
                    navigate('/')
                  }} className="h-[36px] px-4 bg-[#E24B4A] text-white rounded-[8px] text-[13px] font-semibold">
                    정말 탈퇴
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="h-[36px] px-4 border border-[#E2E8F0] rounded-[8px] text-[13px] text-[#64748B]">
                    취소
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── 내 템플릿 탭 ── */}
        {tab === 'templates' && (
          <div className="pb-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-[#64748B]">저장한 템플릿 {myTemplates.length}개</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="h-[34px] px-3 bg-[#185FA5] text-white rounded-[9px] text-[12px] font-semibold flex items-center gap-1.5">
                <i className="ti ti-file-import text-[14px]" /> .thanq 가져오기
              </button>
              <input ref={fileInputRef} type="file" accept=".thanq" className="hidden" onChange={handleImportFile} />
            </div>

            {tmplLoading ? (
              <div className="text-center py-10 text-[#64748B] text-[13px]">불러오는 중...</div>
            ) : myTemplates.length === 0 ? (
              <div className="text-center py-14">
                <i className="ti ti-file-off text-[48px] text-[#A0AEC0] block mb-3 opacity-40" />
                <p className="text-[13px] text-[#64748B]">저장된 템플릿이 없어요</p>
                <p className="text-[12px] text-[#A0AEC0] mt-1">.thanq 파일을 가져오거나 프로젝트를 템플릿으로 내보내보세요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {myTemplates.map((t) => {
                  const fl = FIELD_LABELS[t.fieldType] ?? FIELD_LABELS.custom
                  const parsed = (() => { try { return JSON.parse(t.templateFile) as TemplateFile } catch { return null } })()
                  return (
                    <div key={t.id} className="bg-white border border-[#E2E8F0] rounded-[14px] p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: fl.color + '18', color: fl.color }}>
                              {fl.label}
                            </span>
                            {(t.templateFile.includes('"passwordHash"')) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#B45309] flex items-center gap-1">
                                <i className="ti ti-lock text-[10px]" /> 비밀번호
                              </span>
                            )}
                            {(t.templateFile.includes('"allowedEmail"')) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] flex items-center gap-1">
                                <i className="ti ti-mail text-[10px]" /> 이메일 제한
                              </span>
                            )}
                          </div>
                          <div className="text-[14px] font-semibold text-[#1A1A2E] truncate">{t.name}</div>
                          <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>파트 {parsed?.parts.length ?? '?'}개</span>
                            <span>·</span>
                            <span>{new Date(t.savedAt).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                        <button onClick={() => setPreviewTmpl(previewTmpl?.id === t.id ? null : t)}
                          className="w-8 h-8 rounded-full bg-[#F4F6F9] flex items-center justify-center flex-shrink-0 hover:bg-[#E2E8F0] transition-colors">
                          <i className={`ti ${previewTmpl?.id === t.id ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#64748B] text-[14px]`} />
                        </button>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex gap-2">
                        <button onClick={() => useTemplate(t)}
                          className="flex-1 h-[34px] bg-[#185FA5] text-white rounded-[8px] text-[12px] font-semibold flex items-center justify-center gap-1.5">
                          <i className="ti ti-rocket text-[13px]" /> 이 템플릿으로 시작
                        </button>
                        <button onClick={() => downloadTemplate(t)}
                          className="h-[34px] px-3 border border-[#E2E8F0] rounded-[8px] text-[12px] text-[#64748B] hover:bg-[#F4F6F9] transition-colors flex items-center gap-1">
                          <i className="ti ti-download text-[13px]" />
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} disabled={deletingId === t.id}
                          className="h-[34px] px-3 border border-[#E2E8F0] rounded-[8px] text-[12px] text-[#A32D2D] hover:bg-[#FEF2F2] transition-colors flex items-center gap-1 disabled:opacity-40">
                          <i className="ti ti-trash text-[13px]" />
                        </button>
                      </div>

                      {/* 파트 미리보기 */}
                      {previewTmpl?.id === t.id && parsed && (
                        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                          <div className="text-[11px] font-semibold text-[#64748B] mb-2">파트 구성</div>
                          <div className="flex flex-col gap-1.5">
                            {parsed.parts.map((p, i) => (
                              <div key={i} className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                                <span className="text-[12px] text-[#1A1A2E] flex-1">{p.name}</span>
                                <span className="text-[11px] text-[#A0AEC0]">큐 {p.cueItems.length} · 체크 {p.checkItems.length}</span>
                              </div>
                            ))}
                          </div>
                          {parsed.description && (
                            <p className="text-[12px] text-[#64748B] mt-2.5 leading-relaxed line-clamp-3">{parsed.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const card = 'bg-white border border-[#E2E8F0] rounded-[14px] p-4'
const sectionTitle = 'text-[13px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-1.5'
const inp = 'w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]'
const btn = 'w-full h-[38px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors'
