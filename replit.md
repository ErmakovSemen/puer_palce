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

### Key Features & Implementations

- **Theme System**: Dual theme support (Classic and Minimalist) with an admin toggle, dynamically applied via CSS classes. The Minimalist theme is the default.
- **Dynamic Tag Management**: Admins can create new tea types and effects directly from the product form. Homepage filters automatically update with new tags, fetching data dynamically via `GET /api/tags`.
- **Product Management**: Full CRUD operations for products via the admin panel, stored in PostgreSQL. Includes multi-image upload using Replit Object Storage, with images stored as URLs.
- **Order Processing**: Cart items (1 unit = 100g) are converted to grams on order submission. Backend validates order data using Zod.
- **Mobile Responsiveness**: Optimized product cards and filters for mobile devices, ensuring a compact and touch-friendly experience.
- **Admin Panel**: Password-protected at `/admin` with full product CRUD, quiz configuration, and image upload.
- **Database Seeding**: Automatic seeding of 5 initial products on first startup if the database is empty.
- **Filter Redesign**: Dynamic, collapsible filters for tea types and effects, styled as `Badge` components.
- **Sharp Geometric Design**: Minimal border-radius (0.25rem for general elements, 0 for badges) for a modern, angular aesthetic.

### Order Processing Flow

1.  **Cart System**: Items are stored in 100g units.
2.  **Order Submission**: Frontend converts units to grams and sends data to `POST /api/orders`.
3.  **Backend Validation**: Zod schema validates order and customer details.
4.  **Email Notification**: Resend service sends formatted email to `semen.learning@gmail.com` with order details.
5.  **Error Handling**: Specific HTTP status codes (400, 502, 500) for validation, email service, or internal errors.

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