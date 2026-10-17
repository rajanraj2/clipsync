'use client';

import React, { useEffect, useState } from 'react';
import { toAppUrl } from '../services/url-helper';

export function NavigationLinks() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const links = [
    { label: 'Dashboard', path: '/dashboard', primary: true },
    { label: 'History', path: '/history', primary: false },
    { label: 'Devices', path: '/devices', primary: false },
    { label: 'Quick Share', path: '/transfers', primary: false },
    { label: 'Settings', path: '/settings', primary: false },
    { label: 'Downloads & Channels', path: '/downloads', primary: false, highlight: true },
  ];

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {links.map((link) => {
        const href = mounted ? toAppUrl(link.path) : link.path;
        return (
          <a
            key={link.path}
            href={href}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: link.highlight ? 600 : 500,
              background: link.primary ? '#334155' : 'transparent',
              color: link.highlight ? '#38bdf8' : link.primary ? '#f1f5f9' : '#cbd5e1',
            }}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
