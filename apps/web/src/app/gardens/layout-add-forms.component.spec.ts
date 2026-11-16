import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import {
  LayoutNewBedForm,
  LayoutNewWalkwayForm,
  type NewBed,
  type NewPlot,
} from './layout-add-forms';

async function render<T extends LayoutNewBedForm | LayoutNewWalkwayForm>(type: Type<T>) {
  const fixture = TestBed.createComponent(type);
  const created: (NewBed | NewPlot)[] = [];
  let cancelled = 0;
  fixture.componentInstance.create.subscribe((value: NewBed | NewPlot) => created.push(value));
  fixture.componentInstance.cancelled.subscribe(() => cancelled++);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const type_ = async (name: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    await fixture.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, type: type_, submit, created, cancelled: () => cancelled };
}

describe('LayoutNewBedForm', () => {
  it('creates a bed in inches from feet, with its ground and mulch', async () => {
    const view = await render(LayoutNewBedForm);
    await view.type('bedName', '  North  ');
    await view.type('newLength', '10');
    await view.type('bedSite', 'raised');
    await view.type('bedMulch', 'straw');
    await view.submit();
    expect(view.created).toEqual([
      { name: 'North', lengthInches: 120, widthInches: 48, site: 'raised', mulch: 'straw' },
    ]);
  });

  it('needs a name and a size of at least an inch', async () => {
    const view = await render(LayoutNewBedForm);
    await view.submit();
    await view.type('bedName', 'North');
    await view.type('newWidth', '0');
    await view.submit();
    expect(view.created).toEqual([]);
  });

  it('converts what is typed when the member switches units', async () => {
    const view = await render(LayoutNewBedForm);
    TestBed.inject(AuthApiService).units.set('metric');
    await view.fixture.whenStable();
    const length = view.el.querySelector<HTMLInputElement>('[name="newLength"]')!;
    expect(Number(length.value)).toBeCloseTo(2.44, 1);
    expect(view.el.textContent).toContain('Length (m)');
  });

  it('shows a note and hides Cancel for the first bed', async () => {
    const view = await render(LayoutNewBedForm);
    view.fixture.componentRef.setInput('note', 'Add a named bed');
    view.fixture.componentRef.setInput('canCancel', false);
    await view.fixture.whenStable();
    expect(view.el.textContent).toContain('Add a named bed');
    expect(view.el.textContent).not.toContain('Cancel');
  });
});

describe('LayoutNewWalkwayForm', () => {
  it('creates a walkway, and Cancel backs out', async () => {
    const view = await render(LayoutNewWalkwayForm);
    await view.type('areaName', 'Path');
    await view.type('newAreaWidth', '2');
    await view.submit();
    expect(view.created).toEqual([{ name: 'Path', lengthInches: 48, widthInches: 24 }]);
    [...view.el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel')!.click();
    expect(view.cancelled()).toBe(1);
  });
});
