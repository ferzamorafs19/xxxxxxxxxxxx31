# Aclaraciones Bancarias Platform

## Overview

This is a comprehensive banking clarification platform built with Express.js backend and React frontend. The application provides a dual-domain architecture for client and admin interfaces, with real-time communication through WebSockets. The system handles banking session management, user authentication, SMS integration, file management, and Telegram notifications.

## System Architecture

### Multi-Domain Setup
- **Client Domain**: `aclaracion.info` - Public-facing interface for banking clarifications
- **Admin Domain**: `panel.aclaracion.info` - Administrative interface for session management
- **Shared Backend**: Single Express.js server handling both domains with CORS configuration

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite build system
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket for live session updates
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Passport.js with local strategy and bcrypt

## Key Components

### Database Schema (Drizzle)
- **Users Table**: Role-based access (admin/user), device counting, bank restrictions, expiration dates
- **Sessions Table**: Banking session data with screen types, user inputs, file attachments
- **SMS Integration**: Configuration and history tracking
- **Notification System**: Multi-channel notifications with preferences

### Authentication System
- Session-based authentication with memory store
- Role-based access control (admin/user)
- Device limitation per user
- Account expiration management
- Anti-bot detection with behavioral analysis

### Screen Management
Multiple screen types for different banking workflows:
- Validation screens
- OTP entry
- Card information
- Transfer details
- Protection banking with file downloads

### File Management
- Multer-based file upload system
- Protection file management for banking sessions
- Static file serving from uploads directory
- File download tracking and Telegram notifications

## Data Flow

### Session Creation
1. Admin creates new session through admin panel
2. Session ID generated and QR code created
3. Client accesses session via sessionId URL parameter
4. WebSocket connection established for real-time updates

### Real-time Communication
1. Admin changes screen type in admin panel
2. WebSocket broadcasts change to connected clients
3. Client interface updates automatically
4. User inputs sent back to admin in real-time

### Banking Workflow
1. Client selects bank from available options
2. Session progresses through validation screens
3. User enters required information (OTP, card details, etc.)
4. Admin monitors and controls session flow
5. Files can be uploaded for protection banking
6. Telegram notifications sent for important events

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Database ORM and migrations
- **passport**: Authentication middleware
- **bcrypt**: Password hashing
- **multer**: File upload handling
- **ws**: WebSocket implementation

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui**: Accessible UI components
- **wouter**: Lightweight routing
- **tailwindcss**: Utility-first CSS framework

### Security Features
- **Anti-detection system**: Bot detection and browser fingerprint obfuscation
- **Rate limiting**: Dynamic rate limiting middleware
- **Header obfuscation**: Server fingerprint masking
- **Input validation**: Comprehensive data validation

### Telegram Integration
- **node-telegram-bot-api**: Telegram bot for notifications
- Automated alerts for session creation, screen changes, and file downloads
- Device information reporting
- **Security**: Bot token and admin chat ID protected in Replit Secrets

### Bitso Payment Integration
- **Automated payment verification**: Checks Bitso API every 5 minutes
- **Secure credentials**: API keys and receiving account stored in Replit Secrets
- **Auto-activation**: Users activated for 7 days upon payment confirmation
- **Smart notifications**: Payment confirmations and renewal reminders via Telegram

## Deployment Strategy

### Replit Configuration
- **Runtime**: Node.js 20 with PostgreSQL 16
- **Build Process**: Vite frontend build + esbuild backend bundle
- **Production Command**: Single Express server serving both client and admin interfaces
- **Port Configuration**: Single port (5000) with domain-based routing

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `CLIENT_DOMAIN`: Client interface domain
- `ADMIN_DOMAIN`: Admin interface domain

### Database Management
- Drizzle migrations for schema updates
- Automatic cleanup of expired sessions and users
- Connection pooling with Neon serverless

## Changelog

