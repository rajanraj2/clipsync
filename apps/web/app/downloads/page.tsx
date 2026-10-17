'use client';

import React, { useState } from 'react';
import { toAppUrl } from '../../services/url-helper';
export default function DownloadsPage() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const channels = [
    {
      title: 'macOS Desktop App',
      tag: 'Native DMG',
      badgeColor: '#38bdf8',
      desc: 'Native macOS menu-bar app with system-wide pasteboard hooks and background synchronization.',
      primaryBtn: {
        text: 'Download .DMG (macOS)',
        url: 'https://github.com/rajanraj2/clipsync/releases/download/v0.1.2/ClipSync-macOS.dmg',
      },
      cliAlt: 'brew install rajanraj2/tap/clipsync',
      cliLabel: 'brew',
    },
    {
      title: 'Android Mobile App',
      tag: 'Native APK',
      badgeColor: '#22c55e',
      desc: 'Native Android app featuring Jetpack Compose Material 3 UI, foreground service, and Sharesheet integration.',
      primaryBtn: {
        text: 'Download .APK (Android)',
        url: 'https://github.com/rajanraj2/clipsync/releases/download/v0.1.2/ClipSync-Android.apk',
      },
      cliAlt: 'adb install ClipSync-Android.apk',
      cliLabel: 'adb',
    },
    {
      title: 'Progressive Web App (PWA)',
      tag: 'Web Browser',
      badgeColor: '#eab308',
      desc: 'Zero-install responsive web dashboard. Works in Chrome, Safari, Firefox, and Edge with offline caching.',
      primaryBtn: {
        text: 'Open Web Dashboard',
        url: toAppUrl('/dashboard'),
      },
      cliAlt: 'PWA Offline Ready • Protocol v2.0',
      cliLabel: 'web',
    },
    {
      title: 'CLI & Node.js Package',
      tag: 'NPM Registry',
      badgeColor: '#ec4899',
      desc: 'Command-line interface to synchronize, stream, and inspect clipboard history directly from your terminal.',
      primaryBtn: {
        text: 'View on NPM',
        url: 'https://www.npmjs.com/package/@clipsync/cli',
      },
      cliAlt: 'npm install -g @clipsync/cli',
      cliLabel: 'npm',
    },
  ];

  return (
    <div style={{ maxWidth: '880px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Download ClipSync
        </h1>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '16px' }}>
          Available natively across macOS, Windows, Linux, Android, Web, Homebrew, and NPM.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {channels.map((ch) => (
          <div
            key={ch.title}
            style={{
              padding: '28px',
              background: '#1e293b',
              borderRadius: '16px',
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: ch.badgeColor }}>
                  {ch.tag}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Release v0.1.2</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>{ch.title}</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>{ch.desc}</p>
            </div>

            <div style={{ marginTop: '24px' }}>
              <a
                href={ch.primaryBtn.url}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  textDecoration: 'none',
                  marginBottom: '12px',
                }}
              >
                {ch.primaryBtn.text}
              </a>

              <div
                onClick={() => copyToClipboard(ch.cliAlt, ch.cliLabel)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#0f172a',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#cbd5e1',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.cliAlt}
                </span>
                <span style={{ fontSize: '11px', color: '#38bdf8', marginLeft: '12px', flexShrink: 0 }}>
                  {copiedCmd === ch.cliLabel ? '✓ Copied' : 'Copy'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
