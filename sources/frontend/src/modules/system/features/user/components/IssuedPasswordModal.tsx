// @feat FEAT-501
import { Alert, Modal, Table, Typography } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { IssuedPassword } from '@/modules/system/features/user/types';

/**
 * 발급된 임시 비밀번호를 보여주는 창 — screen/admin/system/user/requirements.md · AUTH-07.
 *
 * <h2>왜 값을 화면에 내는가</h2>
 *
 * screen/admin/system/user/requirements.md 이 *"메일 발송이 없는 배포에서 화면에 표시할지"* 를 미결로 남겼고 **표시하는
 * 쪽으로 닫았다**(2026-08-30). sys/code.md 이 `admin-reset-enabled` 의 기본값을 켜 두며 적은
 * 근거가 *"메일 연동이 없는 배포에서 잠긴 계정을 푸는 **유일한 경로**"* 인데, **전달 수단이
 * 없으면 그 경로는 있으나 마나**다 — 발급하고 알려 주지 않는 것은 계정을 잠그는 것과 같다.
 *
 * <p>*"관리자가 아는 비밀번호가 생긴다"* 는 우려(screen/admin/system/user/requirements.md)는 **사실이며 받아들인다.** 대신
 * 값의 수명을 묶는다 — `PWD_INIT_YN='Y'` 라 다음 로그인이 곧바로 강제 변경으로 가고
 * (backend/security.md 체인 #5), `tempValidHours` 가 지나면 로그인 자체가 막힌다. **아는 즉시 쓸모없어지는
 * 값**이라는 것이 방어다.
 *
 * <p>알림(NOTI)이 서면 뒤집는다 — 그때는 메일이 전달을 맡으므로 이 창이 값을 볼 이유가 없다.
 *
 * <h2>닫으면 다시 볼 수 없다고 말한다</h2>
 *
 * 값이 응답에만 있기 때문이다. 말하지 않으면 관리자가 창을 닫고 나서 재발급을 누르는데,
 * 그러면 **방금 전한 값이 그 자리에서 무효가 된다** — 그리고 사용자는 로그인에 실패한다.
 *
 * <h2>복사 버튼을 두지 않는다</h2>
 *
 * 여러 건일 수 있고(frontend/grid.md 의 일괄 저장) 그때 *무엇을* 복사할지가 애매하다 — 값 하나인가,
 * 표 전체인가. 셀을 끌어 고르면 브라우저가 이미 복사를 한다. **엑셀도 두지 않는다**:
 * 비밀번호가 파일로 떨어지면 그 파일이 값의 수명을 넘겨 살아남는다.
 */
interface Props {
  /** 비어 있으면 창이 뜨지 않는다 — 수정만 한 저장이 그 경우다. */
  issued: IssuedPassword[];
  onClose: () => void;
}

export function IssuedPasswordModal(props: Props) {
  return (
    <Modal
      open={props.issued.length > 0}
      title={label(MSG.USER_ISSUED_TITLE)}
      onCancel={props.onClose}
      onOk={props.onClose}
      okText={label(MSG.GRID_CONFIRM_OK)}
      // 취소가 없다 — 닫는 것 말고 할 일이 없고, 둘을 두면 <i>취소하면 발급이 취소되나</i> 가 된다.
      cancelButtonProps={{ style: { display: 'none' } }}
      width={640}
      // 바깥을 눌러 닫히면 <b>값을 보기 전에</b> 사라진다 — 되돌릴 방법이 없는 창이다.
      maskClosable={false}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={label(MSG.USER_ISSUED_DESC)}
        description={label(MSG.USER_ISSUED_EXPIRY)}
      />
      <Table<IssuedPassword>
        size="small"
        rowKey="userId"
        pagination={false}
        dataSource={props.issued}
        columns={[
          { title: label(MSG.USER_COL_USER_ID), dataIndex: 'userId', width: 160 },
          { title: label(MSG.USER_COL_USER_NM), dataIndex: 'userNm', width: 140 },
          {
            title: label(MSG.USER_ACTION_RESET_PWD),
            dataIndex: 'password',
            /*
              <b>고정폭 글꼴이다.</b> 사람이 옮겨 적는 값이라 `l`·`1`·`I` 가 붙어 보이면
              안 된다 — 서버가 헷갈리는 글자를 빼고 만들지만({@code TemporaryPasswords})
              그것만으로는 `rn` 과 `m` 이 남는다.

              `copyable` 을 켠 것이 위 주석의 *복사 버튼을 두지 않는다* 와 어긋나지 않는다:
              저것은 <b>창 전체를 한 번에</b> 복사하는 버튼이고 이것은 <b>칸 하나</b>다.
            */
            render: (value: string) => (
              <Typography.Text copyable code style={{ fontSize: 14 }}>
                {value}
              </Typography.Text>
            ),
          },
        ]}
      />
    </Modal>
  );
}
