# Routes — `apps/web/src/app/app.routes.ts`

Angular standalone lazy routes. Auth guard on all but `/login`. `/` → `/gardens`. `/gardens/:id` → `/gardens/:id/layout`.

| Path | Page | Summary |
|---|---|---|
| `/login` | `auth/login.page.ts` | Sign in / Create account form |
| `/gardens` | `gardens/garden-list.page.ts` | Household gardens; create; overdue / this week |
| `/gardens/:id/layout` | `garden-layout.page.ts` | Overview: scale map + Create bed rail |
| `/gardens/:id/layout/beds/:bedId` | `garden-bed-view.page.ts` | Bed plan + Place catalog + tray |
| `/gardens/:id/plantings` | `garden-plantings.page.ts` | Record plantings; beds created on Overview |
| `/gardens/:id/calendar` | `garden-calendar.page.ts` | Sow / transplant windows |
| `/gardens/:id/reminders` | `garden-reminders.page.ts` | Care due list |
| `/gardens/:id/transplants` | `garden-transplants.page.ts` | Indoor starts |
| `/gardens/:id/configure` | `garden-detail.page.ts` | Site, members, invite, delete |
| `/plants` | `plants/plant-list.page.ts` | Catalog search |
| `/plants/:id` | `plants/plant-detail.page.ts` | Plant facts |
| `/favorites` | `favorites/favorites-list.page.ts` | Saved plants |
| `/admin/pipeline` | `admin/pipeline.page.ts` | Admin catalog load |
