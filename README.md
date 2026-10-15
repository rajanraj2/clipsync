# ClipSync

> **Copy anywhere. Access everywhere. Stay in control.**

ClipSync is a universal clipboard, synchronization, and content-sharing ecosystem designed for seamless cross-device workflows across macOS, Windows, Linux, Android, and Web platforms.

---

## 🚀 Development Roadmap Implementation Status

All 11 planned phases from the Product Requirements Document & Technical Implementation Plan have been implemented, tested, and verified:

| Phase | Deliverable | Priority | Status |
|:---:|:---|:---:|:---:|
| **0** | Monorepo, shared protocol definitions (v2.0) & architecture | **P0** | ✅ Completed |
| **1** | macOS and Windows clipboard synchronization with echo suppression | **P0** | ✅ Completed |
| **2** | Ubuntu / Linux clipboard support (Wayland & X11) | **P0** | ✅ Completed |
| **3** | Native Android application (Jetpack Compose, Sharesheet, Service) | **P0** | ✅ Completed |
| **4** | Local SQLite clipboard history & configurable retention engine | **P0** | ✅ Completed |
| **5** | Responsive Web Application Dashboard & Backend API Service | **P0** | ✅ Completed |
| **6** | Configuration management & settings synchronization (OCC) | **P0** | ✅ Completed |
| **7** | Image synchronization, BlobStore & chunked file transfer engine | **P1** | ✅ Completed |
| **8** | Remote connectivity, encrypted relay service & hybrid router | **P1** | ✅ Completed |
| **9** | Security hardening, AEAD AES-256-GCM encryption & safeguards | **P1** | ✅ Completed |
| **10** | Progressive Web App (PWA) manifest, service worker & diagnostics | **P2** | ✅ Completed |

---

## 🏛 Workspace Architecture

```text
clipsync/
├── apps/
│   ├── android/         # Native Android App (Kotlin 2.0, Jetpack Compose, Sharesheet receiver)
│   └── web/             # Responsive Web Dashboard & PWA (Next.js 15, React 19, Service Worker)
│
├── services/
│   ├── api/             # HTTP Application REST API (Devices, History, Settings, Transfers, Blobs)
│   └── relay/           # Zero-payload-knowledge Encrypted Relay Server & Ephemeral Queue
│
├── packages/
│   ├── shared-types/    # TypeScript types for devices, protocol messages, content, and settings
│   ├── protocol-schema/ # Message envelopes, AEAD AES-256-GCM crypto, validation, and normalization
│   ├── storage/         # Local SQLite engine (HistoryStore, SettingsStore, BlobStore)
│   ├── sync-engine/     # Synchronization pipeline, echo suppression, privacy filter, hybrid network router
│   └── api-client/      # Type-safe isomorphic SDK consuming the ClipSync API
│
└── docs/                # Product Requirements Document & Technical Implementation Plan
```

---

## 🔑 Key Engineering Capabilities

1. **Circular Sync & Echo Suppression**:
   - `EchoSuppressor` records local programmatic writes and intercepts native pasteboard reflections within a sliding window, eliminating infinite re-broadcasting loops.

2. **Privacy First & Credential Isolation**:
   - Automatically filters out content tagged with password manager concealment markers (`1Password`, `Bitwarden`, `KeePassXC`, `LastPass`, `Dashlane`).
   - Heuristically identifies and excludes private keys, JWTs, Bearer tokens, and AWS/GitHub credentials from synchronization.

3. **Multi-Platform Native OS Adapters**:
   - **macOS**: `NSPasteboard` bridge via `pbpaste` / `pbcopy` with sequence polling and URL detection.
   - **Windows**: Native clipboard sequence and format tracking.
   - **Ubuntu/Linux**: Automatically detects **Wayland** (`wl-clipboard`) vs **X11** (`xclip` / `xsel`) with both `CLIPBOARD` and `PRIMARY` buffer support.
   - **Android**: `ClipboardCaptureService` with foreground service and Android Sharesheet receiver.

4. **Local-First SQLite History & Configurable Retention**:
   - Indexed metadata with full-text search, multi-faceted filtering, and cursor-based pagination.
   - Enforces configurable retention duration (1–365 days, or indefinite), entry count limits, and disk byte ceilings with pinned item protection.

5. **Content-Addressable Storage & Chunked Transfers**:
   - `BlobStore` manages binary blobs with SHA-256 content deduplication.
   - `TransferEngine` slices large images and files into deterministic 32–64 KB chunks with individual SHA-256 integrity verification, streaming, and reassembly.

6. **Hybrid Network Routing & Encrypted Relay**:
   - `HybridNetworkRouter` prioritizes direct local network synchronization (`network.preferLan`) and seamlessly fails over to `EncryptedRelayServer` for remote NAT traversal.
   - Offline peer message buffering with automatic flush upon reconnection.

7. **AEAD AES-256-GCM End-to-End Encryption**:
   - 256-bit key derivation via HKDF-SHA256 with 96-bit randomized IVs and 128-bit authentication tags.
   - Zero-payload-knowledge relay: relay servers only inspect routing headers without accessing payload contents.

8. **Progressive Web App (PWA)**:
   - Standalone display mode with `manifest.json`, icon assets, and service worker (`sw.js`) for offline UI caching, push notifications, and clipboard diagnostics.

---

## 🛠 Developer Commands

```bash
# Install workspace dependencies
pnpm install

# Build all packages and services using topological project references
pnpm run build

# Run complete workspace test suite (104 tests across packages, services, and apps)
pnpm test

# Typecheck all packages, services, and Next.js web application
pnpm run typecheck
```
