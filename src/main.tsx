import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import App from './App'

// 프리뷰 URL 접속 시 운영 도메인으로 강제 이동
const PROD_HOST = 'thanq-beta.vercel.app'
const host = window.location.hostname
if (host !== PROD_HOST && host !== 'localhost' && !host.startsWith('127.')) {
  window.location.replace(
    `https://${PROD_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
