# Shared layouts

## App shell — `apps/web/src/app/app.component.ts`

`.shell` max 960px (1280 with planner). Top nav: wordmark “Open Garden”, Gardens / Catalog / Favorites (+ Pipeline if admin), Sign out. Signed-out: Login link. Outlet + notice host.

```html
<div class="shell">
  <nav class="nav">
    <h1><a routerLink="/gardens">Open Garden</a></h1>
    <!-- signed in -->
    <a routerLink="/gardens">Gardens</a>
    <a routerLink="/plants">Catalog</a>
    <a routerLink="/favorites">Favorites</a>
    <span class="nav-auth"><button class="nav-text">Sign out</button></span>
  </nav>
  <router-outlet />
</div>
<og-notice-host />
```

## GardenNav — `apps/web/src/app/gardens/garden-nav.ts`

Per-garden destinations. Overview link `aria-label="Garden Overview"`, visible text Overview.

```html
<nav class="garden-nav" aria-label="Garden">
  <a routerLink=".../layout" aria-label="Garden Overview">Overview</a>
  <a routerLink=".../plantings">Plantings</a>
  <a routerLink=".../calendar">Calendar</a>
  <a routerLink=".../reminders">Reminders</a>
  <a routerLink=".../transplants">Transplants</a>
  <a routerLink=".../configure">Configuration</a>
</nav>
```

## PlaceMarker

See components.md. Used on Overview / Bed View.
