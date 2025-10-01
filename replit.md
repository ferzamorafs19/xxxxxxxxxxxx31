# Aclaraciones Bancarias Platform

## Overview

This project is a comprehensive banking clarification platform featuring a dual-domain architecture for client and admin interfaces, built with Express.js and React. It offers real-time communication, robust banking session management, user authentication, SMS integration, file management, and Telegram notifications. The platform aims to streamline banking clarifications, enhance user experience, and provide administrators with powerful tools for managing sessions and users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform employs a multi-domain setup with `aclaracion.info` for clients and `panel.aclaracion.info` for administration, both served by a single Express.js backend. The frontend is built with React 18 and TypeScript, using Vite for building and Tailwind CSS with shadcn/ui for styling. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and WebSockets for real-time updates. Authentication is session-based with Passport.js, supporting role-based access, device limitations, and account expiration.

Key features include:
- **Database Schema**: Manages users (with roles, device limits, bank restrictions), banking sessions (with screen types, user inputs, file attachments), SMS configurations, and notification preferences.
- **Authentication**: Session-based with anti-bot measures and behavioral analysis.
- **Screen Management**: Dynamic screen types guide users through banking workflows (validation, OTP, card info, transfers, protection banking).
- **File Management**: Multer-based uploads for protection banking and static file serving, with Telegram notifications for downloads.
- **Data Flow**: Admin-initiated sessions with QR codes, real-time client-admin updates via WebSockets, and a guided banking workflow.
- **Security**: Anti-detection, rate limiting, header obfuscation, and comprehensive input validation.

## External Dependencies

- **Database**: `@neondatabase/serverless` (PostgreSQL), `drizzle-orm`
- **Authentication**: `passport`, `bcrypt`
- **File Uploads**: `multer`
- **Real-time Communication**: `ws`
- **Frontend Libraries**: `@tanstack/react-query`, `@radix-ui`, `wouter`, `tailwindcss`
- **SMS Integration**: Soft Mex API, eims premium SMS API
- **Telegram Integration**: `node-telegram-bot-api` for notifications, 2FA, and payment verification.
- **Payment Gateway**: Bitso API for automated payment verification.
- **AI Integration**: OpenAI GPT-4o Vision for payment screenshot analysis.
- **Environment Management**: Replit Secrets for secure credential storage.

## Payment Verification Flow (FIXED)

### Telegram Payment Process
1. **User initiates payment** via `/pago` command or during registration
2. **Bot sends payment instructions** with Bitso account details and expected amount
3. **User uploads screenshot** → Bot saves file_id and prompts: "Ingresa tu cantidad depositada"
4. **User enters amount** → Bot creates pending payment with:
   - Reference code (8 chars)
   - Screenshot file_id
   - User-reported amount
   - Expected amount (from system config or custom price)
   - Status: `pending`
   - Verification attempts: 0

### Automatic Verification (Every 2 minutes)
The system runs dual verification using both APIs:

**Bitso API Verification:**
- Checks deposits to configured receiving account
- Matches amounts within ±1% tolerance
- Returns transaction details if found

**AI Vision Verification (GPT-4o):**
- Downloads screenshot from Telegram
- Analyzes image for payment details
- Extracts amount and timestamp
- Returns confidence score (0-1)

**Auto-Activation Logic:**
- ✅ If BOTH Bitso confirms AND AI confidence >70% → Auto-activate user for 7 days
- ⏳ If either fails → Increment verification attempts
- ⚠️ After 7 attempts (15 minutes) → Status changes to `MANUAL_REVIEW` + Admin notification

### Discount Code System
- Admins create codes via `/descuento` command
- Base price: 3000 MXN (configurable in system_config)
- Final price = max(0, base_price - discount_amount)
- Codes are single-use, atomic claim during registration
- Custom price saved to user.customPrice for future reference