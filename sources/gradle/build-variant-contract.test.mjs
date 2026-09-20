// @feat FEAT-503
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

function run(name, args, dryRun = true) {
  const gradleArgs = [...args, ...(dryRun ? ['--dry-run'] : ['--rerun-tasks']), '--console=plain'];
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : wrapper;
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', wrapper, ...gradleArgs]
    : gradleArgs;
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
  });
  return {
    name,
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function expectLocalChangelog(result, expected) {
  expectSuccess(result);
  const config = readFileSync(
    resolve(root, 'backend/bootstrap/build/resources/main/application-local.yml'),
    'utf8',
  );
  if (!config.includes(`db/changelog/${expected}`)) {
    throw new Error(`${result.name}: application-local.yml이 ${expected}를 가리켜야 한다.`);
  }
}

function expectSuccess(result) {
  if (result.status !== 0) {
    throw new Error(`${result.name}: 성공해야 한다.\n${result.output}`);
  }
}

function expectFailure(result) {
  if (result.status === 0) {
    throw new Error(`${result.name}: 프로파일 누락을 거부해야 한다.\n${result.output}`);
  }
}

function expectTask(result, task, present) {
  const found = result.output.includes(task);
  if (found !== present) {
    throw new Error(`${result.name}: ${task} ${present ? '포함' : '제외'}가 필요하다.\n${result.output}`);
  }
}

function expectText(result, text, present) {
  const found = result.output.includes(text);
  if (found !== present) {
    throw new Error(`${result.name}: ${text} ${present ? '포함' : '제외'}가 필요하다.\n${result.output}`);
  }
}

const local = run('local 기본값', [':backend:bootstrap:bootRun', '-Pprofile=local']);
expectSuccess(local);
expectTask(local, ':backend:modules:sample:compileJava', true);
expectTask(local, ':backend:bootstrap:npmBuild', false);

const localOverride = run('local 명시 옵션', [
  ':backend:bootstrap:bootRun',
  '-Pprofile=local',
  '-PincludeSample=false',
  '-PskipFrontend=false',
]);
expectSuccess(localOverride);
expectTask(localOverride, ':backend:modules:sample:compileJava', false);
expectTask(localOverride, ':backend:bootstrap:npmBuild', true);

const dev = run('dev 기본값', [':backend:bootstrap:bootRun', '-Pprofile=dev']);
expectSuccess(dev);
expectTask(dev, ':backend:modules:sample:compileJava', false);
expectTask(dev, ':backend:bootstrap:npmBuild', true);

const override = run('dev 명시 옵션', [
  ':backend:bootstrap:bootRun',
  '-Pprofile=dev',
  '-PincludeSample=true',
  '-PskipFrontend=true',
]);
expectSuccess(override);
expectTask(override, ':backend:modules:sample:compileJava', true);
expectTask(override, ':backend:bootstrap:npmBuild', false);

const productJar = run('제품 JAR 기본값', [':backend:bootstrap:bootJar']);
expectSuccess(productJar);
expectTask(productJar, ':backend:modules:sample:compileJava', false);
expectTask(productJar, ':backend:bootstrap:npmBuild', true);

const hubPortability = run('Hub 이식성 태스크 부재', [
  ':backend:bootstrap:portabilityTest',
  '-Pdeployment=hub',
]);
expectFailure(hubPortability);

const templatePortability = run('독립 템플릿 이식성 태스크', [
  ':backend:bootstrap:portabilityTest',
  '-Pdeployment=template',
]);
expectSuccess(templatePortability);
expectTask(templatePortability, ':backend:bootstrap:portabilityTest', true);

const hubRuntime = run('기본 Hub 런타임 드라이버', [
  ':backend:bootstrap:dependencies',
  '--configuration',
  'runtimeClasspath',
  '-PskipFrontend=true',
], false);
expectSuccess(hubRuntime);
expectText(hubRuntime, 'org.postgresql:postgresql', true);
expectText(hubRuntime, 'com.oracle.database.jdbc:ojdbc11', false);
expectText(hubRuntime, 'com.mysql:mysql-connector-j', false);
expectText(hubRuntime, 'org.mariadb.jdbc:mariadb-java-client', false);
expectText(hubRuntime, 'com.microsoft.sqlserver:mssql-jdbc', false);

const templateRuntime = run('독립 템플릿 런타임 드라이버', [
  ':backend:bootstrap:dependencies',
  '--configuration',
  'runtimeClasspath',
  '-Pdeployment=template',
  '-PskipFrontend=true',
], false);
expectSuccess(templateRuntime);
for (const driver of [
  'org.postgresql:postgresql',
  'com.oracle.database.jdbc:ojdbc11',
  'com.mysql:mysql-connector-j',
  'org.mariadb.jdbc:mariadb-java-client',
  'com.microsoft.sqlserver:mssql-jdbc',
]) {
  expectText(templateRuntime, driver, true);
}

expectFailure(run('bootRun 프로파일 누락', [':backend:bootstrap:bootRun']));
expectFailure(run('축약 bootRun 프로파일 누락', [':backend:bootstrap:bootR']));
expectFailure(run('알 수 없는 배포 변형', [
  ':backend:bootstrap:bootJar',
  '-Pdeployment=unknown',
]));

expectLocalChangelog(
  run('local sample 제외 changelog', [
    ':backend:bootstrap:processResources',
    '-Pprofile=local',
    '-PincludeSample=false',
    '-PskipFrontend=true',
  ], false),
  'db.changelog-master.yaml',
);
expectLocalChangelog(
  run('local sample 포함 changelog', [
    ':backend:bootstrap:processResources',
    '-Pprofile=local',
    '-PincludeSample=true',
    '-PskipFrontend=true',
  ], false),
  'db.changelog-local.yaml',
);

console.log('TC-5036 Gradle 빌드 변형 계약 통과 — 프로파일·배포 경계·드라이버·changelog 조합');
