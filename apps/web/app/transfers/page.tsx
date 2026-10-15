'use client';

import React, { useState } from 'react';

export default function TransfersPage() {
  const [content, setContent] = useState('');
  const [targetDevices, setTargetDevices] = useState<string[]>(['mac-1']);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const availableDevices = [
    { id: 'mac-1', name: "MacBook Pro (macOS)" },
    { id: 'win-1', name: "ThinkPad X1 (Windows)" },
    { id: 'lin-1', name: "Ubuntu Workstation (Linux)" },
  ];

  const handleShare = () => {
    if (!content.trim()) return;
    setTransferSuccess(true);
    setTimeout(() => {
      setContent('');
      setTransferSuccess(false);
    }, 2500);
  };

  const toggleDevice = (id: string) => {
    if (targetDevices.includes(id)) {
      setTargetDevices(targetDevices.filter((d) => d !== id));
    } else {
      setTargetDevices([...targetDevices, id]);
    }
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Quick Share</h1>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
          Instantly dispatch text, links, or file transfers to selected connected devices
        </p>
      </div>

      <div style={{ background: '#1e293b', padding: '28px', borderRadius: '12px', border: '1px solid #334155' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
          Content to Share
        </label>
        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type or paste text, links, or code to send..."
          style={{
            width: '100%',
            padding: '12px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#f8fafc',
            fontFamily: 'monospace',
            fontSize: '14px',
            boxSizing: 'border-box',
            marginBottom: '20px',
          }}
        />

        <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
          Target Connected Devices
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {availableDevices.map((dev) => (
            <label
              key={dev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: '#0f172a',
                borderRadius: '8px',
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={targetDevices.includes(dev.id)}
                onChange={() => toggleDevice(dev.id)}
              />
              <span style={{ fontSize: '14px' }}>{dev.name}</span>
            </label>
          ))}
        </div>

        {transferSuccess && (
          <div style={{ padding: '12px', background: '#064e3b', borderRadius: '8px', color: '#34d399', fontSize: '14px', marginBottom: '16px' }}>
            ✓ Successfully dispatched to {targetDevices.length} device(s)!
          </div>
        )}

        <button
          onClick={handleShare}
          disabled={!content.trim() || targetDevices.length === 0}
          style={{
            padding: '12px 24px',
            background: content.trim() && targetDevices.length > 0 ? '#0284c7' : '#334155',
            color: '#f8fafc',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: content.trim() && targetDevices.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Send to Selected Devices
        </button>
      </div>
    </div>
  );
}
