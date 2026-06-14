import type { ReactNode } from 'react'

export const metadata = {
  title: 'Scalpel Services Market',
  description: 'Backend for the Scalpel Services Market plugin.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0e0e12', color: '#eee', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
