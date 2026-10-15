# ClipSync

> **Copy anywhere. Access everywhere. Stay in control.**

ClipSync is a universal clipboard, synchronization, and content-sharing ecosystem designed for seamless cross-device workflows across native desktop, Android, and web platforms.

---

## 📖 Documentation

The full technical implementation plan and product requirements are available in the [`docs/`](docs/) directory:

- [Product Requirements Document & Technical Implementation Plan](docs/PRD.md) (`docs/technical-spec.md`)

---

## 🏛 Architecture Overview

ClipSync uses a hybrid, local-first architecture:

1. **Native Desktop Apps (`apps/desktop`)**: Tauri 2 (React + TypeScript + Rust) for deep OS clipboard integration and background synchronization on macOS, Windows, and Linux.
2. **Native Android App (`apps/android`)**: Kotlin + Jetpack Compose with hybrid clipboard capture and Sharesheet integration.
3. **Web Application & PWA (`apps/web`)**: Next.js (React + TypeScript + Tailwind CSS) providing responsive history browsing, device management, and manual sharing.
4. **Shared Core Engine (`crates/`)**: Rust-based core managing protocol definitions, cryptography, SQLite local storage, conflict resolution, and peer discovery (LAN / P2P / Relay).
5. **Backend API & Services (`services/`)**: Lightweight independent services (Axum-based) for device discovery, relay, and browser session integration.

---

## 🔑 Key Features

- **Configuration-Driven Design**: All behaviors (sync scope, retention, network modes, device overrides) controlled via granular settings hierarchy.
- **Local-First & Encrypted**: Local SQLite metadata and encrypted blob storage with end-to-end encrypted peer-to-peer transport.
- **Selective Synchronization**: Filter by content type (text, URLs, images, files) with configurable retention policies and size safeguards.
- **Privacy First**: Sensitive content exclusion, password manager isolation, and no clipboard payloads in logs or analytics.
