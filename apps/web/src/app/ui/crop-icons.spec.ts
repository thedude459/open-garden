import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROP_ICONS } from './crop-icons';

const dir = join(__dirname, '../../assets/crops');
const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));

describe('crop icons', () => {
  it('has a file for every crop listed, and lists every file', () => {
    const names = files.map((f) => f.replace(/\.svg$/, ''));
    expect(names.filter((n) => !n.startsWith('generic-')).sort()).toEqual([...CROP_ICONS].sort());
    expect(names).toEqual(expect.arrayContaining(['generic-plant', 'generic-flower']));
  });

  it('holds only drawings: no scripts, event handlers, embedded images, or outside links', () => {
    for (const f of files) {
      const svg = readFileSync(join(dir, f), 'utf8');
      expect(svg, f).toMatch(/^<svg[\s>]/);
      expect(svg, f).not.toMatch(/<script|<foreignObject|<image|\son[a-z]+=|href="(?!#)/i);
    }
  });
});
