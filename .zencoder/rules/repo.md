---
description: Repository Information Overview
alwaysApply: true
---

# Hi-There-Buddy Web Application

## Summary

A full-stack investment and transaction management web application built with React, TypeScript, and Supabase. The application features user authentication, investment tracking, transaction history, and a comprehensive admin panel for system management. Lovable-generated project with modern tooling and UI component libraries.

## Structure

**Root-level directories**:
- **`src/`**: Core application source code (components, pages, contexts, hooks, integrations, utilities)
- **`public/`**: Static assets (favicon, logo, robots.txt)
- **`supabase/`**: Database migrations and Supabase configuration
- **`.zencoder/` & `.zenflow/`**: Workflow and automation configurations
- **Configuration files**: TypeScript, Vite, ESLint, Tailwind, PostCSS configuration

**Main source directories**:
- **`components/`**: Reusable UI components including shadcn/ui implementations
- **`pages/`**: Route components (Index, Auth, Dashboard, Admin pages, etc.)
- **`contexts/`**: React contexts (AuthContext for authentication state)
- **`hooks/`**: Custom React hooks
- **`integrations/`**: External service integrations (Supabase)
- **`lib/`**: Utility functions and helpers
- **`assets/`**: Images and static resources

## Language & Runtime

**Language**: TypeScript  
**Version**: 5.8.3  
**Runtime**: Node.js (ES modules)  
**Build System**: Vite 5.4.19  
**Package Manager**: npm/bun  
**React Version**: 18.3.1

## Dependencies

**Core Framework & Routing**:
- React 18.3.1, React DOM 18.3.1
- React Router DOM 6.30.1
- Vite 5.4.19 with React SWC plugin

**State Management & Data**:
- TanStack React Query 5.83.0 (data fetching/caching)
- React Hook Form 7.61.1 (form management)
- Zod 3.25.76 (schema validation)

**UI & Component Library**:
- shadcn/ui (built on Radix UI primitives)
- Multiple Radix UI packages (accordion, dialog, select, tabs, popover, etc.)
- TailwindCSS 3.4.17 (styling)
- Lucide React 0.462.0 (icons)
- Sonner 1.7.4 (toast notifications)
- Next Themes 0.3.0 (dark mode)

**Utilities**:
- Supabase JS 2.78.0 (backend/auth)
- Date-fns 3.6.0 (date manipulation)
- Embla Carousel 8.6.0 (carousel component)
- Recharts 2.15.4 (data visualization)
- React Resizable Panels 2.1.9
- Class Variance Authority, CLSX, Tailwind Merge (CSS utilities)

**Development Dependencies**:
- ESLint 9.32.0 with TypeScript support
- Tailwind CSS with typography plugin
- PostCSS, Autoprefixer
- TypeScript ESLint 8.38.0
- Lovable Tagger 1.1.11 (component tracking)

## Build & Installation

```bash
# Install dependencies
npm install
# or
bun install

# Development server (runs on http://localhost:8080)
npm run dev

# Production build
npm run build

# Development build
npm run build:dev

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Configuration Files

**TypeScript**: 
- `tsconfig.json` (base config with path alias `@/*` → `src/*`)
- `tsconfig.app.json` (app-specific TypeScript config)
- `tsconfig.node.json` (node tool configuration)

**Build & Styling**:
- `vite.config.ts`: Vite configuration with React SWC plugin, server host/port (8080), path aliases
- `tailwind.config.ts`: Comprehensive theme with custom colors, animations, and dark mode support
- `postcss.config.js`: PostCSS configuration for CSS processing

**Linting & Quality**:
- `eslint.config.js`: ESLint configuration with TypeScript and React Hooks rules

**Web Configuration**:
- `index.html`: Application entry point
- `components.json`: shadcn/ui configuration
- `.env`: Environment variables file

## Main Entry Point

**Application Root**: `src/main.tsx`
- Renders React app to DOM element with ID `root`
- Imports global CSS and App component

**App Component**: `src/App.tsx`
- Configures providers (Query, Auth, Tooltip, Sidebar)
- Sets up React Router with 17+ routes
- Includes user routes (auth, dashboard, profile, investments, transactions) and admin routes

## Project Routes

**User Routes**: `/` (home), `/auth`, `/dashboard`, `/about`, `/services`, `/profile`, `/settings`, `/invest`, `/investments`, `/deposit`, `/withdraw`, `/transactions`, catch-all `*` (404)

**Admin Routes**: `/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/investments`, `/admin/transactions`, `/admin/settings`, `/admin/profile`

## Key Features

- User authentication and session management
- Investment tracking and management
- Transaction history and reporting
- User profile and settings management
- Admin dashboard for system oversight
- Dark/light mode support
- Form validation with React Hook Form + Zod
- Toast notifications with Sonner
- Data caching with React Query
- Responsive UI with Tailwind CSS and shadcn/ui
