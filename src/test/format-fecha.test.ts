import { describe, it, expect } from 'vitest';

import {

  formatFechaPy,

  isoToDDMMAAAA,

  parseDDMMAAAA,

  parseFechaPyToIso,

} from '@/lib/format-fecha';



describe('formatFechaPy', () => {

  it('convierte ISO a dd/mm/aaaa', () => {

    expect(formatFechaPy('2022-03-26')).toBe('26/03/2022');

  });



  it('parsea dd/mm/aaaa y DDMMAAAA a ISO', () => {

    expect(parseFechaPyToIso('26/03/2022')).toBe('2022-03-26');

    expect(parseDDMMAAAA('15032015')).toBe('2015-03-15');

    expect(parseFechaPyToIso('26/03/22')).toBe('2022-03-26');

  });



  it('ISO → DDMMAAAA', () => {

    expect(isoToDDMMAAAA('2015-03-15')).toBe('15032015');

  });

});


