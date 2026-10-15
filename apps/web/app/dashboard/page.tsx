'use client';

import React, { useState } from 'react';

export default function DashboardPage() {
  const [syncPaused, setSyncPaused] = useState(false);

  const stats = {
    pairedDevices: 3,
    onlineDevices: 2,
    totalClips: 142,
    storageUsedMb: 12.4,
    retentionDays: 30,
  };

  const recentClips = [
    { id: '1', content: 'git commit -m "feat(phase-5): implement web app"', type: 'text', device: "MacBook Pro", time: '2m ago' },
    { id: '2', content: 'https://clipsync.dev/dashboard/devices', type: 'url', device: "ThinkPad X1", time: '14m ago' },
    { id: '3', content: 'curl -fsSL https://get.clipsync.dev | bash', type: 'text', device: "Ubuntu Workstation", time: '1h ago' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>Overview of active cross-device clipboard synchronization</p>
        </div>
        <button
          onClick={() => setSyncPaused(!syncPaused)}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: syncPaused ? '#e11d48' : '#0284c7',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{syncPaused ? '⏸ Sync Paused' : '⚡ Sync Active'}</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Connected Devices</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#38bdf8' }}>{stats.onlineDevices} <span style={{ fontSize: '14px', color: '#64748b' }}>/ {stats.pairedDevices} online</span></div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Saved Clipboard Items</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>{stats.totalClips}</div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Local Storage Consumed</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>{stats.storageUsedMb} <span style={{ fontSize: '14px', color: '#64748b' }}>MB</span></div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Retention Policy</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#22c55e' }}>{stats.retentionDays} <span style={{ fontSize: '14px', color: '#64748b' }}>days</span></div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>Recent Clipboard Activity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recentClips.map((clip) => (
            <div
              key={clip.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                background: '#0f172a',
                borderRadius: '8px',
                border: '1px solid #334155',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f1f5f9' }}>{clip.content}</div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: 600 }}>{clip.type}</span>
                  <span>•</span>
                  <span>{clip.device}</span>
                  <span>•</span>
                  <span>{clip.time}</span>
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(clip.content)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  background: 'transparent',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
