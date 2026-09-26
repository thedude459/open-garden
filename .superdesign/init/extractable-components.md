## AppNav
- Source: `apps/web/src/app/app.component.ts`
- Category: layout
- Description: Top wordmark + Gardens/Catalog/Favorites + Sign out
- Extractable props: activeItem (string, default: "gardens"), signedIn (boolean, default: true), showPipeline (boolean, default: false)
- Hardcoded: "Open Garden", nav labels, Sign out, Iowan serif, leaf links

## GardenNav
- Source: `apps/web/src/app/gardens/garden-nav.ts`
- Category: layout
- Description: In-garden destinations
- Extractable props: activeItem (string, default: "overview"), gardenId (string, default: "g1")
- Hardcoded: Overview, Plantings, Calendar, Reminders, Transplants, Configuration

## EmptyState
- Source: `apps/web/src/app/ui/empty-state.ts`
- Category: basic
- Description: Empty card with title and body
- Extractable props: title (string), body (string)
- Hardcoded: empty-state CSS classes
