import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 개발은 두 서버를 띄우고 프록시로 잇는다 — llm-guide/06-framework/build-deploy.md §6.
// 그래서 화면 코드의 요청 경로가 개발과 운영에서 같다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 3000,
    proxy: {
      /*
        기본값은 그대로 8080 이다. 환경변수를 여는 것은 <b>한 작업 트리에서 백엔드를 둘
        띄우는 경우</b>가 있기 때문이다 — 같은 저장소를 두 사람(또는 두 세션)이 나눠 들고
        각자 다른 포트로 기동하면, 프록시가 한 곳에 박혀 있어 <b>한쪽 화면이 남의 서버를
        본다</b>. `VITE_API_TARGET=http://localhost:8082 npm run dev` 로 바꾼다.
      */
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // jsdom 에 없는 브라우저 API 를 채운다 — 없으면 컴포넌트 렌더 테스트가 전부 죽는다.
    setupFiles: ['src/test/setup.ts'],
    // 기본 5초는 vitest 의 값이지 우리가 고른 값이 아니었다. antd 모달·드롭다운을 jsdom
    // 에서 여는 테스트는 파일 스물여덟이 함께 도는 동안 실제로 5초를 넘고(2026-08-30),
    // 그때 실패하는 것은 **가장 무거운 테스트가 아니라 그때 밀린 테스트**다 — 붙잡는
    // 결함이 없으면서 사람을 엉뚱한 곳으로 보낸다. 진짜로 매달린 테스트는 15초에서도
    // 걸린다.
    testTimeout: 15000,
  },
  build: {
    // 산출물은 Gradle 이 bootstrap 리소스로 실어 간다(25 §2). 경로를 바꾸면 그쪽도 바뀐다.
    outDir: 'dist',
    sourcemap: false,
  },
});
