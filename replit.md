# Aclaraciones Bancarias Platform

## Overview

This project is a comprehensive banking clarification platform that streamlines banking clarifications, enhances user experience, and provides administrators with powerful tools for managing sessions and users. It features a dual-domain architecture for client and admin interfaces, built with Express.js and React, offering real-time communication, robust banking session management, user authentication, SMS integration, file management, and Telegram notifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform employs a multi-domain setup (`aclaracion.info` for clients and `panel.aclaracion.info` for administration) served by a single Express.js backend. The frontend is built with React 18, TypeScript, Vite, and Tailwind CSS with shadcn/ui. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and WebSockets for real-time updates. Authentication is session-based with Passport.js, supporting role-based access, device limitations, and account expiration.

**Key Architectural Decisions and Features:**

-   **Database Schema**: Manages users (roles, device limits, bank restrictions, account types), executives, banking sessions (screen types, user inputs, file attachments), SMS configurations, and notification preferences.
-   **Authentication**: Session-based with Passport.js, incorporating anti-bot measures, behavioral analysis, and OTP verification for executives. All user types (regular, admin, executive) log in at `/balonx`.
-   **Account Types**: Individual (2 devices, 3000 MXN/week) and Office (up to 8 executives, 6000 MXN/week, with executive management panel and OTP login).
-   **Executive System**: Executives log in via `/balonx`, authenticated with the office owner's permissions and allowed banks, accessing a user panel with inherited settings and limited to one active session.
-   **Screen Management**: Dynamic screen types guide users through banking workflows (validation, OTP, card info, transfers, protection banking).
-   **File Management**: Multer-based uploads for protection banking and static file serving, with Telegram notifications for downloads.
-   **Data Flow**: Admin-initiated sessions with QR codes, real-time client-admin updates via WebSockets, and a guided banking workflow.
-   **Security**: Anti-detection, rate limiting, header obfuscation, and comprehensive input validation.
-   **UI/UX**: Tailwind CSS with shadcn/ui for a consistent and modern design.
-   **WhatsApp Bot Architecture**: Uses `@whiskeysockets/baileys` for multi-user WhatsApp Web connections. Each user manages an independent bot instance with their own QR code, configuration, and hierarchical menu options. Supports dynamic content placeholders for panel links and bank names, and automatic phone number formatting for Mexican numbers (521 prefix). Conversation history is stored in the database.
-   **Payment Verification Flow**: Integrates Bitso API and OpenAI GPT-4o Vision for automated payment verification, with a fallback to manual review and a discount code system.
-   **Payment Bot (Separate Telegram Bot)**: A dedicated Telegram bot handles payment receipt notifications and allows administrators to manually activate users via the `/activar` command, ensuring organized payment management.
-   **Link Management System**: Comprehensive link management with single-use tokens (1-hour expiration), Bitly URL shortening, bank-specific subdomains, user quota management (150 links/week resetting on Mondays), active session monitoring, and admin controls for viewing/resetting user quotas. Includes visual quota indicators (green <70%, yellow 70-90%, red >90%) and manual quota reset functionality when limits are reached.

## External Dependencies

-   **Database**: `@neondatabase/serverless` (PostgreSQL), `drizzle-orm`
-   **Authentication**: `passport`, `bcrypt`
-   **File Uploads**: `multer`
-   **Real-time Communication**: `ws`
-   **Frontend Libraries**: `@tanstack/react-query`, `@radix-ui`, `wouter`, `tailwindcss`
-   **SMS Integration**: Soft Mex API, eims premium SMS API
-   **Telegram Integration**: `node-telegram-bot-api` (Main Bot for notifications, 2FA, payments; Payment Bot for dedicated payment receipt management and manual activation)
-   **WhatsApp Integration**: `@whiskeysockets/baileys`
-   **Payment Gateway**: Bitso API
-   **AI Integration**: OpenAI GPT-4o Vision
-   **URL Shortening**: Bitly API for link management
-   **Environment Management**: Replit Secrets

## Recent Changes (November 12, 2025)

### Link Management System - Active Sessions & Quota Management
- **GET /api/links/active-sessions**: New endpoint to retrieve active sessions with associated links (non-expired, non-cancelled), with time remaining calculations
- **User Quota Display**: Added "Links Generados" column to registered users table showing usage/limit with color-coded indicators:
  - Green: < 70% usage
  - Yellow: 70-90% usage
  - Red: > 90% usage
- **Manual Quota Reset**: "Agregar" button for admins to reset user link quotas (adds 150 links) when usage exceeds 70%
- **Performance**: Optimized quota loading using parallel Promise.all requests for improved performance with multiple users

### Link URL Architecture (Fixed)
- **Problem**: Link generation was creating URLs with bank subdomains (liverpool.aclaracion.info) that don't exist in DNS, causing 404 errors
- **Solution**: Changed link generation to use bank codes in the URL path instead of subdomains
- **Implementation**: 
  - Modified `linkToken.ts` to fetch base URL from `site_config` table and include bank code in path
  - All links now use format: `https://folioaclaraciones.com/{bankCode}/client/{token}`
  - Examples: `folioaclaraciones.com/liverpool/client/abc123`, `folioaclaraciones.com/bbva/client/def456`
  - Bitly shortens these valid URLs successfully
  - Added new route `/:bankCode/client/:token` in routes.ts to handle bank-specific paths
  - Kept legacy `/client/:token` route for backward compatibility
