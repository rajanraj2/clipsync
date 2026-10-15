import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'ClipSync — Universal Clipboard Dashboard',
  description: 'Copy anywhere. Access everywhere. Stay in control.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f172a', color: '#f8fafc' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside style={{ width: '260px', background: '#1e293b', borderRight: '1px solid #334155', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#38bdf8', letterSpacing: '-0.5px' }}>ClipSync</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Universal Clipboard Dashboard</p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="/dashboard" style={{ padding: '10px 14px', borderRadius: '8px', color: '#f1f5f9', textDecoration: 'none', background: '#334155', fontWeight: 500, fontSize: '14px' }}>Dashboard</a>
              <a href="/history" style={{ padding: '10px 14px', borderRadius: '8px', color: '#cbd5e1', textDecoration: 'none', fontSize: '14px' }}>History</a>
              <a href="/devices" style={{ padding: '10px 14px', borderRadius: '8px', color: '#cbd5e1', textDecoration: 'none', fontSize: '14px' }}>Devices</a>
              <a href="/transfers" style={{ padding: '10px 14px', borderRadius: '8px', color: '#cbd5e1', textDecoration: 'none', fontSize: '14px' }}>Quick Share</a>
              <a href="/settings" style={{ padding: '10px 14px', borderRadius: '8px', color: '#cbd5e1', textDecoration: 'none', fontSize: '14px' }}>Settings</a>
            </nav>
            <div style={{ marginTop: 'auto', padding: '12px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px', color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>Web Client Active</span>
              </div>
              <span>Protocol v2.0 • Local-First</span>
            </div>
          </aside>

          {/* Main Area */}
          <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
