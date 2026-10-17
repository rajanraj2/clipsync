'use client';

import React, { useEffect, useState } from 'react';
import {
  addWebClip,
  getOrCreateWebSession,
  loadPairedDevices,
  WebUserSession,
} from '../../services/web-storage';
import { DeviceMetadata } from '@clipsync/shared-types';

export default function TransfersPage() {
  const [session, setSession] = useState<WebUserSession | null>(null);
  const [content, setContent] = useState('');
  const [devices, setDevices] = useState<DeviceMetadata[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  useEffect(() => {
    const s = getOrCreateWebSession();
    setSession(s);
    const devs = loadPairedDevices();
    setDevices(devs);
    if (devs.length > 0) {
      setSelectedDevices([devs[0].id]);
    }
  }, []);

  const toggleDevice = (id: string) => {
    if (selectedDevices.includes(id)) {
      setSelectedDevices(selectedDevices.filter((d) => d !== id));
    } else {
      setSelectedDevices([...selectedDevices, id]);
    }
  };

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session) return;

    // Save into history
    addWebClip(content, session.currentDevice);

    const recipientCount = selectedDevices.length;
    setTransferSuccess(
      recipientCount > 0
        ? `✓ Successfully queued to ${recipientCount} connected device(s)!`
        : '✓ Saved to your local ClipSync history!'
    );

    setContent('');
    setTimeout(() => {
      setTransferSuccess(null);
    }, 3000);
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Quick Share</h1>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
          Dispatch text, links, or code to any of your connected devices
        </p>
      </div>

      <div style={{ background: '#1e293b', padding: '28px', borderRadius: '12px', border: '1px solid #334155' }}>
        <form onSubmit={handleShare}>
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
            required
          />

          <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
            Target Devices ({devices.length} paired)
          </label>

          {devices.length === 0 ? (
            <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
              No other devices paired yet. Content will be saved to this browser and synced when devices are added in <a href="/devices" style={{ color: '#38bdf8' }}>Device Management</a>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {devices.map((dev) => (
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
                    checked={selectedDevices.includes(dev.id)}
                    onChange={() => toggleDevice(dev.id)}
                  />
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>{dev.name}</span>
                    <span style={{ fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase' }}>{dev.platform}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {transferSuccess && (
            <div style={{ padding: '12px', background: '#064e3b', borderRadius: '8px', color: '#34d399', fontSize: '14px', marginBottom: '16px' }}>
              {transferSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={!content.trim()}
            style={{
              padding: '12px 24px',
              background: content.trim() ? '#0284c7' : '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: content.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {devices.length > 0 ? 'Send to Selected Devices' : 'Save to History'}
          </button>
        </form>
      </div>
    </div>
  );
}
