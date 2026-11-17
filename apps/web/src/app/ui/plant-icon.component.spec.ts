import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlantIcon, plantIconFile } from './plant-icon';

describe('plantIconFile', () => {
  it('uses the crop’s icon where the crop has one', () => {
    expect(plantIconFile('vegetable', 'tomato')).toBe('tomato');
    expect(plantIconFile('flower', 'calendula')).toBe('calendula');
  });

  it('falls back to a generic flower or plant', () => {
    expect(plantIconFile('flower', null)).toBe('generic-flower');
    expect(plantIconFile('vegetable', 'not-a-crop')).toBe('generic-plant');
    expect(plantIconFile('tree')).toBe('generic-plant');
  });
});

describe('PlantIcon', () => {
  it('shows the crop’s icon as a decorative image', async () => {
    const fixture = TestBed.createComponent(PlantIcon);
    fixture.componentRef.setInput('plantType', 'vegetable');
    fixture.componentRef.setInput('cropId', 'sweet-corn');
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.dataset['icon']).toBe('sweet-corn');
    const img = host.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/assets/crops/sweet-corn.svg');
    expect(img.getAttribute('alt')).toBe('');
  });
});
