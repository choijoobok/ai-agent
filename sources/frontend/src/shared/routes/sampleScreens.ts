import type { ComponentType, LazyExoticComponent } from 'react';

/** 제품 변형에는 sample 화면을 아예 넣지 않는다(ADR-009). */
export const SAMPLE_SCREENS: Record<string, LazyExoticComponent<ComponentType>> = {};
