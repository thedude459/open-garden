# Garden App Frontend State Flow Architecture

## Overview

The Garden App frontend manages a complex garden planning system with multiple interrelated features. This document describes how state flows through the application and coordinates between features.

## Top-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx (384 lines)                      │
│  Entry point: orchestrates page routing and top-level state     │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─► usePageRouter ────────────────────► Page Navigation State
         │   ├─ activePage, setActivePage        (home, calendar, planner, etc)
         │   ├─ navigateTo()
         │   └─ Page UI state (nav, help, dates)
         │
         ├─► useNotices ──────────────────────► Global Notifications
         │   └─ Toast/alert system
         │
         ├─► useAuthFlow ─────────────────────► Authentication State
         │   ├─ Login/logout
         │   ├─ Email verification
         │   └─ Password reset
         │
         ├─► useGardenDataFlow (541 lines) ──► Core Garden Data
         │   ├─ gardens[], beds[], placements[]
         │   ├─ plantings[], cropTemplates[]
         │   ├─ Garden insights (climate, planting windows, etc)
         │   └─ Caching layer with TTL
         │
         ├─► useTaskActions ──────────────────► Task Management
         │   └─ Task CRUD operations
         │
         ├─► useGardenActions ────────────────► Garden/Bed Management
         │   └─ Garden CRUD operations
         │
         ├─► usePlannerActions (546 lines) ──► Planner Operations
         │   ├─ usePlacementSpacing (110 lines)
         │   ├─ Placement CRUD operations
         │   └─ Bed positioning
         │
         └─► Feature Page Sections
             ├─ HomePageSection
             ├─ CalendarWeatherSection ───────► Calendar Feature
             │  └─ [NEW] CalendarContext
             │
             ├─ PlannerPageSection ───────────► Planner Feature
             │  └─ [NEW] PlannerContext
             │
             ├─ SeasonalPageSection ──────────► Seasonal Planning Feature
             │  └─ [NEW] SeasonalPlanContext
             │
             └─ Other feature pages...
```

## State Management Layers

### 1. **Page Navigation Layer** (`usePageRouter`)
Manages which page is displayed and UI chrome state.

**State**: `activePage`, `isNavOpen`, `isHelpOpen`, `monthCursor`, `selectedDate`, `placementBedId`

**Responsibilities**:
- Handle auth URL parameters (verify tokens, reset tokens)
- Guard pages that require a garden selection
- Auto-close nav when page/garden changes
- Initialize help modal on first login

### 2. **Authentication Layer** (`useAuthFlow`)
Manages user authentication and session state.

**State**: `token`, `email`, `username`, `isEmailVerified`

**Responsibilities**:
- Login/logout
- Email verification
- Password reset flows
- Token persistence

### 3. **Core Data Layer** (`useGardenDataFlow`)
Manages all persisted garden, bed, placement, and crop data, plus computed insights.

**State Subdimensions**:
- **Garden Core**: `gardens[]`, `selectedGarden`, `beds[]`, `placements[]`, `plantings[]`, `cropTemplates[]`
- **Computed Insights**: `gardenClimate`, `plantingWindows`, `gardenSunPath`, `seasonalPlan`, `sensorSummary`, `gardenTimeline`, `plantingRecommendation`
- **Crop Sync**: `cropTemplateSyncStatus`, `isRefreshingCropLibrary`, `isCleaningLegacyCropLibrary`
- **Loading States**: `isLoadingGardenData`, `isLoadingClimate`, `isLoadingPlantingWindows`, etc.

**Caching Strategy** (Future: use `cacheUtils.ts`):
- Each insight type has its own cache map
- TTL: 5 minutes per cached item
- Invalidation on garden/bed/placement changes
- Manual refresh endpoints

### 4. **Action/Command Layers**

#### **Garden & Bed Management** (`useGardenActions`)
CRUD operations on gardens, beds, and yard configuration.

#### **Task Management** (`useTaskActions`)
Task creation, editing, completion tracking.

#### **Planner Operations** (`usePlannerActions`)
Complex placement and bed positioning logic with history tracking.

**Subdivisions**:
- `usePlacementSpacing` - Spacing validation and buffer checks
- Placement API operations - Server sync
- Bed API operations - Server sync
- History tracking - Undo/redo

### 5. **Feature-Level Contexts** (New)

To reduce prop drilling and improve feature encapsulation:

#### **PlannerContext** (`features/planner/PlannerContext.tsx`)
Consolidates all planner-specific state for `PlannerPageSection` and its children.

**Contents**:
- Beds, placements, crop selection
- Planner actions (add, move, delete placements/beds)
- Spacing validation
- Undo/redo state
- UI state (selected bed ID)

#### **CalendarContext** (`features/calendar/CalendarContext.tsx`)
Consolidates calendar and task management state.

**Contents**:
- Month cursor, selected date
- Task list and actions
- Calendar events
- Planting window data

#### **SeasonalPlanContext** (`features/planning/SeasonalPlanContext.tsx`)
Consolidates seasonal plan and planting recommendations.

**Contents**:
- Seasonal plan data
- Planting recommendations
- Selection state

## Data Flow Patterns

### Pattern 1: Global → Feature (Read-Only)
```
App.tsx
  ↓
