'use client';

import React, { useEffect, useState } from 'react';
import {
  getOrCreateWebSession,
  loadPairedDevices,
  pairNewDevice,
  removePairedDevice,
  WebUserSession,
} from '../../services/web-storage';
import { DeviceMetadata } from '@clipsync/shared-types';

export default function DevicesPage() {
  const [session, setSession] = useState<WebUserSession | null>(null);
  const [devices, setDevices] = useState<DeviceMetadata[]>([]);
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairName, setPairName] = useState('');
  const [pairPlatform, setPairPlatform] = useState<DeviceMetadata['platform']>('macos');
  const [generatedPairCode, setGeneratedPairCode] = useState('SYNC-7749');

  useEffect(() => {
    setSession(getOrCreateWebSession());
    setDevices(loadPairedDevices());
    setGeneratedPairCode(`SYNC-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  const handleRevoke = (id: string) => {
    if (confirm('Revoke access for this device? It will be disconnected from clipboard synchronization.')) {
      removePairedDevice(id);
      setDevices(loadPairedDevices());
    }
  };

  const handleAddManualDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairName.trim()) return;

    pairNewDevice({
      id: `${pairPlatform}-${Math.random().toString(36).substring(2, 7)}`,
      name: pairName.trim(),
      platform: pairPlatform,
      appVersion: '0.1.0',
      status: 'online',
      trustLevel: 'paired',
      capabilities: {
        backgroundClipboardMonitoring: pairPlatform !== 'web',
        osClipboardHook: ['macos', 'windows'].includes(pairPlatform),
        hybridCapture: pairPlatform === 'android',
        directFileAccess: pairPlatform !== 'web',
        browserRestricted: pairPlatform === 'web',
      },
    });

    setDevices(loadPairedDevices());
    setPairName('');
    setShowPairModal(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Device Management</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Authorized devices connected to your ClipSync cluster
          </p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Current Browser Card */}
        {session && (
          <div
            style={{
              padding: '24px',
              background: '#1e293b',
              borderRadius: '12px',
              border: '2px solid #38bdf8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
                  THIS DEVICE (WEB)
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: '#064e3b',
                  color: '#34d399',
                }}>
                  Online • Active
                </span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600 }}>{session.currentDevice.name}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                ID: {session.currentDevice.id}
              </p>
            </div>
            <div style={{ marginTop: '20px', fontSize: '12px', color: '#64748b', borderTop: '1px solid #334155', paddingTop: '12px' }}>
              Web context: Manual copy/paste & PWA offline cache enabled
            </div>
          </div>
        )}

        {/* Paired Remote Devices */}
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
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                App v{dev.appVersion} • Registered {new Date(dev.registeredAt).toLocaleDateString()}
              </p>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>{dev.id}</span>
              <button
                onClick={() => handleRevoke(dev.id)}
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
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            border: '1px solid #334155',
            padding: '28px',
            maxWidth: '440px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Pair New Device</h3>
              <button onClick={() => setShowPairModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px', padding: '16px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Cluster Pairing Code</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', letterSpacing: '3px', fontFamily: 'monospace' }}>
                {generatedPairCode}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Enter this code on your native app or scan from the camera
              </div>
            </div>

            <form onSubmit={handleAddManualDevice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Device Name</label>
                <input
                  type="text"
                  placeholder="e.g. Work MacBook Pro, Pixel 8..."
                  value={pairName}
                  onChange={(e) => setPairName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Platform</label>
                <select
                  value={pairPlatform}
                  onChange={(e) => setPairPlatform(e.target.value as DeviceMetadata['platform'])}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="macos">macOS Desktop</option>
                  <option value="windows">Windows Desktop</option>
                  <option value="linux">Ubuntu / Linux</option>
                  <option value="android">Android Phone</option>
                  <option value="web">Another Browser</option>
                </select>
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Confirm Pairing
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
