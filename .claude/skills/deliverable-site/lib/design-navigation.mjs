/** 문서 분류는 제출 구성, 기능 소유권은 spec, 개별 문서의 소속은 메타데이터에서 읽는다. */
export function createDesignNavigation(config, features, parseYaml) {
  if (!config?.title || !Array.isArray(config.sections) || !config.sections.length) {
    throw new Error('설계 문서 목차 구성(navigation.title·sections)이 없다.');
  }
  const sections = new Map();
  for (const section of config.sections) {
    if (!section.key || sections.has(section.key) || !Array.isArray(section.path) || !section.path.length
      || section.path.some((label) => typeof label !== 'string' || !label.trim())
      || !Array.isArray(section.source_prefixes)
      || section.source_prefixes.some((prefix) => typeof prefix !== 'string' || !prefix.trim())) {
      throw new Error(`설계 문서 분류가 잘못됐거나 중복됐다: ${section.key ?? '(없음)'}`);
    }
    sections.set(section.key, section);
  }
  return (path, markdown) => {
    const raw = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const meta = raw ? parseYaml(raw) : {};
    let section;
    if (meta.delivery?.section) section = sections.get(meta.delivery.section);
    else {
      const matches = config.sections.flatMap((item) => item.source_prefixes
        .filter((prefix) => path.startsWith(prefix)).map((prefix) => ({ item, length: prefix.length })))
        .sort((a, b) => b.length - a.length);
      if (matches[1]?.length === matches[0]?.length && matches[1]?.item !== matches[0]?.item) {
        throw new Error(`설계 문서 분류가 중복된다: ${path}`);
      }
      section = matches[0]?.item;
    }
    if (!section) throw new Error(`설계 문서 분류가 없다: ${path} — delivery.section 또는 navigation.sections를 지정한다.`);
    const feature = features.get(meta.id);
    if (section.owner === 'feature' && !feature) throw new Error(`기능 명세의 정본 기능을 찾을 수 없다: ${path} (${meta.id ?? 'ID 없음'})`);
    if (feature && meta.module && feature.module !== meta.module) throw new Error(`기능 명세와 정본의 모듈이 다르다: ${path}`);
    const module = feature?.module ?? meta.module;
    if (module != null && (typeof module !== 'string' || !module.trim())) throw new Error(`문서의 module은 비어 있지 않은 단일 문자열이어야 한다: ${path}`);
    if (section.owner === 'feature' && !module) throw new Error(`기능의 소유 모듈이 없다: ${meta.id}`);
    const treePath = [config.title, ...section.path];
    if (section.group_by_module) treePath.push(module ? config.module_labels?.[module] ?? module : config.integrated_label);
    if (treePath.some((label) => typeof label !== 'string' || !label.trim())) throw new Error(`문서 목차의 표시명이 비었다: ${path}`);
    return { treePath, section: section.key, module: module ?? null, order: config.sections.indexOf(section) };
  };
}