```
Changelog:
- June 23, 2025. Initial setup
- July 3, 2025. Implemented SMS functionality with Soft Mex API
- July 3, 2025. Added credits-based SMS system for users
- July 3, 2025. Fixed user visibility in credit management
- July 3, 2025. Updated SMS routes to allow normal users
- July 3, 2025. Implemented Telegram bot for 2FA and admin messaging
- July 3, 2025. Added Chat ID field to user registration
- July 3, 2025. Created verification codes system with 10-minute expiration
- July 3, 2025. Configured 2FA notifications for both user and admin balonx
- July 3, 2025. Added admin Chat ID configuration in Telegram Bot Management panel
- July 3, 2025. Implemented mandatory 2FA authentication for ALL users including administrators
- July 3, 2025. Created TwoFactorVerification page and integrated 2FA flow in login process
- July 3, 2025. Added account activation notifications sent via Telegram when users are approved
- July 3, 2025. Modified Telegram bot /start command to provide Chat ID and registration instructions
- July 3, 2025. Updated registration form to require Chat ID field with instructions
- July 3, 2025. Fixed Chat ID storage issue in database using snake_case field mapping
- July 3, 2025. Completed full registration flow with Chat ID collection and 2FA integration
- July 3, 2025. Implemented automatic code submission when 6-digit 2FA code is entered
- July 3, 2025. Added automated renewal confirmation messages when panels are extended
- July 3, 2025. Created daily reminder system for subscriptions expiring in 24 hours
- July 3, 2025. Implemented expiration notification system for users whose panels have expired
- July 3, 2025. Configured automatic scheduling for renewal reminders (10:00 AM daily)
- July 3, 2025. Added hourly verification system for recently expired panels with notifications
- July 3, 2025. Implemented automatic redirection to /panel for users after successful 2FA (not homepage)
- July 3, 2025. Created UserPanel page with SMS functionality and account status for regular users
- July 3, 2025. Enhanced Telegram bot /start command with automatic Chat ID association
- July 3, 2025. Added smart Chat ID detection - automatically associates Chat ID when only one user needs configuration
- July 3, 2025. Implemented automatic bank access approval notifications via Telegram
- July 3, 2025. Created custom notification messages for account activation with bank permissions and duration
- July 3, 2025. Integrated notification system with user activation workflow (1-day and 7-day approvals)
- July 3, 2025. Implemented mandatory administrator approval system - users cannot login until admin activates account
- July 3, 2025. Updated registration flow with @BalonxSistema contact message and automatic login tab redirection
- July 3, 2025. Enhanced authentication error messages to guide users toward admin approval process
- July 3, 2025. Fixed Chat ID storage issue in user registration - now properly saves telegramChatId field
- July 3, 2025. Completed end-to-end 2FA flow: registration → admin approval → automatic 2FA on login
- July 3, 2025. Verified full workflow: Chat ID configured during registration, 2FA sent automatically on login attempt
- July 4, 2025. Updated session link generation to use digitalaclaraciones.com domain
- July 23, 2025. Changed client domain to digitalaclaraciones.onl
- July 28, 2025. Updated client domain to aclaracionesditales.com for session links
- July 4, 2025. Enhanced Telegram bot /start message with registration instructions for panelbalonx.vip/balonx
- July 8, 2025. Updated all domain references to digitalaclaraciones.com for both client and admin interfaces
- July 10, 2025. Implemented automatic session cleanup: sessions without user data are automatically deleted after 10 minutes
- July 10, 2025. Enhanced cleanup system with dual time intervals: 10 minutes for sessions without data, 30 minutes for inactive sessions with data
- July 10, 2025. Reduced cleanup interval to every 2 minutes for faster removal of empty sessions
- August 7, 2025. Implemented concurrent session control: users limited to 2 active sessions maximum
- August 7, 2025. Added automatic session management: oldest sessions are closed when limit is exceeded
- August 7, 2025. Created session tracking system with user agent information and timestamps
- August 7, 2025. Added periodic cleanup of invalid sessions (every 5 minutes)
- August 7, 2025. Implemented admin API endpoint (/api/sessions/active) for monitoring active sessions
- September 24, 2025. Integrated eims premium SMS API as third routing option
- September 24, 2025. Added PREMIUM route type to SMS system supporting 1.5 credits per message
- September 24, 2025. Implemented secure credential management for eims API using Replit Secrets
- October 1, 2025. Reduced INBURSA logo size by 60% (from 1.25rem to 0.75rem) in client interface
- October 1, 2025. Updated Telegram bot registration URL to "Balonx.pro/balonx" in all bot messages
- October 1, 2025. Implemented automated payment verification system with Bitso API
- October 1, 2025. Created system configuration for subscription pricing (7-day access)
- October 1, 2025. Added manual subscription price configuration in admin panel
- October 1, 2025. Integrated Bitso API for automatic payment verification (checks every 5 minutes)
- October 1, 2025. Bot automatically activates users for 7 days upon payment confirmation
- October 1, 2025. Implemented AI-powered payment responses in Telegram bot (no account info shared)
- October 1, 2025. Added payment confirmation notifications via Telegram when deposits verified
- October 1, 2025. Enhanced bot with contextual payment information and renewal guidance
- October 1, 2025. Configured Bitso payment receiving account securely in Replit Secrets
- October 1, 2025. SECURITY: Migrated all hardcoded credentials to Replit Secrets for enhanced security
- October 1, 2025. Protected TELEGRAM_TOKEN and ADMIN_CHAT_ID in environment variables
- October 1, 2025. Implemented strict validation for all API credentials with fail-fast error handling
- October 1, 2025. Sanitized logs to prevent exposure of sensitive account information
- October 1, 2025. Updated telegramBot.ts and telegramService.ts to use environment variables
- October 1, 2025. Removed all hardcoded credentials from UI components and test routes
- September 24, 2025. Updated SMS route selection UI to include eims premium option with reliability indicators
- September 24, 2025. Enhanced SMS cost calculation and credit tracking for three-tier routing system
- October 1, 2025. Implemented per-user custom pricing system for flexible subscription costs
- October 1, 2025. Added customPrice field to users table with automatic fallback to system price
- October 1, 2025. Created UI in admin panel to configure custom prices per user (RegisteredUsersManagement)
- October 1, 2025. Added Zod validation for custom prices (positive numbers, normalized to 2 decimals)
- October 1, 2025. Created PATCH /api/users/:userId/custom-price with strict validation and normalization
- October 1, 2025. Created POST /api/payments/create-pending with price prioritization logic (custom > system)
- October 1, 2025. Implemented automatic price normalization (toFixed(2)) for both custom and system prices
- October 1, 2025. Added isFinite() validation to prevent NaN values in payment creation
- October 1, 2025. Enhanced error messages to guide admins when prices are invalid or missing
- October 1, 2025. Implemented manual payment verification workflow via Telegram bot /pago command
- October 1, 2025. Created conversation state management system for payment flow (screenshot → amount)
- October 1, 2025. Added /pago, /cancelar commands with bot menu buttons for easy access
- October 1, 2025. Bot identifies users by Telegram chat ID and determines expected payment (custom or system price)
- October 1, 2025. Payment verification sends screenshot + amount + user data to admin for manual approval
- October 1, 2025. Enhanced bot help messages to include payment verification commands and workflow
- October 1, 2025. Integrated OpenAI GPT-4o Vision for automatic payment screenshot verification
- October 1, 2025. AI extracts amount and time from payment screenshots with confidence scoring
- October 1, 2025. Automatic user activation when AI verifies payment (>70% confidence threshold)
- October 1, 2025. Fallback to manual admin verification when AI confidence is low
- October 1, 2025. Real-time payment confirmation messages with extracted payment details
- October 1, 2025. Bot instructions updated to use "app bancaria" instead of specific platform names
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```