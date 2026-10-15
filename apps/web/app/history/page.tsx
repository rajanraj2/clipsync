'use client';

import React, { useState } from 'react';

interface Clip {
  id: string;
  content: string;
  contentType: string;
  sourceDevice: string;
  isPinned: boolean;
  isFavourite: boolean;
  createdAt: string;
}

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const [clips, setClips] = useState<Clip[]>([
    { id: '1', content: 'https://github.com/rajanraj2/clipsync', contentType: 'url', sourceDevice: 'MacBook Pro', isPinned: true, isFavourite: true, createdAt: '10m ago' },
    { id: '2', content: 'pnpm --filter @clipsync/api run build', contentType: 'text', sourceDevice: 'ThinkPad X1', isPinned: false, isFavourite: false, createdAt: '25m ago' },
    { id: '3', content: 'ssh zorax@ubuntu-dev.lan', contentType: 'text', sourceDevice: 'Ubuntu Workstation', isPinned: false, isFavourite: true, createdAt: '2h ago' },
  ]);

  const togglePin = (id: string) => {
    setClips(clips.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)));
  };

  const toggleFav = (id: string) => {
    setClips(clips.map((c) => (c.id === id ? { ...c, isFavourite: !c.isFavourite } : c)));
  };

  const deleteItem = (id: string) => {
    setClips(clips.filter((c) => c.id !== id));
  };

  const filtered = clips.filter((c) => {
    const matchesSearch = c.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === 'all' || c.contentType === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Clipboard History</h1>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>Browse, search, and manage historical synchronized items</p>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search history content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '240px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '14px',
          }}
        />

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '14px',
          }}
        >
          <option value="all">All Content Types</option>
          <option value="text">Text</option>
          <option value="url">URLs</option>
          <option value="image">Images</option>
          <option value="file">Files</option>
        </select>
      </div>

      {/* Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '16px 20px',
              background: '#1e293b',
              borderRadius: '10px',
              border: item.isPinned ? '1px solid #38bdf8' : '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, marginRight: '16px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f8fafc', wordBreak: 'break-all' }}>
                {item.content}
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: 600 }}>{item.contentType}</span>
                <span>•</span>
                <span>{item.sourceDevice}</span>
                <span>•</span>
                <span>{item.createdAt}</span>
                {item.isPinned && <span style={{ color: '#38bdf8', fontWeight: 600 }}>[Pinned]</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigator.clipboard.writeText(item.content)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', cursor: 'pointer', fontSize: '12px' }}
              >
                Copy
              </button>
              <button
                onClick={() => togglePin(item.id)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #475569', background: item.isPinned ? '#0369a1' : '#0f172a', color: '#f8fafc', cursor: 'pointer', fontSize: '12px' }}
              >
                {item.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={() => toggleFav(item.id)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #475569', background: item.isFavourite ? '#eab308' : '#0f172a', color: item.isFavourite ? '#000' : '#f8fafc', cursor: 'pointer', fontSize: '12px' }}
              >
                {item.isFavourite ? '★ Starred' : '☆ Star'}
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e11d48', background: 'transparent', color: '#fb7185', cursor: 'pointer', fontSize: '12px' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
