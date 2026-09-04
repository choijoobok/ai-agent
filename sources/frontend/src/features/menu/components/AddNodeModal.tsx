import { useState } from 'react';
import { Form, Input, Modal, Typography } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 신규 노드 — <b>칸이 하나짜리 모달</b>이다(62 §4.6).
 *
 * <p><b>grid-standard.md §1.1 의 편집 폼이 아니다.</b> 그 절이 없앤 것은 <i>행을 편집하는 폼</i>이고 여기는
 * {@code createNode(upMenuCd, menuCd)} 라는 <b>한 연산의 인자</b>를 받는다 — grid-api-contract.md §8 의 파라미터
 * 모달이며, <b>칸이 하나뿐인 것이 그 증거</b>다. 나머지 여섯은 사람이 정하는 값이 아니다:
 * 부모는 선택 노드, 순서는 형제의 맨 끝, 이름은 {@code menu.{MENU_CD}}, 사용 여부는 켬,
 * URL·아이콘은 <b>만든 뒤 셀에서</b> 채운다.
 *
 * <p><b>중복은 여기서 막지 않는다</b> — 다른 사람이 방금 만든 것을 클라이언트가 알 수 없다.
 * 서버 검증이며(grid-edit-validation.md §3.4) 실패는 이 모달의 칸으로 되돌아온다.
 */
interface Props {
  /** {@code null} 이면 최상위 — 제목이 갈린다. */
  parentName: string | null;
  onSubmit: (menuCd: string) => Promise<boolean>;
  onCancel: () => void;
}

/** 52 §3.1 의 명명 규약 — 대문자·숫자·밑줄. 시드의 26개가 전부 이 모양이다. */
const MENU_CD_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * <b>열려 있을 때만 마운트된다</b> — 화면이 그렇게 부른다.
 *
 * <p>그래서 <i>열 때 칸을 비우는</i> 코드가 없다. 상태를 되돌리는 효과를 두면 <b>닫히는
 * 순간에도 한 번 돌고</b>, 그 사이 렌더가 한 번 더 생긴다 — 매번 새로 만들면 빈 칸이
 * 초기값이라는 사실이 {@code useState('')} 한 줄에 그대로 남는다.
 *
 * <p>중요한 이유가 하나 더 있다: 직전에 만든 코드가 칸에 남아 있으면 <b>그대로 눌러
 * 중복</b>이 나고, 그것은 서버까지 갔다 오는 실패다.
 */
export function AddNodeModal(props: Props) {
  const [menuCd, setMenuCd] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = menuCd.trim().toUpperCase();
  const valid = MENU_CD_PATTERN.test(trimmed);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      if (await props.onSubmit(trimmed)) {
        props.onCancel();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={label(
        props.parentName === null ? MSG.MENU_ADD_TITLE_ROOT : MSG.MENU_ADD_TITLE,
        { parent: props.parentName ?? '' },
      )}
      okText={label(MSG.GRID_CONFIRM_OK)}
      cancelText={label(MSG.COMMON_CANCEL)}
      okButtonProps={{ disabled: !valid, loading: saving }}
      onOk={() => void submit()}
      onCancel={props.onCancel}
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label={label(MSG.MENU_ADD_CODE)} required>
          <Input
            value={menuCd}
            autoFocus
            maxLength={30}
            // 화면이 대문자로 올린다 — 규약이 대문자인데 소문자를 치면 서버가 거절하고,
            // 그 거절은 사람이 고칠 수 있는 것이 아니라 **화면이 도와줄 수 있는 것**이다.
            onChange={(event) => setMenuCd(event.target.value.toUpperCase())}
            onPressEnter={() => void submit()}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label(MSG.MENU_ADD_CODE_HINT)}
          </Typography.Text>
        </Form.Item>
      </Form>
    </Modal>
  );
}
