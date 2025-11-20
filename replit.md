# Puer Pub Tea Shop

## Overview

Puer Pub is an e-commerce platform for premium Chinese Puer tea, aiming to deliver a warm, culturally authentic, and premium user experience. It features a public-facing tea shop with product catalog, shopping cart, and checkout with phone-based SMS authentication, alongside an integrated admin interface for comprehensive product management. The project also includes PWA capabilities and a native Android application, offering a full-stack solution for tea enthusiasts.

## Recent Changes (December 2024)

### Out-of-Stock Product Management (January 2025)
- **Database Schema**: Added `outOfStock` boolean field to products table
- **Admin Interface**: Added checkbox in product form to mark products as out of stock
- **Frontend UX**: 
  - Products marked as out of stock display "Нет в наличии" badge in red
  - Cart addition buttons are hidden for out-of-stock items
  - Detail view shows disabled "Нет в наличии" button instead of "Добавить в корзину"
- **Visibility**: Out-of-stock products remain visible on the website for customer awareness

### WebP Image Optimization (January 2025)
- **Sharp Integration**: Installed and integrated Sharp library for image processing
- **Automatic Conversion**: Upload route now automatically converts all new product images to WebP format
- **Optimization Settings**: Images resized to max 1920px (maintaining aspect ratio) with 80% quality
- **Batch Conversion Script**: Created `server/scripts/convert-images-to-webp.ts` for converting existing images
- **URL Handling**: Script supports both relative (`/public/file.jpg`) and full URL formats
- **Performance**: WebP format significantly reduces image file sizes while maintaining visual quality

### Site Settings Management System
- **Database Schema**: Created `siteSettings` table with fields for contact email, phone, Telegram handle, and delivery information
- **Admin Interface**: Added "Настройки" tab in admin panel for editing site contact information and delivery details
- **Checkout Integration**: Checkout page now displays editable contact information (email, phone, Telegram) and delivery details from database
- **User Experience**: 
  - Authenticated users see link to order history in personal profile
  - All users see contact methods (email, phone, Telegram) with clickable links
  - Delivery information shows CDEK, Yandex, WB delivery options and 15-day timeline
- **API Endpoints**: GET /api/site-settings (public), PUT /api/site-settings (admin-only)

### First Order Discount System
- **20% Discount**: Registered users automatically receive 20% discount on their first order
- **Database Tracking**: Added `firstOrderDiscountUsed` field to users and orders tables
- **Discount Order**: First order discount applied before loyalty discount (base total → 20% off → loyalty % off)
- **Security**: Server-side validation prevents discount abuse, recalculates totals from authoritative product data
- **UI Indicators**: Large animated badge on profile button, prominent banner on profile page, separate line items in checkout
- **Cache Management**: User data refreshes after order creation to automatically update UI state

