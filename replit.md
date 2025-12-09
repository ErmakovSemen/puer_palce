# Puer Pub Tea Shop

## Overview

Puer Pub is an e-commerce platform for premium Chinese Puer tea, offering a public-facing tea shop with a product catalog, shopping cart, and checkout. It includes an integrated admin interface for product and order management, PWA capabilities, and a native Android application. The project aims to provide a warm, culturally authentic, and premium user experience, focusing on high-quality Puer tea and teaware. Key capabilities include phone-based SMS authentication, comprehensive product and site settings management, a first-order discount system, and secure payment processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

Built with React 18 and TypeScript, using Vite, Wouter for routing, shadcn/ui (Radix UI) with Tailwind CSS and CVA for UI. State management uses TanStack Query and `useState`. Features a custom tea-inspired color palette, Google Fonts, and a mobile-first responsive design. Includes a dual theme system ("Classic" and "Minimalist").

### Backend

Powered by Express.js and TypeScript, providing a RESTful API. Drizzle ORM interacts with a PostgreSQL database (Neon serverless). Authentication uses Passport.js local strategy with session storage via `connect-pg-simple`. Admin routes are password-protected.

### Key Features

-   **User Authentication**: Optional email/password registration and login with guest checkout. Includes phone-based SMS verification for enhanced security and loyalty program access.
-   **Phone Normalization**: Centralized utility in `server/utils.ts` to normalize all phone numbers to `+7XXXXXXXXXX` format across authentication, storage, and payment integrations.
-   **Product Management**: Full CRUD operations for products, including multi-image upload with automatic WebP conversion and optimization, and support for fixed-quantity-only products. Products can be marked as out-of-stock with appropriate frontend display.
-   **Dual-Category Product System**: Products are categorized as "tea" (sold by gram) or "teaware" (sold by piece), with distinct display and quantity handling.
-   **Dynamic Tag Management**: Admins can create new tea types and effects, dynamically updating homepage filters.
-   **Site Settings Management**: Admin interface for managing contact information (email, phone, Telegram) and delivery details, displayed dynamically on the frontend.
-   **First Order Discount System**: 20% discount automatically applied to a registered user's first order, tracked in the database and validated server-side.
-   **Loyalty Program**: XP-based progression (1 RUB = 1 XP) for authenticated and phone-verified users, offering tiered discounts.
-   **Order Management**: Admin panel for viewing, filtering, and updating order statuses with pagination support (10 orders per page, load-more functionality).
-   **User Management**: Admin tools to search users by phone, view profiles, manage loyalty levels, and view order history.
-   **Payment Processing**: Integrated Tinkoff Acquiring API for secure online payments (54-ФЗ compliant), with custom implementation for token generation and amount handling (in kopecks). Supports proportional discount distribution. Includes SBP (Fast Payment System) integration via Tinkoff's hosted payment page.
-   **Delayed SMS Receipt Delivery**: Intelligent retry system for sending receipt URLs via SMS.ru. Performs immediate check when payment confirmed, then retries at +3, +7, +12 minutes to handle Tinkoff's asynchronous receipt generation (typically 2-10 minutes). Includes duplicate prevention via DB checks and comprehensive error logging with manual recovery instructions.
-   **Manual Order Synchronization**: Admin endpoint `POST /api/admin/orders/:id/sync` for manual order-payment reconciliation. Accepts optional `paymentId` and `receiptUrl` in request body, queries Tinkoff GetState API, updates order status and receipt URL, sends SMS with receipt to customer, and awards XP (idempotent). Admin panel displays red "Нет чека" badge for paid orders missing receipt URLs to facilitate quick problem identification.
-   **Chinese-Inspired Decorative Elements**: Uniform double-border badges, specific coloring for tea types/effects, and decorative dividers.
-   **Progressive Web App (PWA)**: Installable, offline-first experience with manifest, custom icons, and intelligent service worker caching.
-   **Native Mobile App (Capacitor)**: Android application built from the same codebase, utilizing Capacitor to wrap the web app, with automated APK build via GitHub Actions.
-   **Telegram Bot**: Customer-facing bot (@PuerPabbot) with commands `/start`, `/help`, `/contacts`, `/menu`, `/profile`, `/wallet`. Features inline keyboard navigation, contact info from site_settings, loyalty status display with visual progress bar for linked accounts. Phase 2: magic-link authentication for secure account binding from user profile page with deep link support and auto-refresh tokens. Phase 3: product catalog browsing by category (tea/teaware), detailed product views with pricing and effects, enhanced profile display. Phase 4: wallet functionality with balance display, SBP top-up via Tinkoff (preset amounts 500/1000/2000/5000₽), transaction history. Webhook endpoint at `/api/telegram/webhook`. Database tables: `telegram_profiles` (links Telegram chat_id to user accounts), `magic_links` (one-time authentication tokens), `wallet_transactions` (top-up and spending records with paymentId for duplicate prevention).
-   **User Wallet System**: Stored wallet balance (in kopecks) with top-up via Tinkoff SBP payments. Wallet payments use OrderId prefix "W_" for webhook detection. Duplicate payment protection via paymentId tracking. REST API: GET /api/wallet (balance + history), POST /api/wallet/topup (create payment).

## External Dependencies

### Third-Party Services

-   **Database**: Neon Serverless PostgreSQL
-   **Email Service**: Resend (for order notifications)
-   **Object Storage**: Replit Object Storage (for product images)
-   **SMS Verification**: SMS.ru
-   **Payment Gateway**: Tinkoff Acquiring API

### UI Component Libraries

-   Radix UI
-   Lucide React (icons)
-   Embla Carousel
-   cmdk

### Development & Utilities

-   React Hook Form
-   Zod
-   Vite
-   ESBuild
-   TSX
-   Sharp (for image processing)

### Configuration Management

-   **Environment Variables**: `DATABASE_URL`, `NODE_ENV`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SMSRU_API_KEY`, `SMSRU_TEMPLATE_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TINKOFF_TERMINAL_KEY`, `TINKOFF_SECRET_KEY`.