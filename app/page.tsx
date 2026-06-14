export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1.5rem', lineHeight: 1.6 }}>
      <h1>Scalpel Services Market</h1>
      <p>Backend API for the Services Market plugin for Scalpel.</p>
      <p>
        Source:{' '}
        <a href="https://github.com/cccarv82/scalpel-services-market" style={{ color: '#f0a020' }}>
          cccarv82/scalpel-services-market
        </a>
      </p>
      <h2>Health</h2>
      <p>
        <a href="/api/health" style={{ color: '#f0a020' }}>
          /api/health
        </a>
      </p>
    </main>
  )
}
