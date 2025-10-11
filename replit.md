# Puer Pub Tea Shop

## Overview

Puer Pub is an e-commerce platform for premium Chinese Puer tea. The application is a full-stack web application featuring a public-facing tea shop with product catalog, shopping cart, and checkout functionality, plus an admin interface for product management. The design emphasizes cultural authenticity, warmth, and a premium user experience inspired by high-end e-commerce platforms.

## Recent Changes (October 2025)

### Filter Redesign
- Redesigned product filters to match compact catalog-style layout
- Quiz button ("Подобрать чай") now uses light emerald green background (bg-emerald-100) with Sparkles icon
- All filter tags styled as Badge components with hashtag symbols (# Все виды, # Шу Пуэр, etc.)
- Removed search functionality in favor of cleaner filter-only interface
- Two-row layout: primary filters (types + 3 effects) and collapsible secondary effects row
- Consistent hover/active elevation effects across all filter badges

### Image Upload System
- Multi-image upload support using Replit Object Storage
- ObjectStorageService handles presigned URLs and file management
- Admin form validation ensures products have at least one image before saving
- Image carousel with autoplay in product cards
- Gallery view with thumbnails in product detail modal

### Database Schema
- Product schema uses `pricePerGram` (real type) for per-gram pricing display
- Images stored as array of URLs in Object Storage bucket

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool and development server for fast HMR and optimized production builds
- Wouter for lightweight client-side routing

**UI Component System**
- shadcn/ui components built on Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for managing component variants
- Custom theme system supporting light/dark modes with CSS variables

**State Management**
- TanStack Query (React Query) for server state management and data fetching
- Local React state (useState) for UI state like cart management and filters
- Custom hooks for reusable stateful logic

**Design System**
- Custom color palette inspired by tea aesthetics (tea brown, warm earth, jade green, amber)
- Typography hierarchy using Google Fonts: Playfair Display (headings), Inter (body), Noto Serif SC (Chinese elements)
- Responsive grid system with mobile-first approach
- Consistent spacing primitives based on Tailwind's scale

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- TypeScript throughout for type safety across the stack
- Custom middleware for request logging and error handling

**API Design**
- RESTful API structure with `/api` prefix for all endpoints
- Currently uses in-memory storage (MemStorage) with interface designed for easy migration to database persistence
- Storage abstraction layer (IStorage interface) allows swapping implementations without changing route logic

**Database Strategy**
- Drizzle ORM configured for PostgreSQL (Neon serverless)
- Schema definitions use Drizzle's type-safe query builder
- Migrations folder structure prepared for schema evolution
- Current implementation uses memory storage but infrastructure ready for database integration

### Data Storage Solutions

**Current State**
- In-memory storage for development/prototyping
- User schema defined with Drizzle for future database migration
- Products currently managed in frontend mock data

**Database Infrastructure**
- Neon serverless PostgreSQL configured via DATABASE_URL environment variable
- Drizzle ORM with PostgreSQL dialect
- Schema located in `shared/schema.ts` for code sharing between client and server
- Migration system ready with `drizzle.config.ts`

**Planned Schema**
- Users table with authentication fields
- Products catalog with comprehensive tea metadata (type, effects, pricing, images)
- Orders and order items for e-commerce transactions
- Inventory management tables

### Authentication & Authorization

**Current State**
- Basic user schema defined (username, password)
- No active authentication implementation
- Admin routes unprotected

**Planned Approach**
- Session-based authentication with express-session
- connect-pg-simple for PostgreSQL session storage
- Password hashing (likely bcrypt or similar)
- Role-based access control for admin vs. customer routes

## External Dependencies

### Third-Party Services

**Database**
- Neon Serverless PostgreSQL (@neondatabase/serverless)
- WebSocket support via 'ws' package for real-time database connections

**UI Component Libraries**
- Radix UI suite (@radix-ui/*) for accessible primitive components
- Lucide React for iconography
- Embla Carousel for product galleries
- cmdk for command palette functionality

**Form Management**
- React Hook Form for form state management
- Zod for schema validation
- @hookform/resolvers for integration between the two

**Development Tools**
- Vite with custom Replit plugins for development experience
- ESBuild for server bundling in production
- TSX for TypeScript execution in development

**Fonts & Assets**
- Google Fonts API (Playfair Display, Inter, Noto Serif SC)
- Static assets served from attached_assets directory

### API Integrations

**Payment Processing**
- Not yet implemented (checkout form captures customer data only)
- Infrastructure ready for Stripe or similar payment gateway integration

**Image Storage**
- Currently using local static assets
- Product images stored in attached_assets/stock_images
- Future: Could integrate with cloud storage (S3, Cloudinary) for user-uploaded product images

### Configuration Management

**Environment Variables**
- DATABASE_URL for PostgreSQL connection string
- NODE_ENV for environment detection (development/production)
- Vite-specific variables for build configuration

**Build & Deployment**
- Development: `npm run dev` runs concurrent Vite dev server and Express backend
- Production: `npm run build` compiles both frontend and backend, `npm start` serves built application
- TypeScript checking via `npm run check`
- Database schema updates via `npm run db:push`