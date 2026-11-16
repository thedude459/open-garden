import { TestBed } from '@angular/core/testing';
import type { LayoutAreaDto, LayoutBedDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { LayoutBedsList, LayoutWalkwaysList } from './layout-lists';

const bed: LayoutBedDto = {
  id: 'b1',
  name: 'North',
  mulch: 'straw',
  geometry: {
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};
const path: LayoutAreaDto = {
  id: 'a1',
  name: 'Path',
  originXInches: 0,
  originYInches: 0,
  lengthInches: 48,
  widthInches: 24,
};

const byLabel = (el: HTMLElement, label: string) =>
  el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

describe('LayoutBedsList', () => {
  it('shows each bed with its mulch and size, and Open and Edit', async () => {
    const fixture = TestBed.createComponent(LayoutBedsList);
    fixture.componentRef.setInput('beds', [bed]);
    fixture.componentRef.setInput('canEdit', true);
    const opened: string[] = [];
    const edited: string[] = [];
    fixture.componentInstance.open.subscribe((id) => opened.push(id));
    fixture.componentInstance.edit.subscribe((id) => edited.push(id));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('North');
    expect(el.textContent).toContain('Straw');
    expect(el.textContent).toContain('8 × 4 ft');
    byLabel(el, 'Open bed North')!.click();
    byLabel(el, 'Edit bed North')!.click();
    expect(opened).toEqual(['b1']);
    expect(edited).toEqual(['b1']);
  });

  it('a viewer can open a bed but not edit it', async () => {
    const fixture = TestBed.createComponent(LayoutBedsList);
    fixture.componentRef.setInput('beds', [bed]);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(byLabel(el, 'Open bed North')).not.toBeNull();
    expect(byLabel(el, 'Edit bed North')).toBeNull();
  });
});

describe('LayoutWalkwaysList', () => {
  it('deletes a walkway only after a confirm', async () => {
    const fixture = TestBed.createComponent(LayoutWalkwaysList);
    fixture.componentRef.setInput('areas', [path]);
    fixture.componentRef.setInput('canEdit', true);
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((a) => removed.push(a.id));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Path · 4 × 2 ft');
    byLabel(el, 'Delete area Path')!.click();
    await fixture.whenStable();
    byLabel(el, 'Confirm delete Path')!.click();
    expect(removed).toEqual(['a1']);
  });
});
