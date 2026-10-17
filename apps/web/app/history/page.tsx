'use client';

import React, { useEffect, useState } from 'react';
import {
  clearAllWebClips,
  deleteWebClip,
  loadWebClips,
  toggleFavWebClip,
  togglePinWebClip,
  WebClipItem,
} from '../../services/web-storage';
import { writeBrowserClipboard } from '../../services/clipboard-diagnostics';

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [clips, setClips] = useState<WebClipItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setClips(loadWebClips());
  }, []);

  const handleCopy = async (id: string, text: string) => {
    const res = await writeBrowserClipboard(text);
    if (res.success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleTogglePin = (id: string) => {
    togglePinWebClip(id);
    setClips(loadWebClips());
  };

  const handleToggleFav = (id: string) => {
    toggleFavWebClip(id);
    setClips(loadWebClips());
  };

  const handleDelete = (id: string) => {
    deleteWebClip(id);
    setClips(loadWebClips());
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your local clipboard history?')) {
      clearAllWebClips();
      setClips([]);
    }
  };

  const filtered = clips.filter((c) => {
    const matchesSearch = c.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === 'all' || c.contentType === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Clipboard History</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            {clips.length} item(s) preserved in local browser storage
          </p>
        </div>
        {clips.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e11d48',
              background: 'transparent',
              color: '#fb7185',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Clear All History
          </button>
        )}
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
      {filtered.length === 0 ? (
        <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '48px', textAlign: 'center', color: '#64748b' }}>
          {clips.length === 0
            ? 'Your clipboard history is empty. Go to the Dashboard or Quick Share to copy or paste content.'
            : 'No items match your filter criteria.'}
        </div>
      ) : (
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
                gap: '16px',
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f8fafc', wordBreak: 'break-all', maxHeight: '72px', overflow: 'hidden' }}>
                  {item.content}
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#64748b', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: 600 }}>{item.contentType}</span>
                  <span>•</span>
                  <span>{item.sourceDeviceName}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  {item.isPinned && <span style={{ color: '#38bdf8', fontWeight: 600 }}>[Pinned]</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => handleCopy(item.id, item.content)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: copiedId === item.id ? '#0284c7' : '#0f172a',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {copiedId === item.id ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => handleTogglePin(item.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: item.isPinned ? '#0369a1' : '#0f172a',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {item.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => handleToggleFav(item.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: item.isFavourite ? '#eab308' : '#0f172a',
                    color: item.isFavourite ? '#000' : '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {item.isFavourite ? '★ Starred' : '☆ Star'}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e11d48',
                    background: 'transparent',
                    color: '#fb7185',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
