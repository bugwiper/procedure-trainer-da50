import { describe, expect, it } from 'vitest';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { parsePreviewFlags, parsePreviewQuantities } from '../src/ui/preview';

// The preview flags of the free panel (Phase 5, C-03): pure parsers over a query string.

describe('?q=id:value,...', () => {
  const parse = (search: string) => parsePreviewQuantities(search, DA50RG_QUANTITIES);

  it('sets known quantities inside their range', () => {
    expect(parse('?q=smoke_density:100,rpm:0')).toEqual({ smoke_density: 100, rpm: 0 });
    expect(parse('?q=oil_pressure_bar:4.5')).toEqual({ oil_pressure_bar: 4.5 });
  });

  it('ignores an unknown id, a value out of range, a non-number and a malformed entry', () => {
    expect(parse('?q=no_such:1')).toEqual({});
    expect(parse('?q=smoke_density:101')).toEqual({});
    expect(parse('?q=smoke_density:-1')).toEqual({});
    expect(parse('?q=smoke_density:abc')).toEqual({});
    expect(parse('?q=smoke_density:')).toEqual({});
    expect(parse('?q=smoke_density')).toEqual({});
    expect(parse('?q=smoke_density:1:2')).toEqual({});
    expect(parse('?q=constructor:1,__proto__:1')).toEqual({});
  });

  it('takes the ground speed inside 0 to 100 and ignores 500 (T-05.1-01)', () => {
    expect(parse('?q=ground_speed_kt:60')).toEqual({ ground_speed_kt: 60 });
    expect(parse('?q=ground_speed_kt:500')).toEqual({});
    expect(parse('?q=ground_speed_kt:-5')).toEqual({});
  });

  it('keeps the valid entries next to the bad ones', () => {
    expect(parse('?q=smoke_density:50,bogus:1,rpm:9999')).toEqual({ smoke_density: 50 });
  });

  it('gives nothing for an absent or empty parameter', () => {
    expect(parse('')).toEqual({});
    expect(parse('?q=')).toEqual({});
    expect(parse('?scene=cruise')).toEqual({});
  });
});

describe('?flags=name,...', () => {
  const known = ['deice.max_active', 'deice.windshield_spray'];

  it('sets the known flags true', () => {
    expect(parsePreviewFlags('?flags=deice.windshield_spray', known)).toEqual({
      'deice.windshield_spray': true,
    });
    expect(parsePreviewFlags('?flags=deice.max_active,deice.windshield_spray', known)).toEqual({
      'deice.max_active': true,
      'deice.windshield_spray': true,
    });
  });

  it('ignores an unknown name and gives nothing for an absent or empty parameter', () => {
    expect(parsePreviewFlags('?flags=nope,constructor', known)).toEqual({});
    expect(parsePreviewFlags('', known)).toEqual({});
    expect(parsePreviewFlags('?flags=', known)).toEqual({});
  });
});
