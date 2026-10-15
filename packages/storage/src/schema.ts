export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clipboard_items (
    id TEXT PRIMARY KEY,
    source_device_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content TEXT NOT NULL,
    preview TEXT,
    size_bytes INTEGER NOT NULL,
    hash TEXT NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_favourite INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clipboard_hash ON clipboard_items(hash);
CREATE INDEX IF NOT EXISTS idx_clipboard_created_at ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_device ON clipboard_items(source_device_id);
CREATE INDEX IF NOT EXISTS idx_clipboard_type ON clipboard_items(content_type);
CREATE INDEX IF NOT EXISTS idx_clipboard_pinned ON clipboard_items(is_pinned);

CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, setting_key)
);

CREATE TABLE IF NOT EXISTS device_settings (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(device_id, setting_key)
);

CREATE TABLE IF NOT EXISTS setting_definitions (
    setting_key TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    default_value TEXT NOT NULL,
    value_type TEXT NOT NULL,
    validation_schema TEXT,
    is_user_configurable INTEGER NOT NULL,
    is_device_overridable INTEGER NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS history_policy (
    id TEXT PRIMARY KEY,
    retention_days INTEGER,
    unlimited_retention INTEGER NOT NULL DEFAULT 0,
    max_items INTEGER NOT NULL DEFAULT 5000,
    max_storage_bytes INTEGER NOT NULL DEFAULT 1073741824,
    cleanup_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);
`;
