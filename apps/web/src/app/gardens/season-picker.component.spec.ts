import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SeasonPicker } from './season-picker';

describe('SeasonPicker', () => {
  it('offers this season and the next, and says which is picked (ADR 0040)', async () => {
    const fixture = TestBed.createComponent(SeasonPicker);
    fixture.componentRef.setInput('current', 2026);
    fixture.componentRef.setInput('shown', 2026);
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((year) => picked.push(year));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    expect([...select.options].map((o) => o.textContent.trim())).toEqual([
      '2026 (now)',
      '2027 (planning)',
    ]);
    expect(select.value).toBe('2026');
    select.value = '2027';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual([2027]);
  });
});
