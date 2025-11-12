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
- **Solution**: Changed link generation to use the configured base domain (folioaclaraciones.com) instead of per-bank subdomains
- **Implementation**: 
  - Modified `linkToken.ts` to fetch base URL from `site_config` table
  - All links now use format: `https://folioaclaraciones.com/client/{token}`
  - Bitly shortens these valid URLs successfully
- **Impact**: Links now work correctly and are accessible to users
- **Note**: The `bank_subdomains` table remains for potential future use but is no longer used in link generation