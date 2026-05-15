export default function DebugPage() {
  const getEnvInfo = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

    return {
      'VITE_SUPABASE_URL': supabaseUrl ? '✓ Configurada' : '✗ No configurada',
      'VITE_SUPABASE_PUBLISHABLE_KEY': supabaseKey ? '✓ Configurada' : '✗ No configurada',
      'VITE_SUPABASE_ANON_KEY': supabaseAnon ? '✓ Configurada' : '✗ No configurada',
      'URL Value': supabaseUrl,
      'Key First Chars': supabaseKey?.substring(0, 20) + '...',
    };
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1>🔧 Debug Page</h1>
      <section style={{ marginBottom: '20px', background: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
        <h2>Environment Variables</h2>
        <pre style={{ background: '#f9f9f9', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(getEnvInfo(), null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: '20px', background: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
        <h2>Browser Info</h2>
        <pre style={{ background: '#f9f9f9', padding: '10px' }}>
          {JSON.stringify(
            {
              userAgent: navigator.userAgent,
              language: navigator.language,
              onLine: navigator.onLine,
            },
            null,
            2
          )}
        </pre>
      </section>

      <section style={{ marginBottom: '20px', background: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
        <h2>Storage Test</h2>
        <div>
          <p>localStorage: {localStorage ? '✓ Available' : '✗ Not available'}</p>
          <p>sessionStorage: {sessionStorage ? '✓ Available' : '✗ Not available'}</p>
          <button onClick={() => { try { localStorage.setItem('test', 'ok'); alert('localStorage works'); localStorage.removeItem('test'); } catch (e) { alert('localStorage error: ' + e); } }}>Test localStorage</button>
        </div>
      </section>

      <section style={{ background: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
        <h2>Console Logs</h2>
        <p>Open DevTools (F12) and check the Console tab for more details about Supabase initialization.</p>
      </section>
    </div>
  );
}
