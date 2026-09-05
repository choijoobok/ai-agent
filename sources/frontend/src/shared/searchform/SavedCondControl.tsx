import { useCallback, useEffect, useRef, useState } from 'react';
import { DeleteOutlined, FolderOpenOutlined, SaveOutlined, StarFilled } from '@ant-design/icons';
import { App, Button, Checkbox, Dropdown, Form, Input, Modal, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import {
  deleteSavedCond,
  getSavedConds,
  saveSavedCond,
} from '@/shared/searchform/api/searchCondApi';
import { parseCondJson, type SavedCond, type SavedCondValues } from '@/shared/searchform/savedCond';

/**
 * 저장된 조회조건 — UX-07 · frontend/search-form.md. 초기화 오른쪽의 설정 버튼이다.
 *
 * <p><b>진입할 때 목록을 읽는다.</b> 열 때 읽으면 값싸 보이지만 <b>기본 조건</b>을
 * 적용할 수 없다 — 그것은 화면에 들어오는 순간 폼을 채우는 것이므로 목록이 그때 있어야
 * 한다. 요청 하나의 값이 그 기능이다.
 *
 * <p><b>실패하면 조용히 빈 목록이 된다.</b> §5.3 이 복원 실패에 정한 것과 같은 태도이며,
 * 여기서는 이유가 하나 더 있다 — <b>화면에 들어올 때마다</b> 뜨는 빨간 토스트는 고칠 수
 * 없는 경고이고, 조회조건 폼 자체는 그것 없이도 제 일을 한다.
 *
 * <p><b>목록이 내용을 함께 갖고 있다.</b> 고를 때 서버를 다시 부르지 않는다 — 조건 하나가
 * 기본값을 뺀 칸만 담아 작기 때문이며, 따로 부르면 목록과 내용이 어긋나는 순간이
 * 생긴다.
 */
interface Props {
  menuCd: string;
  /** 지금 폼에 채워진 값 — 저장할 때 읽는다. */
  read: () => SavedCondValues;
  /** 고른 조건을 폼에 채운다. */
  apply: (values: SavedCondValues) => void;
}

interface SaveFormValues {
  condNm: string;
  dflt: boolean;
}

export function SavedCondControl(props: Props) {
  const { menuCd } = props;
  const { message, modal } = App.useApp();
  const [conds, setConds] = useState<SavedCond[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form] = Form.useForm<SaveFormValues>();
  const typedName = Form.useWatch('condNm', form);

  /**
   * 콜백을 의존성에 두지 않는다 — 화면이 {@code fields} 를 JSX 안에서 만들면 폼의
   * 콜백도 매 렌더 새 함수가 되고, 그러면 아래 효과가 <b>렌더마다 서버를 부른다</b>.
   */
  const apply = useRef(props.apply);
  useEffect(() => {
    // 렌더 중에 ref 를 고치지 않는다(react-hooks/refs). 첫 적용은 응답이 온 뒤라
    // 이 효과가 이미 돌아 있다.
    apply.current = props.apply;
  }, [props.apply]);

  useEffect(() => {
    let alive = true;
    getSavedConds(menuCd)
      .then((list) => {
        if (!alive) return;
        setConds(list);
        const preset = list.find((cond) => cond.dflt);
        if (preset) apply.current(parseCondJson(preset.condJson));
      })
      .catch(() => {
        if (alive) setConds([]);
      });
    return () => {
      alive = false;
    };
  }, [menuCd]);

  const remove = useCallback(
    (condNm: string) => {
      modal.confirm({
        title: label(MSG.SEARCH_COND_DELETE),
        content: label(MSG.SEARCH_COND_DELETE_CONFIRM, { name: condNm }),
        okText: label(MSG.GRID_CONFIRM_OK),
        cancelText: label(MSG.COMMON_CANCEL),
        onOk: async () => {
          try {
            setConds(await deleteSavedCond(menuCd, condNm));
          } catch (error) {
            message.error(error instanceof Error ? error.message : String(error));
          }
        },
      });
    },
    [menuCd, message, modal],
  );

  const persist = async (values: SaveFormValues) => {
    try {
      const saved = await saveSavedCond(
        menuCd,
        values.condNm,
        JSON.stringify(props.read()),
        values.dflt ?? false,
      );
      setConds(saved);
      setSaveOpen(false);
      message.success(label(MSG.SEARCH_COND_SAVED));
    } catch (error) {
      // 상한 초과가 여기로 온다(frontend/search-form.md) — 문구는 서버가 완성해 내려준다(backend/packages.md).
      message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = async () => persist(await form.validateFields());

  const items: MenuProps['items'] = [
    ...(conds.length === 0
      ? [{ key: 'empty', disabled: true, label: label(MSG.SEARCH_COND_EMPTY) }]
      : conds.map((cond) => ({
          key: `cond:${cond.condNm}`,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
              <span style={{ flex: 1 }}>{cond.condNm}</span>
              {cond.dflt && <StarFilled title={label(MSG.SEARCH_COND_DEFAULT_MARK)} />}
              {/* 항목을 고르는 것과 지우는 것이 같은 클릭에 실리면 안 된다. */}
              <DeleteOutlined
                aria-label={label(MSG.SEARCH_COND_DELETE)}
                onClick={(event) => {
                  event.stopPropagation();
                  remove(cond.condNm);
                }}
              />
            </span>
          ),
        }))),
    { type: 'divider' },
    { key: 'save', icon: <SaveOutlined />, label: label(MSG.SEARCH_COND_SAVE) },
  ];

  const choose: MenuProps['onClick'] = (info) => {
    if (info.key === 'save') {
      form.setFieldsValue({ condNm: '', dflt: false });
      setSaveOpen(true);
      return;
    }
    const chosen = conds.find((cond) => `cond:${cond.condNm}` === info.key);
    if (chosen) props.apply(parseCondJson(chosen.condJson));
  };

  const duplicate = conds.some((cond) => cond.condNm === (typedName ?? '').trim());

  return (
    <>
      {/*
        톱니가 아니다 — 톱니는 <b>설정</b>이고 여기는 <b>서랍</b>이다(2026-08-30 실물).
        아이콘만 두면 무엇을 여는 서랍인지 알 수 없어 글자를 함께 낸다: 이 버튼 하나가
        저장과 불러오기 둘을 한다.
      */}
      <Dropdown trigger={['click']} menu={{ items, onClick: choose }}>
        <Button icon={<FolderOpenOutlined />}>{label(MSG.SEARCH_COND_TITLE)}</Button>
      </Dropdown>

      <Modal
        open={saveOpen}
        title={label(MSG.SEARCH_COND_SAVE_TITLE)}
        okText={label(MSG.GRID_CONFIRM_OK)}
        cancelText={label(MSG.COMMON_CANCEL)}
        onOk={() => void submit()}
        onCancel={() => setSaveOpen(false)}
        destroyOnHidden
      >
        {/*
          <b>{@code Enter} 를 폼 밖으로 흘리지 않는다.</b> 이 모달은 조회조건 폼 <i>안</i>
          에 렌더되고 리액트 이벤트는 포털을 건너 트리를 따라 올라간다 — 이름을 치고
          {@code Enter} 를 누르면 <b>저장이 아니라 조회</b>가 돌았다(2026-08-30 실물).
          여기서 멈추고, 대신 폼의 제출로 받아 <b>저장</b>이 되게 한다.
        */}
        <Form
          form={form}
          layout="vertical"
          initialValues={{ condNm: '', dflt: false }}
          onKeyDown={(event) => event.stopPropagation()}
          onFinish={(values) => void persist(values)}
        >
          <Form.Item
            name="condNm"
            label={label(MSG.SEARCH_COND_NAME)}
            rules={[{ required: true, message: label(MSG.SEARCH_COND_NAME_REQUIRED) }]}
          >
            <Input maxLength={100} autoFocus />
          </Form.Item>
          {/* 막지 않고 덮어쓴다 — 이름이 곧 자리다(frontend/search-form.md). 다만 말은 해 준다. */}
          {duplicate && (
            <Typography.Text type="warning">{label(MSG.SEARCH_COND_OVERWRITE)}</Typography.Text>
          )}
          <Form.Item name="dflt" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>{label(MSG.SEARCH_COND_DEFAULT)}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
