# Rebma Impex ERP - Application Directory Structures

This document outlines the codebase organization for the Web interface and the Mobile application.

---

## 1. Web Application Directory Layout (Vite + React.js + Tailwind CSS)

```
rebma-web/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/                 # Global media resources, logos, and svg animations
│   ├── components/             # Reusable UI component libraries
│   │   ├── ui/                 # Atomic design tokens (Buttons, Inputs, Modals, Loaders)
│   │   ├── charts/             # Canvas/SVG chart libraries (Recharts wrapper)
│   │   ├── layout/             # Framework shells (Navigation, Top Bar, Bottom Drawer)
│   │   └── collaborative/      # Live chat boxes, shared whiteboard, meeting frames
│   ├── context/                # Context-level providers (Auth, Socket.io connection, Theme)
│   ├── hooks/                  # Helper hooks (useSocket, useAuth, useGeoDistance)
│   ├── lib/                    # Library adapters (axios, date-fns, socketClient)
│   ├── router/                 # Routes manager containing RBAC Route guards
│   ├── services/               # REST API connector scripts (users, orders, warehouse)
│   ├── styles/                 # Theme styling files (Tailwind configuration, fonts, dark-mode variables)
│   └── views/                  # Department dashboard templates
│       ├── ceo/                # CEO analytical system panels + Live vehicle coordinates tracking map
│       ├── management/         # Purchase pricing tables & credit approval panels
│       ├── hr/                 # Onboarding approval dashboards, staff attendance grids
│       ├── marketing/          # Customer pipeline grids and direct checkout portals
│       ├── operations/         # Goods intake tables & material allocation pages
│       ├── finance/            # Invoices list, ledgers, & user credit rating cards
│       ├── production/         # WIP processing tasks and Raw materials requisition forms
│       ├── reception/          # Fast front-desk terminal UI for visitors and daily attendance
│       ├── logistics/          # Delivery scheduler panels and fleet analytics
│       └── dispatch/           # Live route dispatcher board
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 2. Mobile Application Directory Layout (React Native + Expo Router + NativeWind)

```
rebma-mobile/
├── assets/                     # Screen assets, app icons, map markers
├── src/
│   ├── components/             # Custom responsive mobile views (Map, ScreenHeader, StatusIndicator)
│   ├── hooks/                  # Live location monitoring hooks, background sync hooks
│   ├── navigation/             # Navigation stacks & tabs (Expo Router file-system structure)
│   ├── services/               # Api connections, Socket listeners
│   ├── store/                  # Client Zustand stores (Local cache, coordinates queue, network state)
│   │   ├── useAuthStore.ts
│   │   ├── useDeliveryStore.ts
│   │   └── useSyncStore.ts
│   ├── db/                     # WatermelonDB/SQLite offline schema configurations
│   │   └── schema.ts
│   ├── screens/                # User views
│   │   ├── auth/               # Access page, signup forms & verification status check screen
│   │   ├── ceo/                # KPI indicators and operational statuses overview
│   │   ├── dispatch/           # Active route, GPS tracking switch, and delivery maps
│   │   ├── operations/         # Goods reception & scanning logs
│   │   └── reception/          # Handheld attendance check-in page
│   └── utils/                  # Coordinate parsing, time handlers
├── App.json
├── package.json
└── tsconfig.json
```