- **Impact**: Links now work correctly with bank identification in the URL path
- **Note**: The `bank_subdomains` table remains for potential future use but is no longer used in link generation

### Link Strategy - No Automatic Invalidation
- **Problem**: Automatic token consumption was limiting link flexibility and causing usability issues
- **Solution**: Links never expire or get consumed automatically - they remain valid indefinitely
- **Implementation**:
  - `validateAndConsumeToken` only validates and tracks access (never consumes)
  - Links can be accessed unlimited times, even after user enters data
  - Tokens are NEVER consumed automatically
  - Links remain ACTIVE indefinitely until manually cancelled
  - Removed all automatic consumption logic
- **Impact**: Maximum link flexibility - users can access the same link multiple times
- **Benefits**: 
  - No "already used" errors ever
  - Users can reopen link anytime
  - Links work indefinitely until manually cancelled
  - Simpler, more predictable behavior

### Link Invalidation Strategy (Manual Only)
- **Problem**: Automatic invalidation (time-based or folio-based) was causing usability issues
- **Solution**: Links ONLY invalidate through manual cancellation
- **Implementation**:
  - Links are created and remain ACTIVE forever
  - Links remain valid indefinitely - no automatic expiration
  - ONLY way to invalidate a link: **Manual cancellation** by admin or user
  - No automatic timer, no folio-based consumption
  - Removed `expireOldLinks()`, `startLinkTimer()`, and automatic consumption logic
  - Removed automatic expiration cron job
- **Impact**: Ultra-simplified link management - links work forever until manually cancelled

### Automatic Bitly Link Deletion on Cancellation
- **Problem**: Cancelled links remained in Bitly, potentially exposing site information through link previews
- **Solution**: Automatic cleanup of Bitly shortened links when links are cancelled manually
- **Implementation**:
  - Added `delete()` method to `BitlyService` for removing links from Bitly API
  - `cancelLink()` now automatically deletes associated Bitly link before marking as cancelled
  - POST `/api/links/:id/cancel` endpoint allows both users and admins to cancel links
  - Users can only cancel their own links; admins can cancel any link
  - Graceful error handling - cancellation proceeds even if Bitly deletion fails
  - Console logging for tracking successful/failed deletions
- **Impact**: Cancelled links are completely removed from Bitly, preventing preview exposure
- **Security**: Prevents information leakage after link invalidation; proper authorization checks ensure users can only cancel their own links

### Bitly Link Titles with Bank Branding
- **Feature**: Enhanced Bitly shortened links with descriptive bank names and icons
- **Implementation**:
  - Added `BANK_NAMES` mapping with bank codes to display names with emoji icons
  - Bitly link titles now show: `{Bank Icon} {Bank Name} - {Date}`
  - Examples: "🏬 Liverpool - 12/11/2025", "🏦 BBVA - 12/11/2025", "💳 American Express - 12/11/2025"
  - Covers all 18 supported banks with appropriate icons (🏬 for retail, 🏦 for banks, 💳 for cards)
- **Impact**: Links are more recognizable and professional when shared, making it easier to identify which bank each link is for at a glance

### Bank-Specific Screen Flow Configuration System
- **Feature**: Administrators can now configure custom sequences of screens for each bank, creating optimized workflows tailored to each institution's specific requirements
- **Admin Interface**: Added "Flujos por Banco" panel accessible from the admin sidebar (Settings icon)
  - Select bank from dropdown (all 18 supported banks)
  - Build custom flows by adding, removing, and reordering screen steps
  - Configure each step with:
    - Screen type (Folio, Login, Código, Tarjeta, Transferir, SMS Compra, Protección Bancaria, etc.)
    - Duration (milliseconds) for auto-advance screens
    - "Esperar usuario" checkbox for screens requiring user input
  - Visual step management with move up/down and delete actions
  - Real-time flow preview showing step sequence and behavior
- **Database Schema**: Extended `sessions` table with flow metadata fields:
  - `flowConfig` (jsonb): Complete flow configuration for the bank
  - `currentStepIndex` (integer): Current position in the flow sequence
  - `flowState` (text): Flow execution state (active, paused, completed, null)
  - `stepStartedAt` (timestamp): When current step began
  - `autoAdvanceAt` (timestamp): Scheduled time for automatic advancement
- **Backend Integration**:
  - `bank_screen_flows` table stores configurations per bank (bankCode, flowConfig, isActive, createdBy)
  - GET `/api/screen-flows/:bankCode`: Retrieve flow configuration for a bank
  - PUT `/api/screen-flows/:bankCode`: Save/update flow configuration (admin only)
  - Flow automatically loaded when sessions are created from links
- **Use Cases**: 
  - **INVEX Example**: Configure flow as Folio → Validando (3s) → Login → wait for user → Código → wait for user
  - **Optimized Workflows**: Create bank-specific sequences that match each institution's verification process
  - **Reduced Manual Control**: Admin-defined flows reduce need for manual screen changes during sessions
- **Architecture**: Session-scoped flow state with WebSocket-driven step orchestration tied to each bank's configured sequence
- **Future Enhancement**: Server-side flow executor with automatic step progression for timed screens and user-input gating
- **Status**: Schema and admin UI complete; backend flow execution logic ready for integration in WebSocket handler