import { TestBed } from '@angular/core/testing';
import type { LayoutBedDto, SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { BedSoilTest, checkTest } from './bed-soil-test';

const soilTest = (over: Partial<SoilTestDto> = {}): SoilTestDto => ({
  id: 't1',
  bedId: 'b1',
  testedOn: '2026-04-01',
  lab: 'State lab',
  ph: 7.2,
  organicMatterPct: 2.5,
  nitrogen: null,
  phosphorus: 'low',
  potassium: 'high',
  recommendations: 'Add 4 lb bone meal per 100 sq ft',
  ...over,
});

const bed = (over: Partial<LayoutBedDto> = {}): LayoutBedDto => ({
  id: 'b1',
  name: 'North',
  geometry: null,
  ...over,
});

async function render(b: LayoutBedDto, canEdit = true, saveResult = true) {
  const fixture = TestBed.createComponent(BedSoilTest);
  const saved: [string, SoilTestCreateDto][] = [];
  const removed: string[] = [];
  fixture.componentRef.setInput('bed', b);
  fixture.componentRef.setInput('canEdit', canEdit);
  fixture.componentRef.setInput('save', async (bedId: string, test: SoilTestCreateDto) => {
    saved.push([bedId, test]);
    return saveResult;
  });
  fixture.componentRef.setInput('remove', async (_bedId: string, test: SoilTestDto) => {
    removed.push(test.id);
    return true;
  });
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const button = (text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  const type = async (name: string, value: string) => {
    const field = el.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    if (field instanceof HTMLSelectElement) {
      field.selectedIndex = [...field.options].findIndex((o) => o.text === value);
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    await fixture.whenStable();
  };
  return { fixture, el, button, type, saved, removed };
}

describe('BedSoilTest', () => {
  it('shows the latest test, the lab’s advice, and notes on it', async () => {
    const view = await render(bed({ soilTest: soilTest() }));
    const text = view.el.textContent ?? '';
    expect(text).toContain('Tested Apr 1, 2026 by State lab');
    expect(text).toContain('pH 7.2 · organic matter 2.5% · Phosphorus low · Potassium high');
    expect(text).toContain('The lab recommends: Add 4 lb bone meal per 100 sq ft');
    expect(text).toContain('Organic matter is 2.5%: work in compost');
    expect(text).toContain('Phosphorus is low: follow the lab’s recommendation.');
  });

  it('invites a first test, and shows viewers no form', async () => {
    const view = await render(bed(), false);
    expect(view.el.textContent).toContain('No test yet');
    expect(view.button('Record a soil test')).toBeUndefined();
  });

  it('records a test and closes the form once saved', async () => {
    const view = await render(bed());
    view.button('Record a soil test')!.click();
    await view.fixture.whenStable();
    await view.type('testedOn', '2026-03-15');
    await view.type('lab', '  County lab ');
    await view.type('ph', '6.4');
    await view.type('nitrogen', 'Low');
    view.button('Save test')!.click();
    await view.fixture.whenStable();
    expect(view.saved).toEqual([
      [
        'b1',
        {
          testedOn: '2026-03-15',
          lab: 'County lab',
          ph: 6.4,
          organicMatterPct: null,
          nitrogen: 'low',
          phosphorus: null,
          potassium: null,
          recommendations: null,
        },
      ],
    ]);
    expect(view.button('Save test')).toBeUndefined();
  });

  it('keeps the form open with what was typed when the save fails, and refuses an empty test', async () => {
    const view = await render(bed(), true, false);
    view.button('Record a soil test')!.click();
    await view.fixture.whenStable();
    view.button('Save test')!.click();
    await view.fixture.whenStable();
    expect(view.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter at least one result',
    );
    expect(view.saved).toEqual([]);
    await view.type('ph', '6.4');
    view.button('Save test')!.click();
    await view.fixture.whenStable();
    expect(view.saved).toHaveLength(1);
    expect(view.button('Save test')).toBeDefined();
  });

  it('deletes the latest test after a confirm', async () => {
    const view = await render(bed({ soilTest: soilTest() }));
    view.button('Delete this test')!.click();
    await view.fixture.whenStable();
    view.button('Confirm delete test')!.click();
    await view.fixture.whenStable();
    expect(view.removed).toEqual(['t1']);
    expect(view.button('Delete this test')).toBeDefined();
  });
});

describe('checkTest', () => {
  const ok: SoilTestCreateDto = {
    testedOn: '2026-03-15',
    lab: null,
    ph: 6.4,
    organicMatterPct: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    recommendations: null,
  };
  it('matches the server’s rules', () => {
    expect(checkTest(ok, '2026-06-01')).toBe('');
    expect(checkTest({ ...ok, testedOn: '' }, '2026-06-01')).toBe('Enter the date of the test');
    expect(checkTest({ ...ok, testedOn: '2026-07-01' }, '2026-06-01')).toContain('future');
    expect(checkTest({ ...ok, ph: 15 }, '2026-06-01')).toContain('pH');
    expect(checkTest({ ...ok, ph: null, organicMatterPct: 120 }, '2026-06-01')).toContain(
      'Organic matter',
    );
  });
});
