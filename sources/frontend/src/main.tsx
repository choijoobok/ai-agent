import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';

const container = document.getElementById('root');
if (!container) // 개발자만 보는 실패다 — 이 시점에는 번들도 없다.
  throw new Error('#root is missing — check index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
