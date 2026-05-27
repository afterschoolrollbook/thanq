/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // OnCue 브랜드 컬러 (기획서 기준)
        primary: {
          DEFAULT: '#185FA5',
          light: '#E6F1FB',
          mid: '#B5D4F4',
        },
        status: {
          done: '#0F6E56',
          'done-bg': '#EAF3DE',
          delay: '#854F0B',
          'delay-bg': '#FAEEDA',
          urgent: '#E24B4A',
          'urgent-bg': '#FCEBEB',
          wait: '#5F5E5A',
          'wait-bg': '#F1EFE8',
        },
        oncue: {
          bg: '#F4F6F9',
          text: '#1A1A2E',
          muted: '#6B7280',
          border: '#E5E7EB',
        },
        // 파트 컬러
        part: {
          blue: '#185FA5',
          green: '#0F6E56',
          amber: '#854F0B',
          pink: '#993556',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
