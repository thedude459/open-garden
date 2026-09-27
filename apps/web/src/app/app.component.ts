import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { AuthApiService } from './auth/auth-api.service';
import { GardensApiService } from './gardens/gardens-api.service';
import { PlannerDraftService } from './gardens/planner-draft.service';
import { staysOnPlanner } from './gardens/stays-on-planner';
import { NoticeHost } from './ui/notice-host';
import { NoticeService } from './ui/notice.service';

@Component({
  selector: 'og-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NoticeHost],
  template: `
    <div class="app">
      @if (signedIn()) {
        <div class="app-frame">
          <button
            type="button"
            class="sidebar-toggle"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
          >
            Menu
          </button>
          @if (menuOpen()) {
            <button type="button" class="sidebar-backdrop" aria-label="Close menu" (click)="menuOpen.set(false)"></button>
          }
          <aside class="sidebar" [class.open]="menuOpen()">
            <a class="nav-brand" routerLink="/gardens">
              <img src="assets/icon-512.png" alt="" width="32" height="32" />
              <h1 class="brand-name">Open Garden</h1>
            </a>
            <div class="sidebar-body">
              <nav class="side-nav" aria-label="Primary">
                <a routerLink="/gardens" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Gardens</a>
                <a routerLink="/plants" routerLinkActive="active">Catalog</a>
                <a routerLink="/favorites" routerLinkActive="active">Favorites</a>
                @if (isAdmin()) {
                  <a routerLink="/admin/pipeline" routerLinkActive="active">Pipeline</a>
                }
              </nav>
              @if (gardenId(); as id) {
                <nav class="side-nav" aria-label="Garden">
                  <p class="nav-group-label">{{ gardenName() }}</p>
                  @if (openBedName(); as bed) {
                    <p class="nav-bed">{{ bed }}</p>
                  }
                  <a [routerLink]="['/gardens', id, 'layout']" routerLinkActive="active" aria-label="Garden Overview">Overview</a>
                  <a [routerLink]="['/gardens', id, 'plantings']" routerLinkActive="active">Plantings</a>
                  <a [routerLink]="['/gardens', id, 'calendar']" routerLinkActive="active">Calendar</a>
                  <a [routerLink]="['/gardens', id, 'reminders']" routerLinkActive="active">Reminders</a>
                  <a [routerLink]="['/gardens', id, 'transplants']" routerLinkActive="active">Transplants</a>
                  <a [routerLink]="['/gardens', id, 'configure']" routerLinkActive="active">Configuration</a>
                </nav>
              }
            </div>
            <button type="button" class="nav-text sidebar-signout" (click)="logout()">Sign out</button>
          </aside>
          <main class="shell">
            <router-outlet />
          </main>
        </div>
      } @else {
        <header class="app-bar">
          <a class="nav-brand" routerLink="/login">
            <img src="assets/icon-512.png" alt="" width="32" height="32" />
            <h1 class="brand-name">Open Garden</h1>
          </a>
          <span class="app-bar-end">
            <a routerLink="/login" routerLinkActive="active">Login</a>
          </span>
        </header>
        <main class="shell">
          <router-outlet />
        </main>
      }
    </div>
    <og-notice-host />
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly gardens = inject(GardensApiService);
  private readonly planner = inject(PlannerDraftService);

  readonly menuOpen = signal(false);
  readonly gardenId = signal<string | null>(null);
  readonly gardenName = signal('Garden');
  readonly bedId = signal<string | null>(null);
  readonly openBedName = computed(() => {
    const id = this.bedId();
    if (!id) return null;
    return this.planner.draft()?.beds.find((bed) => bed.id === id)?.name ?? null;
  });

  @HostListener('window:beforeunload', ['$event'])
  keepUnsavedLayout(event: BeforeUnloadEvent) {
    if (!this.planner.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  constructor() {
    const notices = inject(NoticeService);
    this.syncGarden(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => notices.clear());
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.menuOpen.set(false);
        this.syncGarden(e.urlAfterRedirects);
        this.dropDraftIfLeft(e.urlAfterRedirects);
      });
    const updates = inject(SwUpdate);
    if (updates.isEnabled) {
      updates.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          void updates.activateUpdate().then(() => document.location.reload());
        });
    }
  }

  isAdmin() {
    return this.auth.isAdmin();
  }

  signedIn() {
    return this.auth.isAuthenticated();
  }

  async logout() {
    if (this.planner.dirty() && !window.confirm('Leave without saving this layout?')) return;
    if (this.planner.dirty()) this.planner.discard();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private dropDraftIfLeft(url: string) {
    if (!this.planner.dirty()) return;
    const id = gardenIdFrom(url);
    if (id && staysOnPlanner(id, url)) return;
    this.planner.discard();
  }

  private syncGarden(url: string) {
    this.bedId.set(bedIdFrom(url));
    const id = gardenIdFrom(url);
    if (id === this.gardenId()) return;
    this.gardenId.set(id);
    this.gardenName.set('Garden');
    if (id) void this.loadGardenName(id);
  }

  private async loadGardenName(id: string) {
    const detail = await this.gardens.detail(id);
    if (this.gardenId() === id && detail) this.gardenName.set(detail.name);
  }
}

function gardenIdFrom(url: string): string | null {
  const path = url.split(/[?#]/)[0] ?? '';
  const match = path.match(/^\/gardens\/([^/]+)/);
  return match?.[1] ?? null;
}

function bedIdFrom(url: string): string | null {
  const path = url.split(/[?#]/)[0] ?? '';
  const match = path.match(/^\/gardens\/[^/]+\/layout\/beds\/([^/]+)/);
  return match?.[1] ?? null;
}
