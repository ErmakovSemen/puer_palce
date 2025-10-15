# Puer Pub Tea Shop

## Overview

Puer Pub is an e-commerce platform for premium Chinese Puer tea. It's a full-stack web application featuring a public-facing tea shop with a product catalog, shopping cart, and checkout functionality. An integrated admin interface allows for comprehensive product management. The project aims to deliver a warm, culturally authentic, and premium user experience, drawing inspiration from high-end e-commerce design principles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with **React 18 and TypeScript**, utilizing **Vite** for fast development and optimized builds. **Wouter** handles client-side routing. UI components are developed using **shadcn/ui** (based on Radix UI) styled with **Tailwind CSS**, and **Class Variance Authority (CVA)** for component variants. A custom theme system supports dual themes ("Classic" and "Minimalist") with dynamic switching and persistence. State management leverages **TanStack Query** for server state and `useState` for local UI state. The design system features a custom tea-inspired color palette, Google Fonts (Playfair Display, Inter, Noto Serif SC), and a mobile-first responsive grid.

### Backend Architecture

The backend is powered by **Express.js and TypeScript**, providing a **RESTful API** (`/api` prefix). It uses **Drizzle ORM** for interaction with a **PostgreSQL database (Neon serverless)**. A storage abstraction layer (`IStorage` interface) is in place, currently using Drizzle with initial product seeding on first startup. Admin routes are password-protected, requiring `X-Admin-Password` header.

**Authentication System**: Email/password authentication using **Passport.js** local strategy with session storage in PostgreSQL via **connect-pg-simple**. Sessions are persisted across server restarts. User passwords are hashed using bcrypt and sanitized from all API responses for security.

### Key Features & Implementations

- **User Authentication (Optional)**: Email/password registration and login system for customer accounts. Authentication is completely optional - guest checkout remains available for quick purchases. Authenticated users benefit from auto-filled checkout forms and order history tracking. Passwords are hashed with bcrypt and never exposed in API responses.
- **User Profiles & Order History**: Personal cabinet (`/profile`) for authenticated users displaying account information and complete order history with detailed order information.
- **Guest Checkout Conversion**: After successful guest orders, users see a registration prompt with hyperlink encouraging account creation for loyalty program benefits.
- **Theme System**: Dual theme support (Classic and Minimalist) with an admin toggle, dynamically applied via CSS classes. The Minimalist theme is the default.
- **Dynamic Tag Management**: Admins can create new tea types and effects directly from the product form. Homepage filters automatically update with new tags, fetching data dynamically via `GET /api/tags`.
- **Product Management**: Full CRUD operations for products via the admin panel, stored in PostgreSQL. Includes multi-image upload using Replit Object Storage, with images stored as URLs. Supports fixed-quantity-only mode where products can be sold exclusively in specific amounts (e.g., 357g tea cakes).
- **Order Processing**: Cart items (1 unit = 100g) are converted to grams on order submission. Backend validates order data using Zod.
- **Mobile Responsiveness**: Optimized product cards and filters for mobile devices, ensuring a compact and touch-friendly experience.
- **Admin Panel**: Password-protected at `/admin` with full product CRUD, quiz configuration, and image upload.
- **Database Seeding**: Automatic seeding of 5 initial products on first startup if the database is empty.
- **Compact Filter System**: Space-efficient dropdown filters in a single row alongside search and quiz buttons
  - Multiple selection with OR logic for tea types (can select multiple types, products matching any selected type are shown)
  - Multiple selection with OR logic for effects (products with any selected effect are shown)
  - Only one filter dropdown open at a time for cleaner UX
  - Selected items display in collapsed state with ellipsis truncation (shows up to 2 items, then "...")
  - "Очистить" (Clear) button appears when selections are active
- **Sharp Geometric Design**: Minimal border-radius (0.25rem for general elements, 0 for badges) for a modern, angular aesthetic.
- **Chinese-Inspired Decorative Elements**:
  - All badges: Uniform double border (3px double black) for consistent minimalist aesthetic
  - Tea type badges: Colored backgrounds with white text
  - Effect badges: White background with black text
  - Decorative divider line between filters and products with square corner elements
  - Complete black & white color scheme (primary color changed from green to black)
- **Progressive Web App (PWA)**: Installable mobile app experience with offline support
  - **Manifest**: Configured with Russian localization, black theme color, standalone display mode
  - **Icons**: Custom app icons (192x192, 512x512) for Android and iOS home screen
  - **Service Worker**: Intelligent caching strategy
    - Network-first for navigation/HTML requests - always fetches latest when online, caches for offline use
    - Cache-first for static assets (images, icons, fonts)
    - Network-first with cache fallback for API calls
    - Automatic HTML updates - users receive fresh content without manual cache clearing
  - **iOS Support**: Apple-specific meta tags for optimal PWA experience on iOS devices
  - **Offline Mode**: Graceful degradation when network is unavailable (requires at least one prior online visit)
  - **Installation**: Browser prompts users to "Add to Home Screen" on mobile devices
  - **Dual Usage**: PWA installation is optional - website remains fully functional in browser
