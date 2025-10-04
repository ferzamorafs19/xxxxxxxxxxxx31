# Aclaraciones Bancarias Platform

## Overview

This project is a comprehensive banking clarification platform featuring a dual-domain architecture for client and admin interfaces, built with Express.js and React. It offers real-time communication, robust banking session management, user authentication, SMS integration, file management, and Telegram notifications. The platform aims to streamline banking clarifications, enhance user experience, and provide administrators with powerful tools for managing sessions and users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform employs a multi-domain setup with `aclaracion.info` for clients and `panel.aclaracion.info` for administration, both served by a single Express.js backend. The frontend is built with React 18 and TypeScript, using Vite for building and Tailwind CSS with shadcn/ui for styling. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and WebSockets for real-time updates. Authentication is session-based with Passport.js, supporting role-based access, device limitations, and account expiration.

Key features include:
- **Database Schema**: Manages users (with roles, device limits, bank restrictions, account types), executives (for office accounts), banking sessions (with screen types, user inputs, file attachments), SMS configurations, and notification preferences.
- **Authentication**: Session-based with Passport.js, supporting anti-bot measures, behavioral analysis, and OTP verification for executives.
- **Unified Login**: All users (regular, admin, executive) login at `/balonx` with separate tabs (Login/Register/Executive)
- **Account Types**: 
  - **Individual**: 2 devices, 3000 MXN/week
  - **Office**: 8 executives max, 6000 MXN/week, executive management panel with OTP login
- **Executive System**:
  - Executives login via `/balonx` → Executive tab
  - OTP sent to office owner's Telegram for verification
  - Authenticated with office owner's permissions and allowed banks
  - Access user panel (`/panel`) with inherited settings
  - Limited to **1 active session** (vs 2 for regular users)
  - Session uses office owner's user ID for proper Passport deserialization
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
- **WhatsApp Integration**: `@whiskeysockets/baileys` for WhatsApp Web connection with QR authentication, automated menu responses, and message handling.
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

## WhatsApp Bot Integration

### Overview
The platform includes a WhatsApp bot that uses Baileys library for direct WhatsApp Web connection. The bot provides automated customer service with configurable menu options and message responses.

### Architecture
- **Library**: `@whiskeysockets/baileys` for WhatsApp Web protocol
- **Authentication**: QR code scanning for WhatsApp Web connection
- **Session Storage**: Multi-file auth state stored in `whatsapp_sessions/` directory per user
- **Database**: Three tables manage configuration, menu options, and conversation history

### Phone Number Format (Mexico)
The bot automatically formats Mexican phone numbers:
- **Input**: 10-digit number (e.g., `5531781885`)
- **Auto-format**: Adds country code 52 → `525531781885@s.whatsapp.net`
- **Supported formats**: 
  - Raw 10 digits: `5531781885` → `525531781885@s.whatsapp.net`
  - With country code: `525531781885` → `525531781885@s.whatsapp.net`
  - International: `+525531781885` → `525531781885@s.whatsapp.net`

### Features
1. **QR Authentication**: Admin scans QR code from WhatsApp panel to connect
2. **Configurable Welcome Message**: Customizable greeting sent to new contacts
3. **Menu System**: Up to 9 numbered options with customizable responses
4. **Action Types**:
   - `message`: Send automated response
   - `transfer`: Notify executive for human intervention
   - `info`: Provide information and re-display menu
5. **Conversation History**: All messages stored in database with timestamps
6. **Auto-reconnect**: Automatically reconnects if connection drops

### Admin Panel Access
Located at `/admin` → WhatsApp Bot tab:
- **Connection Status**: Real-time display of WhatsApp connection state
- **QR Code Display**: Shows QR when bot is starting (auto-refresh every 3 seconds)
- **Configuration**: Set welcome message and bot phone number
- **Menu Management**: Create/edit/delete menu options with live preview
- **Test Messaging**: Send test messages to verify bot functionality

### Message Flow
1. **User sends message** → Bot receives via Baileys event listener
2. **First contact** → Bot sends welcome message + menu
3. **User selects option (1-9)** → Bot processes and responds based on action type
4. **5-minute timeout** → If no interaction, re-send menu on next message
5. **All messages logged** → Stored in `whatsapp_conversations` table