import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** local 변형의 삭제 가능한 참조 화면이다(ADR-009). */
export const SAMPLE_SCREENS: Record<string, LazyExoticComponent<ComponentType>> = {
  '/sample/single-offset': lazy(async () => ({ default: (await import('@/modules/sample/features/singleoffset/pages/SampleSingleOffsetPage')).SampleSingleOffsetPage })),
  '/sample/single-cursor': lazy(async () => ({ default: (await import('@/modules/sample/features/singlecursor/pages/SampleSingleCursorPage')).SampleSingleCursorPage })),
  '/sample/md-horizontal': lazy(async () => ({ default: (await import('@/modules/sample/features/mdhorizontal/pages/SampleMdHorizontalPage')).SampleMdHorizontalPage })),
  '/sample/md-vertical': lazy(async () => ({ default: (await import('@/modules/sample/features/mdvertical/pages/SampleMdVerticalPage')).SampleMdVerticalPage })),
  '/sample/md-tabs': lazy(async () => ({ default: (await import('@/modules/sample/features/mdtabs/pages/SampleMdTabsPage')).SampleMdTabsPage })),
  '/sample/excel': lazy(async () => ({ default: (await import('@/modules/sample/features/excel/pages/SampleExcelPage')).SampleExcelPage })),
};
