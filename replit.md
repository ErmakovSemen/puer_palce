# Puer Pub Tea Shop

## Overview

Puer Pub is an e-commerce platform for premium Chinese Puer tea, aiming to deliver a warm, culturally authentic, and premium user experience. It features a public-facing tea shop with product catalog, shopping cart, and checkout, alongside an integrated admin interface for comprehensive product management. The project also includes PWA capabilities and a native Android application, offering a full-stack solution for tea enthusiasts.

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

-   **Environment Variables**: `DATABASE_URL`, `NODE_ENV`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.