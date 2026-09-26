# Shared UI primitives

Custom CSS classes (no component library). Angular standalone templates.

## EmptyState — `apps/web/src/app/ui/empty-state.ts`

Empty card with title, muted body, projected actions.

```ts
@Component({
  selector: 'og-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <p class="empty-state-title">{{ title() }}</p>
      <p class="muted">{{ body() }}</p>
      <div class="empty-actions">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
}
```

## NoticeHost — `apps/web/src/app/ui/notice-host.ts`

Fixed toast: message + optional Dismiss.

```ts
template: `
  @if (notices.current(); as notice) {
    <div class="notice-host" aria-label="Notification" [attr.data-kind]="notice.kind"
      [attr.role]="notice.kind === 'success' ? 'status' : 'alert'">
      <p>{{ notice.message }}</p>
      @if (notice.dismissible) {
        <button type="button" class="btn btn-secondary" (click)="notices.dismiss()">Dismiss</button>
      }
    </div>
  }
`
```

## PlaceMarker — `apps/web/src/app/ui/place-marker.ts`

You-are-here: garden name link `>` current screen.

```ts
template: `
  <nav class="place-marker" aria-label="You are here">
    @if (gardenId()) {
      <a [routerLink]="['/gardens', gardenId(), 'layout']" aria-label="Garden home">{{ gardenName() }}</a>
    } @else {
      <span>{{ gardenName() }}</span>
    }
    <span aria-hidden="true"> &gt; </span>
    <span>{{ current() }}</span>
  </nav>
`
```

## Buttons (CSS, not a component)

- `.btn` white fill, ink text, 6px radius
- `.btn.btn-primary` leaf fill `#2f5d3a`, white text
- `.btn.btn-secondary` white, ink
- `.btn.btn-destructive` `#8a1f1f`, white text

## GardenNav — `apps/web/src/app/gardens/garden-nav.ts`

See layouts.md.
