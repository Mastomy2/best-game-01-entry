// The five level layouts. Each map is 6 rows of 10 cells; a cell is:
//   '.' empty · '1'..'6' a standard brick (colour by its row) · 'H' a hard
//   brick (takes two hits) · 'S' a steel brick (never breaks) · 'B' a bonus
//   brick (drops a power-up when broken). A level is won when every breakable
//   brick is gone; steel bricks may stay.

export const LEVELS = [
  {
    name: 'First Light',
    map: [
      '..........',
      '.11111111.',
      '.12222221.',
      '.13333331.',
      '.1BBBBBB1.',
      '..........',
    ],
  },
  {
    name: 'Twin Peaks',
    map: [
      '11......11',
      '122....221',
      '1233..3321',
      '12HHHHHH21',
      '1BBBBBBB1.',
      '..........',
    ],
  },
  {
    name: 'The Vault',
    map: [
      'S........S',
      'SH111111HS',
      'SH222222HS',
      'SH3BBBB3HS',
      'SH444444HS',
      'S........S',
    ],
  },
  {
    name: 'Checker Storm',
    map: [
      '1H1H11H1H1',
      'H1B11H1B1H',
      '112H22H211',
      '1H333333H1',
      '.1BHHHHB1.',
      '..........',
    ],
  },
  {
    name: 'Neon Crown',
    map: [
      'S11111111S',
      'SH222222HS',
      'SH3BBBB3HS',
      'SH4HHHH4HS',
      'SH555555HS',
      'S11BBBB11S',
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
