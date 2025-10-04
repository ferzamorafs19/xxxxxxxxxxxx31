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
-   **Environment Management**: Replit Secrets