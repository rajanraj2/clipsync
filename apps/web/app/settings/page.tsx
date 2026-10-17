'use client';

import React, { useEffect, useState } from 'react';
import {
  getOrCreateWebSession,
  getSyncActiveState,
  loadHistoryPolicy,
  saveHistoryPolicy,
  saveWebSession,
  setSyncActiveState,
} from '../../services/web-storage';

export default function SettingsPage() {
  const [autoSync, setAutoSync] = useState(true);
  const [syncText, setSyncText] = useState(true);
  const [syncUrl, setSyncUrl] = useState(true);
  const [syncImage, setSyncImage] = useState(true);
  const [syncFile, setSyncFile] = useState(true);
  const [ignorePasswords, setIgnorePasswords] = useState(true);
  const [ignoreTokens, setIgnoreTokens] = useState(true);
  const [retentionDays, setRetentionDays] = useState('30');
  const [maxStorageMb, setMaxStorageMb] = useState(1024);
  const [relayUrl, setRelayUrl] = useState('https://clipsync-relay-raxan.fly.dev');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const session = getOrCreateWebSession();
    if (session.relayUrl) {
      setRelayUrl(session.relayUrl);
    }
    setAutoSync(getSyncActiveState());
    const policy = loadHistoryPolicy();
    if (policy.unlimitedRetention) {
      setRetentionDays('unlimited');
    } else if (policy.retentionDays) {
      setRetentionDays(String(policy.retentionDays));
    }
    setMaxStorageMb(Math.round(policy.maxStorageBytes / (1024 * 1024)));
  }, []);

  const handleSave = () => {
    setSyncActiveState(autoSync);

    const session = getOrCreateWebSession();
    session.relayUrl = relayUrl.trim();
    saveWebSession(session);

    const isUnlimited = retentionDays === 'unlimited';
    const days = isUnlimited ? null : Number(retentionDays);

    saveHistoryPolicy({
      id: 'custom',
      retentionDays: days,
      unlimitedRetention: isUnlimited,
      maxItems: 5000,
      maxStorageBytes: maxStorageMb * 1024 * 1024,
      cleanupEnabled: true,
      updatedAt: Date.now(),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Settings</h1>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
          Configure global synchronization preferences and retention policies
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Section: Clipboard Sync */}
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Synchronization Preferences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Automatic Synchronization</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Immediately sync when new clipboard content is detected</div>
              </div>
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Text & Code Snippets</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Synchronize plain text, formatted text, and code</div>
              </div>
              <input type="checkbox" checked={syncText} onChange={(e) => setSyncText(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Web URLs & Links</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Synchronize verified web URLs</div>
              </div>
              <input type="checkbox" checked={syncUrl} onChange={(e) => setSyncUrl(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Screenshots & Images</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Synchronize image pasteboard payloads</div>
              </div>
              <input type="checkbox" checked={syncImage} onChange={(e) => setSyncImage(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Files</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Permit direct file transfers between devices</div>
              </div>
              <input type="checkbox" checked={syncFile} onChange={(e) => setSyncFile(e.target.checked)} />
            </label>
          </div>
        </div>

        {/* Section: Privacy */}
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Privacy & Credential Isolation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Ignore Password Managers</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Detect concealment markers (1Password, Bitwarden, KeePass)</div>
              </div>
              <input type="checkbox" checked={ignorePasswords} onChange={(e) => setIgnorePasswords(e.target.checked)} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Exclude Authentication Tokens</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Heuristically detect and block private keys and bearer tokens</div>
              </div>
              <input type="checkbox" checked={ignoreTokens} onChange={(e) => setIgnoreTokens(e.target.checked)} />
            </label>
          </div>
        </div>

        {/* Section: History Retention Policy */}
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>History Retention Policy</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', fontWeight: 500 }}>
                Automatic Retention Duration
              </label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                }}
              >
                <option value="1">1 Day</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days (Recommended)</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
                <option value="365">1 Year</option>
                <option value="unlimited">Never Automatically Expire</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', fontWeight: 500 }}>
                Maximum Storage Allocation ({maxStorageMb} MB)
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={maxStorageMb}
                onChange={(e) => setMaxStorageMb(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Section: Public Encrypted Relay Server */}
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Encrypted Relay Connection</h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8' }}>
            Connects across firewalls and cellular networks when devices are not on the same local Wi-Fi.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Relay Server URL (HTTPS / WSS)
            </label>
            <input
              type="text"
              value={relayUrl}
              onChange={(e) => setRelayUrl(e.target.value)}
              placeholder="https://clipsync-relay-raxan.fly.dev"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#38bdf8',
                fontFamily: 'monospace',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        {saved && (
          <div style={{ padding: '12px', background: '#064e3b', borderRadius: '8px', color: '#34d399', fontSize: '14px' }}>
            ✓ Configuration saved and applied!
          </div>
        )}

        <button
          onClick={handleSave}
          style={{
            padding: '12px',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
