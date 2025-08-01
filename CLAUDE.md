# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Production Migration Plan

**IMPORTANT**: We are using this codebase to build a robust chatbot. We already have created a test version and fixed all the necessary endpoints and adapters. The original version had IndexedDB and local storage working. We migrated to SQLite for testing purposes. But now we need to go to production.

### Current Migration Status
- ✅ Test version with SQLite working
- ✅ All necessary endpoints and adapters fixed
- 🔄 **Next Phase**: Production migration to PHP environment

### Production Environment Target
- **Location**: `/Users/brpl/code/ProcStudioIA`
- **Branch**: `ia_chats`
- **Backend**: PHP environment (instead of current SQLite)
- **Database**: PostgreSQL (migrate from SQLite schemas)
- **Frontend Integration**: Need entry point component for PHP frontend

### Migration Requirements

#### 1. Frontend Component Integration
- Create entry point component for insertion into PHP frontend
- Use same testing route initially (no immediate backend connection needed)
- Component should be self-contained and embeddable

#### 2. Database Migration
- Convert SQLite schemas to PostgreSQL schemas
- Establish proper connections between all entities
- Maintain data integrity during migration

#### 3. PHP Backend Integration
- Replace current Next.js API routes with PHP endpoints
- Maintain compatibility with existing frontend components
- Ensure proper error handling and validation

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database Operations
- `npm run postinstall` - Generate Prisma client (runs automatically after install)
- `npm run db:push` - Push Prisma schema changes to database
- `npm run db:studio` - Open Prisma Studio for database management

### Environment Setup
- `npm run vercel:env:pull` - Pull environment variables from Vercel

## Architecture Overview

Big-AGI is a Next.js 15 application built with TypeScript, using a modular architecture with multiple specialized systems:

### Core Technology Stack
- **Framework**: Next.js 15 with App Router and Pages Router (hybrid)
- **Language**: TypeScript with strict configuration
- **UI Framework**: MUI Joy UI with Emotion for styling
- **State Management**: Zustand with SQLite persistence (current) → PostgreSQL (production)
- **Database**: SQLite (current) → PostgreSQL (production) with PHP backend
- **API Layer**: tRPC (current) → PHP REST API (production) for type-safe client-server communication
- **Real-time**: Server-Sent Events (SSE) for streaming AI responses

### Key Architectural Components

#### 1. Application Structure (`src/apps/`)
- **Chat**: Main conversational AI interface with multi-model support
- **Beam**: Multi-model AI reasoning and comparison system
- **Call**: Voice call functionality with AI personas
- **Draw**: AI image generation interface
- **Personas**: AI persona creation and management

#### 2. Modular Systems (`src/modules/`)
- **AIX**: Core AI execution framework for chat generation
- **LLMs**: Vendor-agnostic language model integration (15+ providers)
- **Blocks**: Content rendering system for code, markdown, images
- **T2I**: Text-to-image generation system
- **Browse**: Web content fetching and processing

#### 3. Data Persistence (Migration in Progress)
- **Current**: SQLite Adapters with custom persistence layer for chats, LLMs, metrics
- **Target**: PostgreSQL with PHP backend integration
- **Zustand Integration**: State management with automatic database sync
- **Migration System**: SQLite → PostgreSQL schema conversion needed

#### 4. AI Provider Integration
Big-AGI supports 15+ AI vendors through a unified interface:
- OpenAI, Anthropic, Google Gemini (multimodal)
- Local servers: Ollama, LM Studio, LocalAI
- Cloud services: Azure, Groq, Perplexity, OpenRouter, etc.

### Path Aliases
- `~/common/*` → `src/common/*` - Shared utilities and components
- `~/modules/*` → `src/modules/*` - Feature modules
- `~/server/*` → `src/server/*` - Server-side code (to be replaced with PHP)

### Key Development Patterns

#### State Management
- Use Zustand for application state with automatic database persistence
- Store slices follow the pattern: `store-[domain]-[type].ts`
- Database middleware handles automatic persistence (currently SQLite, target PostgreSQL)

#### Component Architecture
- Apps are top-level user interfaces in `src/apps/`
- Modules contain reusable business logic in `src/modules/`
- Common components and utilities in `src/common/`

#### API Integration
- **Current**: tRPC routers provide type-safe API endpoints
- **Target**: PHP REST API endpoints
- Edge runtime used for AI streaming responses
- Server-side adapters handle AI provider communication

#### Content Rendering
- Block system renders different content types (code, markdown, images)
- Auto-detection of content types with appropriate renderers
- Support for syntax highlighting, LaTeX, diagrams

### Database Schema (Migration Required)

#### Current SQLite Schema
- **Chats**: Conversation storage with fragments and metadata
- **LLMs**: Model configurations and vendor settings  
- **Metrics**: Usage tracking and analytics
- **Workspace**: File attachments and live file sync

#### Target PostgreSQL Schema
- Convert all SQLite schemas to PostgreSQL equivalents
- Establish proper foreign key relationships
- Optimize for production performance
- Maintain data integrity constraints

### Important Files
- `next.config.ts` - Next.js configuration with SQLite setup (needs PHP integration)
- `src/server/env.ts` - Environment variable validation
- `src/lib/db/` - SQLite adapters and schema definitions (needs PostgreSQL conversion)
- `src/modules/aix/` - Core AI execution framework
- **Migration Target**: `/Users/brpl/code/ProcStudioIA` (ia_chats branch)

### Production Migration Checklist
- [ ] Create embeddable frontend component for PHP integration
- [ ] Convert SQLite schemas to PostgreSQL
- [ ] Establish database connections in PHP environment
- [ ] Replace tRPC endpoints with PHP REST API
- [ ] Test data migration and integrity
- [ ] Deploy to production PHP environment