### Phone-Based Authentication with SMS Verification
- **SMS.ru Integration**: Implemented SMS verification system using SMS.ru API (cost-effective at 1-2₽ per SMS vs Twilio's $0.76)
- **Security**: SMS codes are hashed before storage, 5-minute expiry, 3 verification attempts max, rate limit 3 SMS per 10 minutes per phone
- **Authentication Flows**:
  - Registration: Phone → Password → Email (optional) → SMS verification → Account activation
  - Login: Phone + Password (normal flow)
  - Password Reset: Phone → SMS code → New password
- **Database Schema**: Added `phoneVerified` boolean to users table, created `smsVerifications` table with expiry and rate limiting
- **Backend Security**: Order totals are recalculated server-side using current product prices; loyalty discounts only applied if `user.phoneVerified === true`
- **Frontend UX**: Checkout warns unverified users that loyalty discounts require phone verification; Profile displays verification status with badges and icons

### Database Migrations
- **Legacy Users**: Executed one-time SQL migration to mark all 5 existing users (who registered before SMS verification) as `phoneVerified = true`. This ensures legacy users retain full loyalty program benefits without re-verification
- **Initial Settings**: Created initial site settings record with current contact information (SimonErmak@yandex.ru, +79667364077, @HotlineEugene)

### Tinkoff Acquiring Payment Integration (January 2025)
- **Payment Processing**: Integrated Tinkoff Acquiring API for secure online payments with 54-ФЗ compliance
- **Custom Implementation**: Built custom HTTP client using fetch - **NO SDK** used (official `@jfkz/tinkoff-payment-sdk` has hardcoded 100x multiplier causing ErrorCode 308)
- **Token Algorithm**: SHA-256 hash of sorted primitive fields (Amount, OrderId, Description, URLs, Password) - Receipt/DATA objects excluded from hash
- **Amount Units**: All monetary values in kopecks (Math.round(rubles * 100)) - API expects kopecks, not rubles
- **SMS Receipt Delivery**: Receipts sent to customers via SMS (no customer-facing email collection)
- **Phone Normalization**: Strict +7XXXXXXXXXX format validation (handles 8xxx, 7xxx, +7xxx inputs)
- **Discount Reconciliation**: Discounts distributed proportionally across all items by reducing Amount (Tinkoff API doesn't accept negative prices)
- **Type Safety**: ReceiptItem TypeScript interface enforces structure {Name, Price, Quantity, Amount, Tax, PaymentMethod, PaymentObject}
- **54-ФЗ Compliance**: All receipt items include Tax ("vat0" for 0% VAT), PaymentMethod ("full_payment"), and PaymentObject ("commodity") required by Russian tax law
- **Security**: Server-side recalculation of order totals prevents tampering
- **API Compliance**: Technical email (onboarding@resend.dev) used for API requirements while SMS delivers receipt to customer
- **Receipt Math**: Sum of Items.Amount must exactly equal Payment.Amount (proportional discount distribution)
- **Webhook Verification**: Token verification for incoming payment notifications (AUTHORIZED, CONFIRMED, REJECTED statuses)
- **XP Accrual**: Loyalty points awarded only on CONFIRMED status, not on AUTHORIZED or REJECTED

### SBP (Fast Payment System) Integration (January 2025)
- **Automatic Quick Pay Button**: SBP appears automatically as a Quick Pay button on Tinkoff's hosted payment page alongside card payment and T-Pay
- **No Frontend Selection**: Users are redirected to Tinkoff payment page where they can choose between card, T-Pay, or SBP (no selection needed in checkout form)
- **Standard Init API**: Payment initialization uses standard Tinkoff Init API without PayType parameter - all payment methods displayed based on terminal settings
- **Seamless Experience**: Single payment flow for all methods - Tinkoff handles method selection and processing on their secure page
- **Mobile Optimization**: SBP on mobile devices automatically opens banking app via deeplink; desktop shows QR code
- **Terminal Configuration**: SBP availability controlled in Tinkoff merchant account settings (no code changes needed)

### Bug Fixes
- Fixed registration flow to correctly handle optional email/name fields (empty strings not sent to backend)
- Added backend validation to prevent loyalty discount tampering through API manipulation
- Fixed cache invalidation: user data now refreshes after order creation
- Fixed Tinkoff payment receipt: changed from negative line item to proportional discount distribution (Tinkoff API requirement)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

Built with React 18 and TypeScript, using Vite, Wouter for routing, shadcn/ui (Radix UI) with Tailwind CSS and CVA for UI. State management uses TanStack Query and `useState`. Features a custom tea-inspired color palette, Google Fonts, and a mobile-first responsive design. Includes a dual theme system ("Classic" and "Minimalist").

### Backend

Powered by Express.js and TypeScript, providing a RESTful API. Drizzle ORM interacts with a PostgreSQL database (Neon serverless). Authentication uses Passport.js local strategy with session storage via `connect-pg-simple`. Admin routes are password-protected.

### Key Features

- **User Authentication (Optional)**: Email/password registration and login, with guest checkout available. Authenticated users get order history and auto-filled forms.
- **User Profiles & Order History**: Dedicated section for authenticated users to view account info and past orders.
- **Theme System**: Dual theme support (Classic/Minimalist) with dynamic switching.
- **Dynamic Tag Management**: Admins can create new tea types and effects, dynamically updating homepage filters.
- **Dual-Category Product System**: Products are categorized as "tea" (sold by gram) or "teaware" (sold by piece), with distinct display and quantity handling.
- **Product Management**: Full CRUD operations via admin panel, including multi-image upload to Replit Object Storage and support for fixed-quantity-only products.
- **Loyalty Program**: XP-based progression (1 RUB = 1 XP) for authenticated users, offering tiered discounts and benefits.
- **Admin Order Management**: View all orders, filter by status, view details, and update order status.
- **Admin User Management**: Search users by phone, view profiles, manage loyalty levels, and view order history.
- **Compact Filter System**: Space-efficient dropdown filters with multi-selection logic and clear/reset options.
- **Chinese-Inspired Decorative Elements**: Uniform double-border badges, specific coloring for tea types/effects, and decorative dividers.
- **Progressive Web App (PWA)**: Installable, offline-first experience with a manifest, custom icons, and a intelligent service worker caching strategy.
- **Native Mobile App (Capacitor)**: Android application built from the same codebase, utilizing Capacitor to wrap the web app. Includes an automated APK build process via GitHub Actions.

## External Dependencies

### Third-Party Services

-   **Database**: Neon Serverless PostgreSQL
-   **Email Service**: Resend (for order notifications)
-   **Object Storage**: Replit Object Storage (for product images)

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

### Configuration Management

-   **Environment Variables**: `DATABASE_URL`, `NODE_ENV`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SMSRU_API_KEY` (for SMS verification), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (for admin notifications), `TINKOFF_TERMINAL_KEY`, `TINKOFF_SECRET_KEY` (for Tinkoff Acquiring payment processing).