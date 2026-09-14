import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../.claude/hooks/lib.mjs';
import { listSpecSetNames, loadSpecSet } from './spec-set.mjs';

export function testSpecSet() {
  const repo = mkdtempSync(join(tmpdir(), 'aihub-spec-set-'));
  const spec = join(repo, 'documents', 'spec');
  mkdirSync(spec, { recursive: true });

  try {
    writeFileSync(join(spec, '10-requirements.yaml'), 'meta:\n  status: legacy\nrequirements:\n  - id: REQ-001\n', 'utf8');
    const legacy = loadSpecSet({ repo, name: '10-requirements', parseYaml });
    assert.equal(legacy.format, 'legacy');
    assert.equal(legacy.document.requirements[0].id, 'REQ-001');

    const duplicate = join(spec, '10-requirements');
    mkdirSync(duplicate);
    writeFileSync(join(duplicate, '_index.yaml'), 'meta: {}\nspec_set:\n  version: 1\n  parts: [010-core.yaml]\n', 'utf8');
    writeFileSync(join(duplicate, '010-core.yaml'), 'requirements: []\n', 'utf8');
    assert.throws(() => loadSpecSet({ repo, name: '10-requirements', parseYaml }), /함께 존재/);
    rmSync(duplicate, { recursive: true });

    const folder = join(spec, '31-features');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, '_index.yaml'), [
      'meta:', '  status: migrated', 'spec_set:', '  version: 1', '  parts:', '    - 010-system.yaml', '    - 020-admin.yaml', '',
    ].join('\n'), 'utf8');
    writeFileSync(join(folder, '010-system.yaml'), 'features:\n  - id: FEAT-001\n', 'utf8');
    writeFileSync(join(folder, '020-admin.yaml'), 'features:\n  - id: FEAT-002\n', 'utf8');
    const split = loadSpecSet({ repo, name: '31-features', parseYaml });
    assert.equal(split.format, 'set');
    assert.deepEqual(split.document.features.map((x) => x.id), ['FEAT-001', 'FEAT-002']);
    assert.deepEqual(listSpecSetNames({ repo }), ['10-requirements', '31-features']);

    writeFileSync(join(folder, '999-unlisted.yaml'), 'features: []\n', 'utf8');
    assert.throws(() => loadSpecSet({ repo, name: '31-features', parseYaml }), /parts에 없는 YAML/);
    rmSync(join(folder, '999-unlisted.yaml'));

    writeFileSync(join(folder, '030-conflict.yaml'), 'owner: admin\n', 'utf8');
    writeFileSync(join(folder, '040-conflict.yaml'), 'owner: system\n', 'utf8');
    writeFileSync(join(folder, '_index.yaml'), [
      'meta:', '  status: migrated', 'spec_set:', '  version: 1', '  parts:', '    - 030-conflict.yaml', '    - 040-conflict.yaml', '',
    ].join('\n'), 'utf8');
    rmSync(join(folder, '010-system.yaml'));
    rmSync(join(folder, '020-admin.yaml'));
    assert.throws(() => loadSpecSet({ repo, name: '31-features', parseYaml }), /같은 값을 둘 이상 정의/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  testSpecSet();
  console.log('spec-set self-test: ok');
}
