# Kidario Frontend

Kidario is a mobile-first web app that connects parents with qualified pedagogy and early-childhood teachers for private classes (online or in person). Parents can discover teachers, schedule classes, and track child progress. Teachers can manage their profile, availability, student agenda, and post-class progress notes.

## Product Purpose

Kidario is being built to solve two core needs:

- Parents need a trusted way to find and book specialized teachers for their children.
- Teachers need a practical workspace to offer services, manage classes, and document progress.

## MVP Scope

### Parent side

1. Entry and auth (welcome, login, signup, role selection)
2. Teacher discovery (explore, filters, teacher profile)
3. Booking flow (select slot, checkout, confirmation)
4. Agenda management (upcoming/past, detail, cancel/reschedule)
5. Progress and review (post-class review + child progress tracking)

### Teacher side

1. Teacher onboarding and profile publishing
2. Availability management and booking agenda
3. Post-class notes and progress tagging

## Current Build Status

The frontend already includes the main visual foundation and part of the parent journey.

| Flow | Status |
| --- | --- |
| Auth screens and role entry | In progress (Supabase Auth MVP integrado) |
| Parent explore + teacher profile | Implemented with mock data |
| Booking checkout and confirmation | In progress (UI + flujo mock) |
| Parent agenda | In progress (list/tabs implemented, detail actions pending) |
| Parent progress | In progress (overview UI implemented, full history pending) |
| Teacher onboarding and dashboard | Planned |

## Implemented Routes

Defined in `src/App.tsx`:

- `/` - Welcome
- `/login` - Login
- `/recuperar-senha` - Password recovery
- `/cadastro` - Signup
- `/escolher-perfil` - Role selection
- `/escolher-professora` - Role selection
- `/explorar` - Teacher marketplace
- `/professora/:id` - Teacher profile
- `/agendar/:id` - Booking scheduler
- `/checkout/:id` - Booking checkout
- `/confirmacao-reserva/:bookingId` - Booking confirmation
- `/agenda` - Parent agenda
- `/progresso` - Parent progress
- `/perfil` - Parent profile

## Design Direction

The visual system follows the Kidario references with a calm, warm, and trustworthy tone:

- Mobile-first layout and readable spacing
- Friendly but premium visual language
- Typography: Poppins (display) + Inter (body)
- Color families: mint (primary), lavender (secondary), coral (accent)
- Emphasis on clarity, accessibility, and low cognitive load for parents

Core design tokens and UI styles are implemented in `src/index.css` and `tailwind.config.ts`.

## Core Component Model

The component architecture is split into:

- Domain components: teacher cards/profile blocks, booking status, progress blocks
- Generic UI base: layout shell, top bar, bottom nav, form controls, feedback states

Main folders:

- `src/components/layout` - app shell and navigation
- `src/components/marketplace` - discovery and teacher listing/profile blocks
- `src/components/booking` - booking status primitives
- `src/components/ui` - reusable UI primitives (shadcn + Kidario variants)

## Reference Inputs Used for Product Definition

The following product artifacts define expected behavior and UX direction:

- `Moodboard Kidario.pdf` (brand tone and visual language)
- `Pantallas Kidario.pdf` (required screens)
- `Flujos Kidario.pdf` (critical user flows)
- `Componentes Kidario.pdf` (domain and base component inventory)

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS + shadcn/ui
- React Router
- TanStack Query
- Framer Motion
- Vitest + Testing Library

## Getting Started

### Requirements

- Node.js 18+
- npm

### Install and run

```bash
npm install
npm run dev
```

### Supabase Auth MVP setup

Prueba A uses a `Supabase-only` auth integration from frontend (no FastAPI in this phase).
The frontend calls Supabase Auth REST endpoints directly for `signup`, `login`, and `logout`.

Create `.env.local` in the frontend folder using `.env.example`:

```bash
cp .env.example .env.local
```

Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

In Supabase dashboard:

1. Go to `Authentication -> Providers -> Email` and enable Email provider.
2. Keep `Confirm email` enabled to validate the real signup flow.
3. Add your local URL in `Authentication -> URL Configuration`:
   - `Site URL`: `http://localhost:8080`
   - `Redirect URLs`: `http://localhost:8080/*`
4. Save settings and restart `npm run dev` if env values were changed while the app was running.
5. In this MVP, after signup the user is redirected to login with a "check email" notice.
   The user must confirm the email from inbox first, then login manually.

### Signup/Login/Auth validation checklist (Prueba A)

1. Open app and sign up as parent in `/escolher-perfil?intent=signup` -> `/cadastro`.
2. Confirm redirect to `/login` with check-email notice.
3. Open inbox and click Supabase confirmation link.
4. Login from `/login` with same credentials and confirm redirect to `/explorar`.
5. Log out from `/perfil`.
6. Try booking: go to `/professora/:id` -> `/agendar/:id` -> `/checkout/:id`.
7. If logged out, checkout should redirect to login with `returnTo`.
8. Login from that redirect and confirm it returns automatically to checkout.
9. Complete booking and validate redirect to `/confirmacao-reserva/:bookingId`.
10. Open `/agenda` and confirm new booking appears in upcoming list.

### Useful scripts

```bash
npm run dev         # start local dev server
npm run build       # production build
npm run build:dev   # build with development mode
npm run preview     # preview production build
npm run lint        # run ESLint
npm run test        # run tests once
npm run test:watch  # run tests in watch mode
```

## Current Data/Backend Notes

- Most product data is mocked for now (for example `src/data/mockTeachers.ts`).
- Auth, booking transactions, availability persistence, and progress persistence still need backend integration.
- This repository currently prioritizes UX flow validation and design-system consistency while backend contracts are completed.
