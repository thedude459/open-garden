import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlantIcon, plantIcon } from './plant-icon';

describe('plantIcon', () => {
  it('draws a vegetable by its family where the family has a drawing', () => {
    expect(plantIcon('vegetable', 'Nightshade family')).toBe('nightshade');
    expect(plantIcon('vegetable', 'Grass family')).toBe('corn');
    expect(plantIcon('vegetable', 'Amaranth family')).toBe('vegetable');
    expect(plantIcon('vegetable', null)).toBe('vegetable');
  });

  it('draws anything else by its type, so dill is an herb, not a carrot', () => {
    expect(plantIcon('herb', 'Carrot family')).toBe('herb');
    expect(plantIcon('tree', 'Rose family')).toBe('tree');
    expect(plantIcon('cane')).toBe('cane');
    expect(plantIcon('mystery')).toBe('vegetable');
  });
});

describe('PlantIcon', () => {
  it('renders the drawing on its type’s tile, hidden from screen readers', async () => {
    const fixture = TestBed.createComponent(PlantIcon);
    fixture.componentRef.setInput('plantType', 'vegetable');
    fixture.componentRef.setInput('family', 'Cabbage family');
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('plant-stand-in');
    expect(host.dataset['plantType']).toBe('vegetable');
    expect(host.dataset['icon']).toBe('cabbage');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('path')!.getAttribute('d')).toMatch(/^M12 13m-7 0/);
  });
});
