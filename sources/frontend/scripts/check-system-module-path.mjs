import { existsSync, readFileSync } from 'node:fs';

/**
 * FEAT-503 — 메뉴·API 카탈로그는 system 모듈 안에만 둔다(ARCH-022·ARCH-026).
 *
 * <p>타입 검사는 import가 살아 있는지만 확인한다. 이전 `features/` 폴더를 함께 남기면
 * 새 화면이 어느 쪽을 고칠지 갈리고, 별칭과 같은 이중 경로가 된다. 경로·라우터·메뉴 선언을
 * 한 번에 확인해 정식 화면 주소와 소스 소유권이 함께 움직이게 한다.
 */

const required = [
  'src/modules/system/features/menu/pages/MenuTreePage.tsx',
  'src/modules/system/features/menu/api/endpoints.ts',
  'src/modules/system/features/apicatalog/pages/ApiCatalogPage.tsx',
  'src/modules/system/features/apicatalog/api/endpoints.ts',
  'src/modules/system/features/user/pages/UserMgmtPage.tsx',
  'src/modules/system/features/user/api/endpoints.ts',
  'src/modules/system/features/userauth/pages/UserAuthMgmtPage.tsx',
  'src/modules/system/features/userauth/api/endpoints.ts',
  'src/modules/system/features/code/pages/CodeMgmtPage.tsx',
  'src/modules/system/features/code/api/endpoints.ts',
  'src/modules/system/features/message/pages/MessageMgmtPage.tsx',
  'src/modules/system/features/message/api/endpoints.ts',
  '../backend/bootstrap/src/main/resources/menu/menu-tree.yaml',
];

const legacy = [
  'src/features/menu/pages/MenuTreePage.tsx',
  'src/features/apicatalog/pages/ApiCatalogPage.tsx',
  'src/features/user/pages/UserMgmtPage.tsx',
  'src/features/userauth/pages/UserAuthMgmtPage.tsx',
  'src/features/code/pages/CodeMgmtPage.tsx',
  'src/features/message/pages/MessageMgmtPage.tsx',
];
const errors = [];

for (const path of required) {
  if (!existsSync(path)) errors.push(`필수 system 경로가 없다: ${path}`);
}
for (const path of legacy) {
  if (existsSync(path)) errors.push(`구 features 경로가 남아 있다: ${path}`);
}

const registry = readFileSync('src/shared/routes/screenRegistry.ts', 'utf8');
for (const [route, source] of [
  ['/admin/system/menu', '@/modules/system/features/menu/pages/MenuTreePage'],
  ['/admin/system/api-catalog', '@/modules/system/features/apicatalog/pages/ApiCatalogPage'],
  ['/admin/system/user', '@/modules/system/features/user/pages/UserMgmtPage'],
  ['/admin/system/user-auth', '@/modules/system/features/userauth/pages/UserAuthMgmtPage'],
  ['/admin/system/code', '@/modules/system/features/code/pages/CodeMgmtPage'],
  ['/admin/system/message', '@/modules/system/features/message/pages/MessageMgmtPage'],
]) {
  if (!registry.includes(route) || !registry.includes(source)) {
    errors.push(`화면 레지스트리가 ${route} → ${source}를 선언하지 않는다`);
  }
}

const menuSeed = readFileSync('../backend/bootstrap/src/main/resources/menu/menu-tree.yaml', 'utf8');
for (const route of ['/admin/system/menu', '/admin/system/api-catalog', '/admin/system/user', '/admin/system/user-auth', '/admin/system/code', '/admin/system/message']) {
  if (!menuSeed.includes(`url: ${route}`)) errors.push(`메뉴 선언에 ${route}가 없다`);
}

if (errors.length > 0) {
  process.stdout.write(`system 모듈 경로 위반: ${errors.length} 건\n`);
  for (const error of errors) process.stdout.write(`  - ${error}\n`);
  process.exit(1);
}

process.stdout.write('system 모듈 경로 — 메뉴·API 카탈로그의 단일 정식 경로를 확인했다\n');
