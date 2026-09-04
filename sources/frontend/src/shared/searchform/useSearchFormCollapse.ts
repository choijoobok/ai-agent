import { useCallback, useState } from 'react';
import { readStorage, writeStorage } from '@/shared/i18n/lang';
import { useTabIdentity } from '@/layouts/ShellLayout/tabContext';

/**
 * 검색 폼 접기 — main-shell.md §5.1 · UX-15.
 *
 * <p><b>탭마다 상태가 다르다.</b> 접힘은 <b>활성 탭의 화면</b>에 속하며 탭을 옮기면 그 탭의
 * 상태로 돌아온다 — 브레드크럼이 활성 탭의 경로인 것과 같다. 그래서 상태를 이 훅이(=화면
 * 인스턴스가) 들고 있고 전역 스토어에 두지 않는다.
 *
 * <p><b>기억은 메뉴 단위다.</b> 저장처는 `localStorage` 이며(뷰포트에 딸린 판단이라 41 §4.3
 * 의 경계에서 기기 쪽이다) 키는 <b>탭이 아니라 메뉴</b>다 — 탭 키는 그때그때 만들어지고
 * 새로고침에 탭을 복원하지 않으므로(frontend-stack.md §4.1) 탭 단위로 저장하면 <b>다음 접속에 아무것도
 * 되살아나지 않는다.</b>
 *
 * <p><b>접어도 조건은 살아 있다.</b> 접기는 표시일 뿐이며 접힌 채로 조회하면 접기 전 조건으로
 * 나간다 — 그래서 이 훅은 폼을 <b>언마운트하지 않고 감추기만</b> 하라고 알려 준다.
 */
const STORAGE_PREFIX = 'backoffice.searchForm:';

export interface SearchFormCollapse {
  collapsed: boolean;
  toggle: () => void;
}

export function useSearchFormCollapse(): SearchFormCollapse {
  const identity = useTabIdentity();
  const storageKey = STORAGE_PREFIX + (identity?.menuCd ?? '');

  const [collapsed, setCollapsed] = useState(
    () => identity !== null && readStorage(storageKey) === '1',
  );

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeStorage(storageKey, next ? '1' : '0');
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
