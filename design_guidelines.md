# Design Guidelines: Puer Pub Tea Shop

## Design Approach
**Reference-Based Approach** drawing inspiration from premium e-commerce experiences (Shopify, Etsy) combined with tea house cultural aesthetics. The design emphasizes warmth, authenticity, and the ritual of tea drinking while maintaining clear e-commerce functionality.

## Core Design Principles
- **Cultural Authenticity**: Incorporate subtle East Asian design elements that honor Puer tea's Chinese heritage
- **Warmth & Invitation**: Create a cozy, welcoming atmosphere that mirrors a physical tea house
- **Product Focus**: Let tea imagery and descriptions breathe with generous spacing
- **Clear Hierarchy**: Shopping flow should be intuitive and frictionless

## Color Palette

**Primary Colors:**
- Deep Tea Brown: 25 35% 25% - Main brand color, navigation, headers
- Warm Earth: 30 40% 60% - Backgrounds, cards, secondary elements
- Cream: 40 25% 95% - Page backgrounds, light mode base

**Accent Colors:**
- Jade Green: 150 30% 45% - CTAs, success states, add to cart buttons
- Amber: 35 60% 50% - Highlights, price tags, special offers

**Dark Mode:**
- Dark Tea: 25 15% 12% - Background
- Warm Gray: 30 8% 25% - Cards and surfaces
- Light Cream: 40 15% 88% - Text

## Typography

**Font Stack:**
- **Headings**: 'Playfair Display' (Google Fonts) - Elegant serif for brand presence
- **Body**: 'Inter' (Google Fonts) - Clean, readable sans-serif
- **Accent/Chinese elements**: 'Noto Serif SC' (Google Fonts) - For authenticity

**Scale:**
- Hero/H1: text-5xl md:text-6xl, font-bold
- Product Titles/H2: text-3xl md:text-4xl, font-semibold  
- Section Headers/H3: text-2xl md:text-3xl, font-semibold
- Body: text-base md:text-lg, leading-relaxed
- Small/Meta: text-sm

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Card gaps: gap-6 to gap-8

**Grid System:**
- Product catalog: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Container max-width: max-w-7xl
- Content max-width: max-w-4xl

## Component Library

**Navigation:**
- Sticky header with semi-transparent backdrop blur
- Logo left, main nav center, cart icon right
- Mobile: Hamburger menu with slide-in drawer

**Product Cards:**
- Vertical layout with generous image space (aspect-[3/4])
- Tea name in Playfair Display
- Price in Jade Green with currency symbol
- Subtle hover lift effect (hover:-translate-y-1)
- "Add to Cart" button in Jade with icon

**Shopping Cart:**
- Slide-out drawer from right
- Product thumbnails with quantity controls
- Sticky footer with total and checkout button
- Empty state with decorative tea illustration

**Admin Panel:**
- Clean dashboard with sidebar navigation
- Data tables with search and filters
- Form inputs with warm styling to match brand
- Image upload with preview functionality

**Forms:**
- Generous input padding (p-4)
- Warm border colors (border-warm-earth)
- Focus states with Jade accent
- Clear validation messaging

**Buttons:**
- Primary: Jade background with white text, rounded-lg
- Secondary: Outline with Deep Tea Brown border
- When on images: backdrop-blur-md bg-white/10 border-white/30

**Overlays:**
- Modal backgrounds: backdrop-blur-sm bg-black/40
- Product quick view with centered modal
- Order confirmation overlay

## Hero Section

**Large Hero Image:** YES
- Full-width hero showcasing premium Puer tea ceremony or tea leaves
- Height: min-h-[60vh] md:min-h-[75vh]
- Overlay gradient: from-black/50 to-transparent
- Centered headline in Playfair Display (white text)
- Subheading emphasizing quality and tradition
- Primary CTA: "Explore Tea Collection" (Jade button with blur backdrop)

## Images

**Product Photography:**
- High-quality tea leaf close-ups with warm, natural lighting
- Lifestyle shots: tea being prepared, cups, traditional settings
- Consistent background (cream or natural wood textures)

**Hero Section:**
- Main hero: Atmospheric shot of Puer tea brewing with steam rising
- Or: Artistic flat-lay of tea leaves, traditional teapot, cups

**Category/Feature Images:**
- Different Puer tea varieties in organic arrangements
- Traditional Chinese tea ceremony elements
- Warm, authentic color grading

**Where to Place:**
- Hero: Full-width immersive opening
- Product cards: Centered, contained images
- About section: 2-column layout with tea culture imagery
- Admin: Product management thumbnails

## Page-Specific Layouts

**Homepage:**
- Hero with CTA
- Featured products grid (3 columns)
- About Puer tea section (2-column: text + image)
- Customer testimonials (if available)
- Newsletter signup in warm card

**Catalog Page:**
- Filter sidebar (collapsible on mobile)
- Product grid with hover states
- Load more or pagination
- Breadcrumb navigation

**Product Detail:**
- Large image gallery (main + thumbnails)
- Product info sidebar with add to cart
- Brewing instructions accordion
- Related products carousel

**Checkout:**
- Multi-step form (Contact → Delivery → Confirm)
- Order summary sticky sidebar
- Trust indicators (secure checkout badge)

**Admin Panel:**
- Dashboard with sales overview
- Product management table with inline editing
- Add/Edit product forms with image upload
- Order management with status tracking

## Animation Guidelines

**Minimal & Purposeful:**
- Product card hover: subtle lift (transition-transform duration-200)
- Cart drawer: slide-in from right (animate-in)
- Page transitions: soft fade
- No unnecessary scroll animations

## Accessibility
- Dark mode toggle prominent in header
- Consistent focus indicators (ring-jade-green)
- All form inputs properly labeled
- Alt text for all product images
- High contrast maintained in both modes