import { useBreadcrumbSlotContent } from '@/layouts/ShellLayout/breadcrumbSlotStore';

/**
 * 셸이 그리는 자리 — frontend/tabs.md. 등록이 없으면 빈 자리다.
 *
 * <p>훅과 파일을 가른 것은 <b>빠른 새로고침</b> 때문이다: 한 파일이 컴포넌트와 그 밖의 것을
 * 함께 내보내면 편집할 때마다 모듈 전체가 다시 평가되어 <b>상태가 날아간다.</b>
 */
export function BreadcrumbSlot() {
  return <>{useBreadcrumbSlotContent() ?? null}</>;
}
