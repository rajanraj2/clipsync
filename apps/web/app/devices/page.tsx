'use client';

import React, { useState } from 'react';

interface Device {
  id: string;
  name: string;
  platform: string;
  status: 'online' | 'offline';
  appVersion: string;
  lastSeen: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([
    { id: 'mac-1', name: "Rajan's MacBook Pro", platform: 'macOS', status: 'online', appVersion: '0.1.0', lastSeen: 'Just now' },
    { id: 'win-1', name: "ThinkPad X1 Carbon", platform: 'Windows', status: 'online', appVersion: '0.1.0', lastSeen: '5m ago' },
    { id: 'lin-1', name: "Ubuntu Workstation", platform: 'Ubuntu', status: 'offline', appVersion: '0.1.0', lastSeen: '2h ago' },
  ]);

  const [showPairModal, setShowPairModal] = useState(false);

  const revokeDevice = (id: string) => {
    if (confirm('Are you sure you want to revoke this device? It will stop synchronizing clipboard items.')) {
      setDevices(devices.filter((d) => d.id !== id));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Device Management</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>Authorize, configure, and monitor connected native ClipSync agents</p>
        </div>
        <button
          onClick={() => setShowPairModal(true)}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: '#0284c7',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          + Pair New Device
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {devices.map((dev) => (
          <div
            key={dev.id}
            style={{
              padding: '24px',
              background: '#1e293b',
              borderRadius: '12px',
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: '#38bdf8' }}>{dev.platform}</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: dev.status === 'online' ? '#064e3b' : '#334155',
                  color: dev.status === 'online' ? '#34d399' : '#94a3b8',
                }}>
                  {dev.status}
                </span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600 }}>{dev.name}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>App v{dev.appVersion} • Seen {dev.lastSeen}</p>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>ID: {dev.id}</span>
              <button
                onClick={() => revokeDevice(dev.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fb7185',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Revoke Access
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pairing Modal */}
      {showPairModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            border: '1px solid #334155',
            padding: '32px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700 }}>Pair Device</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#94a3b8' }}>
              Open ClipSync on your desktop or Android phone and scan this pairing code.
            </p>

            <div style={{
              width: '180px',
              height: '180px',
              margin: '0 auto 20px',
              background: '#0f172a',
              borderRadius: '12px',
              border: '2px dashed #38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#38bdf8',
              fontWeight: 600,
            }}>
              [QR CODE PLACEHOLDER]
            </div>

            <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '4px', marginBottom: '24px' }}>
              SYNC-8492
            </div>

            <button
              onClick={() => setShowPairModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: '#334155',
                color: '#f8fafc',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