useGardenDataFlow (reads gardens, beds, placements)
  ↓
Feature Component (e.g., PlannerPageSection)
  ↓
FeatureContext.Provider (wraps child components)
  ↓
Feature Child Components (read via context hook)
```

### Pattern 2: Feature → App (Mutations)
```
Feature Component
  ↓
useXxxActions hook (e.g., usePlannerActions)
  ↓
API calls (fetchAuthed)
  ↓
Update App-level state (setBeds, setPlacements, etc)
  ↓
App re-renders with fresh data
```

### Pattern 3: Cross-Feature Coordination
```
PlannerPageSection (moves placement)
  ↓
usePlannerActions.movePlacement()
  ↓
API PATCH /placements/{id}
  ↓
setPlantings() [from App.tsx]
  ↓
App re-renders
  ↓
HomePageSection, CalendarWeatherSection see new data
```

## Component Size and Reduction Goals

| Layer | Size Before | Size After | Strategy |
|-------|------------|-----------|----------|
| App.tsx | 427 lines | 384 lines | Extract usePageRouter |
| usePlannerActions | 590 lines | 546 lines | Extract usePlacementSpacing |
| useGardenDataFlow | 541 lines | TBD | Create cacheUtils |
| Prop Drilling | 20+ props per page | Reduced via contexts | PlannerContext, CalendarContext |

## Recommended Next Steps for Refactoring

### 1. **Integrate Cache Utilities** (`cacheUtils.ts`)
Update `useGardenDataFlow` to use `getCachedData()`, `setCachedData()` helpers to reduce manual cache management.

```typescript
// Before:
const cached = climateCacheRef.current.get(gardenId);
if (cached && Date.now() - climateCacheTimeRef.current.get(gardenId)! < TTL) { ... }

// After:
const cached = getCachedData(climateCacheRef.current, gardenId);
if (cached) { ... }
```

### 2. **Extract Insight Loading** 
Create `useGardenInsights(selectedGarden)` hook that manages climate, planting windows, sun path loading together.

### 3. **Use Feature Contexts in Page Sections**
Wrap calendar, planner, and seasonal components with their respective contexts to eliminate prop drilling:

```typescript
// In App.tsx
<PlannerProvider value={{ beds, placements, ...plannerActions, ... }}>
  <PlannerPageSection yardGridRef={yardGridRef} />
</PlannerProvider>
```

### 4. **Extract Shared Business Logic**
Move repeated validation/formatting logic to utility modules:
- Placement validation rules
- Garden dimension calculations
- Date/timezone handling

## Testing Strategy

**Unit Tests**:
- `usePlacementSpacing.test.tsx` - Spacing validation logic
- `usePageRouter.test.ts` - Navigation and routing
- `cacheUtils.test.ts` - Cache TTL and invalidation

**Integration Tests**:
- Feature context providers with real hooks
- App-level state coordination tests

**E2E Tests** (via Playwright):
- Planner: add, move, delete placements
- Calendar: view events, create tasks
- Cross-feature: create task in planner, see in calendar

## Key Metrics

- **App.tsx lines**: 384 (down from 427) ✓
- **Hook complexity**: Largest hook ~541 lines (target: <250 per hook)
- **Test coverage**: 15 test files (target: 70%+ coverage for critical paths)
- **Prop drilling**: Reduced via 3 new feature contexts ✓

---

*Last updated: April 4, 2026*
