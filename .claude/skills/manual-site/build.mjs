/**
 * 이전 /manual-site 진입점을 유지한다.
 * 사용자 매뉴얼 HTML은 공통 제출 사이트 빌더가 한 번만 생성한다.
 */
const args = process.argv.slice(2);
if (!args.some((arg) => ['all', 'design', 'user', 'operations'].includes(arg))) {
  process.argv.splice(2, 0, 'user');
}
await import('../deliverable-site/build.mjs');
