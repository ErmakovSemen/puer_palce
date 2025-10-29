# Puer Pub Tea Shop

## Overview
Puer Pub is an e-commerce platform specializing in premium Chinese Puer tea. It's a full-stack web application featuring a public-facing tea shop with product catalog, shopping cart, and checkout, alongside an integrated admin interface for product management. The project aims to provide a warm, culturally authentic, and premium user experience, inspired by high-end e-commerce design.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application is a full-stack web application with a RESTful API.

**Frontend:**
Built with React 18 and TypeScript, using Vite for development and optimized builds. Wouter handles client-side routing. UI components are developed with shadcn/ui (Radix UI based) and styled using Tailwind CSS and Class Variance Authority (CVA). State management uses TanStack Query for server state and `useState` for local UI state. The design system includes a custom tea-inspired color palette, Google Fonts, and a mobile-first responsive grid. A custom theme system supports "Classic" and "Minimalist" themes with dynamic switching. The application also supports Progressive Web App (PWA) functionality and can be built as a native Android application using Capacitor.

**Backend:**
Powered by Express.js and TypeScript, providing a RESTful API. Drizzle ORM interacts with a PostgreSQL database (Neon serverless). Admin routes are password-protected. Authentication uses Passport.js with a local strategy and session storage in PostgreSQL. User passwords are bcrypt-hashed and sanitized from API responses.

**Key Features:**
*   **User Authentication:** Optional email/password registration and login with email verification and password reset functionality. Guest checkout is fully supported.
*   **Loyalty Program:** XP-based progression system (1 RUB = 1 XP) with tiered discounts and benefits for authenticated users.
*   **Product Management:** Full CRUD operations for products via the admin panel, including multi-image upload. Supports dual-category products (tea and teaware) with distinct pricing and quantity handling. Products can be set to fixed-quantity-only.
*   **Order Processing:** Cart items are converted to grams on submission. Orders require a minimum total of 500 RUB and are validated using Zod. Authenticated users receive XP based on order total.
*   **Dynamic Tag Management:** Admins can create new tea types and effects, which automatically update homepage filters. Tea type badges are automatically colored based on intelligent pattern matching.
*   **Compact Filter System:** Space-efficient dropdown filters with multiple selection (OR logic) for tea types and effects, search, and quiz buttons.
*   **Design System:** Clean, modern aesthetic with rounded corners, a black & white color scheme, and Chinese-inspired decorative elements (e.g., double-bordered badges).
*   **Mobile Responsiveness:** Optimized for mobile devices.
*   **PWA & Native Mobile App:** Installable PWA with intelligent caching and offline support. A native Android application can be built from the same codebase using Capacitor.

## External Dependencies

*   **Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless`).
*   **Email Service:** Resend (for order notifications).
*   **Object Storage:** Replit Object Storage (for product images).
*   **UI Component Libraries:** Radix UI (`@radix-ui/*`), Lucide React (icons), Embla Carousel, cmdk.
*   **Development & Utilities:** React Hook Form, Zod, Vite, ESBuild, TSX.