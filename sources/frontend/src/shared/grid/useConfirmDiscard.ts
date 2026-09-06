import { useCallback } from 'react';
import { App } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * <b>버리시겠습니까</b> — 미저장 편집이 사라지기 <i>전에</i> 묻고, 답을 돌려준다.
 *
 * <p>편집을 지우는 행위는 두 자리에서 일어난다. <b>그리드 안</b>에서는 재조회 넷이
 * 행을 통째로 갈아 끼우고(조회 · 페이지 이동 · 페이지 사이즈 · 서버 정렬 —
 * frontend/grid.md), <b>화면</b>에서는 마스터 선택이 바뀌면 디테일이 통째로 바뀐다
 * (playbook/master-detail.md). 물음은 같고 부르는 자리가 다를 뿐이다.
 *
 * <h2>왜 화면이 부르나 — 그리드에 맡기지 않는다</h2>
 *
 * <p>마스터-디테일에서 <b>답을 알아야 선택을 받아들일지 정할 수 있다.</b> 그리드가 스스로
 * 묻고 스스로 취소하면 화면은 그 결과를 알 수 없고, <i>보고 있는 것</i>과 <i>고른 것</i>이
 * 갈린 채 저장이 나간다 — 그러면 <b>A 의 품목이 B 로 나간다</b>(UX-10).
 *
 * <h2>미저장인지는 여기서 보지 않는다</h2>
 *
 * <p>{@code dirty} 를 인자로 받지 않는다. <b>무엇이 더러운가는 부르는 쪽만 안다</b> —
 * 그리드는 자기 {@code dirty} 를, 탭 상세는 {@code tabs.current?.dirty()} 를, 판이 둘인
 * 화면은 <i>아래쪽만</i>을 본다. 여기서 판정하려 들면 그 셋을 다 받아야 하고, 그때부터
 * 이 함수는 <b>묻는 일</b>이 아니라 <b>남의 상태를 아는 일</b>을 하게 된다.
 * 그래서 부르는 쪽이 {@code if (detail.dirty && !(await confirmDiscard()))} 로 쓴다.
 *
 * <h2>여섯 벌이던 것이다</h2>
 *
 * <p>2026-09-06 까지 화면 여섯이 이 열세 줄을 <b>글자 하나까지 똑같이</b> 갖고 있었다
 * ({@code useGridController} 안의 것까지 일곱). 레시피가 {@code confirmDiscard()} 를
 * <i>부르는 모습만</i> 보여 주고 <b>어디서 오는지 적지 않아</b>, 다음 화면마다 손으로
 * 다시 썼다. 문구를 하나 고치려면 일곱 곳을 고쳐야 했고, 그중 하나를 빠뜨리면
 * <b>어느 것이 진짜인지 알 방법이 없다</b>(standard/frontend/packages.md §3).
 */
export function useConfirmDiscard(): () => Promise<boolean> {
  const { modal } = App.useApp();

  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        modal.confirm({
          title: label(MSG.GRID_DISCARD_TITLE),
          content: label(MSG.GRID_DISCARD_BODY),
          okText: label(MSG.GRID_CONFIRM_OK),
          cancelText: label(MSG.COMMON_CANCEL),
          /*
            <b>닫기(X)·바깥 클릭도 취소다.</b> AntD 는 그 경로에서도 {@code onCancel} 을
            부르므로 약속이 지켜진다 — 어느 길로 닫든 <b>promise 가 반드시 끝난다</b>.
            끝나지 않으면 {@code await} 한 선택 로직이 영영 멈춘다.
          */
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modal],
  );
}
