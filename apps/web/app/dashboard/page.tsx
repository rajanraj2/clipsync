'use client';

import React, { useEffect, useState } from 'react';
import {
  addWebClip,
  getOrCreateWebSession,
  getSyncActiveState,
  loadHistoryPolicy,
  loadPairedDevices,
  loadWebClips,
  setSyncActiveState,
  WebClipItem,
  WebUserSession,
} from '../../services/web-storage';
import { readBrowserClipboard, writeBrowserClipboard } from '../../services/clipboard-diagnostics';

export default function DashboardPage() {
  const [session, setSession] = useState<WebUserSession | null>(null);
  const [syncActive, setSyncActive] = useState(true);
  const [clips, setClips] = useState<WebClipItem[]>([]);
  const [pairedCount, setPairedCount] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [readNotice, setReadNotice] = useState<string | null>(null);
  const [policyDays, setPolicyDays] = useState(30);

  useEffect(() => {
    const activeSession = getOrCreateWebSession();
    setSession(activeSession);
    setSyncActive(getSyncActiveState());
    setClips(loadWebClips());
    setPairedCount(loadPairedDevices().length);
    const policy = loadHistoryPolicy();
    setPolicyDays(policy.retentionDays ?? 30);
  }, []);

  const toggleSync = () => {
    const next = !syncActive;
    setSyncActive(next);
    setSyncActiveState(next);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim() || !session) return;
    const added = addWebClip(manualInput, session.currentDevice);
    setClips(loadWebClips());
    setManualInput('');
  };

  const handlePasteFromOS = async () => {
    if (!session) return;
    setReadNotice(null);
    const result = await readBrowserClipboard();
    if (result.text && result.text.trim()) {
      addWebClip(result.text, session.currentDevice);
      setClips(loadWebClips());
      setReadNotice('✓ Clipboard content imported into history!');
      setTimeout(() => setReadNotice(null), 3000);
    } else {
      setReadNotice(result.error ?? 'No text available or clipboard access was denied by your browser.');
      setTimeout(() => setReadNotice(null), 4000);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    const res = await writeBrowserClipboard(text);
    if (res.success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const totalBytes = clips.reduce((acc, c) => acc + c.sizeBytes, 0);
  const storageKb = (totalBytes / 1024).toFixed(1);

  return (
    <div>
      {/* Top Banner / First-Time Setup Welcome */}
      {clips.length === 0 && pairedCount === 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #0284c7', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>👋</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
              Welcome to ClipSync!
            </h3>
          </div>
          <p style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.5 }}>
            Your browser client is ready. Because web browsers require explicit user gestures for clipboard reading,
            you can paste items directly below or pair with your native macOS, Android, or Linux app for background sync.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handlePasteFromOS}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              📥 Paste OS Clipboard
            </button>
            <a
              href="/downloads"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#334155',
                color: '#f8fafc',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              📱 Download Native Apps
            </a>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Universal Clipboard & Synchronization Status {session ? `• Device: ${session.currentDevice.name}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handlePasteFromOS}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #38bdf8',
              background: 'transparent',
              color: '#38bdf8',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            📋 Paste Clipboard
          </button>
          <button
            onClick={toggleSync}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: syncActive ? '#0284c7' : '#e11d48',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{syncActive ? '⚡ Sync Active' : '⏸ Sync Paused'}</span>
          </button>
        </div>
      </div>

      {readNotice && (
        <div style={{ padding: '12px 16px', background: readNotice.startsWith('✓') ? '#064e3b' : '#7f1d1d', borderRadius: '8px', color: '#fff', fontSize: '13px', marginBottom: '20px' }}>
          {readNotice}
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Connected Devices</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#38bdf8' }}>
            1 <span style={{ fontSize: '14px', color: '#64748b' }}>active (this browser)</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {pairedCount} additional paired device(s)
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Saved Clipboard Items</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>
            {clips.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {clips.filter((c) => c.isPinned).length} pinned
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Local Storage</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>
            {storageKb} <span style={{ fontSize: '14px', color: '#64748b' }}>KB</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Indexed in local storage
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Retention Policy</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px', color: '#22c55e' }}>
            {policyDays} <span style={{ fontSize: '14px', color: '#64748b' }}>days</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Automatic cleanup active
          </div>
        </div>
      </div>

      {/* Manual Quick Add Form */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '20px 24px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Quick Add to Clipboard</h3>
        <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Type or paste any text or URL here to store in history..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: manualInput.trim() ? '#0284c7' : '#334155',
              color: '#fff',
              fontWeight: 600,
              cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
            }}
          >
            Save
          </button>
        </form>
      </div>

      {/* Recent Activity */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Recent Clipboard Activity</h3>
          <a href="/history" style={{ fontSize: '13px', color: '#38bdf8', textDecoration: 'none' }}>View All History →</a>
        </div>

        {clips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b', fontSize: '14px' }}>
            No clipboard entries yet. Use the quick add box above or click "Paste Clipboard".
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clips.slice(0, 5).map((clip) => (
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
                <div style={{ flex: 1, marginRight: '16px', overflow: 'hidden' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {clip.content}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: 600 }}>{clip.contentType}</span>
                    <span>•</span>
                    <span>{clip.sourceDeviceName}</span>
                    <span>•</span>
                    <span>{new Date(clip.createdAt).toLocaleTimeString()}</span>
                    {clip.isPinned && <span style={{ color: '#38bdf8', fontWeight: 600 }}>[Pinned]</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(clip.id, clip.content)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: copiedId === clip.id ? '#0284c7' : 'transparent',
                    color: copiedId === clip.id ? '#fff' : '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {copiedId === clip.id ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