- **Native Mobile App (Capacitor)**: Android application built from the same codebase
  - **Technology**: Capacitor 7.x wraps the web application in native Android container
  - **Package ID**: `com.puerpub.app`
  - **App Name**: "Пуэр Паб"
  - **Shared Codebase**: 100% code reuse - same React app runs in web, PWA, and native Android
  - **Build Process**: 
    - `npm run build` - builds web assets to `dist/public`
    - `npx cap sync` - copies assets to Android project
    - Android project located in `android/` directory (excluded from git)
  - **Distribution**: Ready for Google Play Store submission
  - **Future iOS**: iOS support possible with macOS development environment

### Order Processing Flow

1.  **Cart System**: Items are stored with quantity in grams, and price is stored as pricePerGram. Each product has configurable available quantities (e.g., 25g, 50g, 100g, 357g) with custom input option.
2.  **Fixed Quantity Mode**: Products can be marked as fixed-quantity-only (e.g., tea cakes sold only in 357g portions). When enabled, admins must specify the fixed quantity, and customers cannot select different amounts. Zod validation enforces that fixedQuantity must be a positive integer when fixedQuantityOnly is true.
3.  **Minimum Order**: Orders require a minimum total of 500 RUB. Validation occurs on checkout attempt.
4.  **Order Submission**: Frontend sends cart data with items already in grams to `POST /api/orders`.
5.  **Backend Validation**: Zod schema validates order and customer details.
6.  **Database Storage**: Orders are saved to PostgreSQL with nullable userId field - links to users.id when user is authenticated, null for guest orders.
7.  **XP Award**: Authenticated users receive XP equal to their order total (1 RUB = 1 XP). This happens automatically after order creation before email notification.
8.  **Email Notification**: Resend service sends formatted email to `semen.learning@gmail.com` with order details.
9.  **Success Response**: Authenticated users see standard confirmation, guests see registration prompt with loyalty program messaging.
10.  **Error Handling**: Specific HTTP status codes (400, 502, 500) for validation, email service, or internal errors.

### Loyalty Program

**XP-Based Progression System**: 1 RUB spent = 1 XP earned. XP accumulates automatically for authenticated users with each purchase.

**Tier Structure**:
- **Level 1: Новичок** (0-2,999 XP)
  - Discount: 0%
  - Benefits: Access to base catalog
  
- **Level 2: Ценитель** (3,000-6,999 XP)
  - Discount: 5%
  - Benefits: 5% discount on all purchases
  
- **Level 3: Чайный мастер** (7,000-14,999 XP)
  - Discount: 10%
  - Benefits: 10% discount, personal chat support, private tea events access, custom tea requests
  
- **Level 4: Чайный Гуру** (15,000+ XP)
  - Discount: 15%
  - Benefits: 15% discount, all Level 3 benefits, priority service, exclusive offers

**Technical Implementation**:
- **Database**: User XP stored in `users.xp` (integer, default 0)
- **XP Calculation**: Automatic award via `storage.addUserXP()` after order creation
- **Discount Application**: Calculated via `getLoyaltyDiscount(xp)` utility, applied at checkout
- **UI Components**:
  - `LoyaltyProgressBar`: Shows current level, XP, and progress to next level in profile
  - `LoyaltyLevelsModal`: Displays all tier information when progress bar is clicked
  - Checkout form displays discount amount and final total for authenticated users
- **Shared Utilities** (`shared/loyalty.ts`):
  - `getLoyaltyLevel(xp)`: Returns current loyalty tier
  - `getLoyaltyDiscount(xp)`: Returns discount percentage
  - `getLoyaltyProgress(xp)`: Returns progress data for UI

## External Dependencies

### Third-Party Services

-   **Database**: Neon Serverless PostgreSQL (`@neondatabase/serverless`).
-   **Email Service**: Resend (for order notifications), configured via `RESEND_API_KEY` environment variable.
-   **Object Storage**: Replit Object Storage (for product images).

### UI Component Libraries

-   Radix UI (`@radix-ui/*`)
-   Lucide React (iconography)
-   Embla Carousel (product galleries)
-   cmdk (command palette)

### Development & Utilities

-   React Hook Form (form management)
-   Zod (schema validation)
-   Vite (build tool)
-   ESBuild (server bundling)
-   TSX (TypeScript execution)

### API Integrations

-   **Image Storage**: Replit Object Storage for product images.

### Configuration Management

-   **Environment Variables**: `DATABASE_URL`, `NODE_ENV`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.