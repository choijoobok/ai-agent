// @feat FEAT-503
import { describe, expect, it } from 'vitest';

const moduleSources = import.meta.glob('/src/modules/sample/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const legacySources = import.meta.glob('/src/features/sample/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('TC-5035 sample 참조 모듈 경계', () => {
  it('여섯 화면은 modules/sample에만 존재하고 구 features/sample은 비어 있다', () => {
    expect(Object.keys(moduleSources)).toEqual(
      expect.arrayContaining([
        '/src/modules/sample/features/singleoffset/pages/SampleSingleOffsetPage.tsx',
        '/src/modules/sample/features/singlecursor/pages/SampleSingleCursorPage.tsx',
        '/src/modules/sample/features/mdhorizontal/pages/SampleMdHorizontalPage.tsx',
        '/src/modules/sample/features/mdvertical/pages/SampleMdVerticalPage.tsx',
        '/src/modules/sample/features/mdtabs/pages/SampleMdTabsPage.tsx',
        '/src/modules/sample/features/excel/pages/SampleExcelPage.tsx',
      ]),
    );
    expect(Object.keys(legacySources)).toEqual([]);
  });
});
