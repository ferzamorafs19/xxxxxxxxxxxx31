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