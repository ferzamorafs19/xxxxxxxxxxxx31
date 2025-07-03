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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```