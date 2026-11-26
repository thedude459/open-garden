import type { ComponentFixture } from '@angular/core/testing';

/**
 * For component tests: waits for a stubbed service's promises, then for the
 * view to redraw. The app runs without zone.js, so `whenStable()` waits only
 * for work Angular tracks (HttpClient, scheduled redraws), not for a stub's
 * plain promise.
 */
export async function settled(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}
