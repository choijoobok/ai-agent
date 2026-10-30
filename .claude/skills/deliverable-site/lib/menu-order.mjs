/** 설계 사이트의 admin 목차가 정본 메뉴 순서·영역과 같은지 검사한다. */
export function menuNavigationErrors(spec, html) {
 const expected = (spec.menu_tree?.admin_groups ?? []).flatMap((group) =>
  (group.screens ?? []).map((id) => ({ id: `screen-${id.toLowerCase()}`, group: group.title })));
 const ids = new Set(expected.map((item) => item.id));
 const actual = [...html.matchAll(/<button\b[^>]*data-page-link="([^"]+)"[^>]*>/g)]
  .filter((match) => ids.has(match[1]))
  .map((match) => ({ id: match[1], path: match[0].match(/data-page-path="([^"]*)"/)?.[1] ?? '' }));
 const errors = [];
 if (actual.map((item) => item.id).join('|') !== expected.map((item) => item.id).join('|')) {
  errors.push('design: admin 화면 목차의 순서·누락·중복이 메뉴 정본과 다르다.');
 }
 for (const item of actual) {
  const group = expected.find((entry) => entry.id === item.id).group;
  if (!item.path.split(' › ').includes(group)) errors.push(`design: ${item.id}의 메뉴 영역이 ${group}과 다르다.`);
 }
 return errors;
}
