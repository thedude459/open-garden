import { TestBed } from '@angular/core/testing';
import type { SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { checkTest, SoilTestPanel } from './soil-test-panel';
import { settled } from '../settled';

const soilTest = (over: Partial<SoilTestDto> = {}): SoilTestDto => ({
  id: 't1',
  areaId: null,
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

async function render(
  test: SoilTestDto | null,
  canEdit = true,
  saveResult = true,
  inherited: { name: string; test: SoilTestDto } | null = null,
) {
  const fixture = TestBed.createComponent(SoilTestPanel);
  const saved: SoilTestCreateDto[] = [];
  const removed: string[] = [];
  fixture.componentRef.setInput('ownerId', 'b1');
  fixture.componentRef.setInput('name', 'North');
  fixture.componentRef.setInput('test', test);
  fixture.componentRef.setInput('inherited', inherited);
  fixture.componentRef.setInput('canEdit', canEdit);
  fixture.componentRef.setInput('save', async (t: SoilTestCreateDto) => {
    saved.push(t);
    return saveResult;
  });
  fixture.componentRef.setInput('remove', async (test: SoilTestDto) => {
    removed.push(test.id);
    return true;
  });
  fixture.autoDetectChanges();
  await settled(fixture);
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
    await settled(fixture);
  };
  return { fixture, el, button, type, saved, removed };
}

describe('SoilTestPanel', () => {
  it('shows the latest test, the lab’s advice, and notes on it', async () => {
    const view = await render(soilTest());
    const text = view.el.textContent ?? '';
    expect(text).toContain('Tested Apr 1, 2026 by State lab');
    expect(text).toContain('pH 7.2 · organic matter 2.5% · Phosphorus low · Potassium high');
    expect(text).toContain('The lab recommends: Add 4 lb bone meal per 100 sq ft');
    expect(text).toContain('Organic matter is 2.5%: work in compost');
    expect(text).toContain('Phosphorus is low: follow the lab’s recommendation.');
  });

  it('invites a first test, and shows viewers no form', async () => {
    const view = await render(null, false);
    expect(view.el.textContent).toContain('No test yet');
    expect(view.button('Record a soil test')).toBeUndefined();
  });

  it('shows the area’s test for a bed without its own', async () => {
    const area = soilTest({ id: 'a1', areaId: 'veg', bedId: null, ph: 6.5, phosphorus: null });
    const view = await render(null, true, true, { name: 'Vegetable garden', test: area });
    expect(view.el.textContent).toContain(
      'The Vegetable garden test applies: Tested Apr 1, 2026 by State lab, pH 6.5 · organic matter 2.5% · Potassium high.',
    );
    expect(view.button('Delete this test')).toBeUndefined();
  });

  it('records a test and closes the form once saved', async () => {
    const view = await render(null);
    view.button('Record a soil test')!.click();
    await settled(view.fixture);
    await view.type('testedOn', '2026-03-15');
    await view.type('lab', '  County lab ');
    await view.type('ph', '6.4');
    await view.type('nitrogen', 'Low');
    view.button('Save test')!.click();
    await settled(view.fixture);
    expect(view.saved).toEqual([
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
    ]);
    expect(view.button('Save test')).toBeUndefined();
  });

  it('keeps the form open with what was typed when the save fails, and refuses an empty test', async () => {
    const view = await render(null, true, false);
    view.button('Record a soil test')!.click();
    await settled(view.fixture);
    view.button('Save test')!.click();
    await settled(view.fixture);
    expect(view.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter at least one result',
    );
    expect(view.saved).toEqual([]);
    await view.type('ph', '6.4');
    view.button('Save test')!.click();
    await settled(view.fixture);
    expect(view.saved).toHaveLength(1);
    expect(view.button('Save test')).toBeDefined();
  });

  it('deletes the latest test after a confirm', async () => {
    const view = await render(soilTest());
    view.button('Delete this test')!.click();
    await settled(view.fixture);
    view.button('Confirm delete test')!.click();
    await settled(view.fixture);
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
