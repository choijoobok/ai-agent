// @feat FEAT-506
import { useState } from 'react';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  ColorPicker,
  Divider,
  Modal,
  Segmented,
  Select,
  Space,
  Switch,
  theme,
  Typography,
} from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { rememberLang, type Lang } from '@/shared/i18n/lang';
import { codeLabel, LANG_CD } from '@/shared/i18n/codeLabel';
import {
  useUiStore,
  BG_DENSITY_MAX,
  BG_DENSITY_MIN,
  type ColorTone,
  type FontWeight,
  type SettingsGroup,
  type ThemeMode,
} from '@/shared/stores/uiStore';
import { WEB_SAFE_FONTS } from '@/shared/theme/themeTokens';
import { useResolvedDark } from '@/shared/theme/useResolvedDark';
import { saveLocale } from '@/modules/system/public/settings/api/settingsApi';

/**
 * 설정 모달 — frontend/tabs.md.
 *
 * <p><b>저장 버튼이 없다</b>. 설정을 바꾸면 화면이 바로 바뀌며 미리보기 영역을 따로
 * 만들지 않는다 — <b>셸 전체가 미리보기</b>이고, 글자 크기나 행 높이는 실제 화면에서 봐야
 * 판단할 수 있다.
 *
 * <p><b>예외는 언어 하나다.</b> 리렌더로 갈아치울 수 없는 것들이 있어 재로드한다
 * — 번들 자체 · 코드 라벨 · <b>이미 떠 있는 서버 에러 문구</b> · 탭에 보존된
 * 조회 결과.
 *
 * <p><b>그룹별 초기화와 전체 초기화를 둔다</b>. 항목이 열 개를 넘으면 <i>"뭘 건드려서
 * 이렇게 됐는지 모르겠다"</i> 가 반드시 생기고, 되돌릴 경로가 없으면 사용자는 설정을 피한다.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** 미저장 변경이 있는가 — 언어 변경은 <b>모든 탭을 한꺼번에 닫는 것</b>이라 확인이 필요하다. */
  hasUnsaved: boolean;
}

export function SettingsModal({ open, onClose, hasUnsaved }: Props) {
  const { modal, message } = App.useApp();
  const langs = useMessageStore((state) => state.langs);
  const lang = useMessageStore((state) => state.lang);
  const ui = useUiStore();
  const dark = useResolvedDark();

  const changeLanguage = async (next: string) => {
    if (next === lang) return;

    if (hasUnsaved) {
      const agreed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: label(MSG.SETTINGS_LANGUAGE_CONFIRM_TITLE),
          content: label(MSG.SETTINGS_LANGUAGE_CONFIRM_BODY),
          okText: label(MSG.GRID_CONFIRM_OK),
          cancelText: label(MSG.COMMON_CANCEL),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!agreed) return;
    }

    try {
      // 서버가 먼저다 — 실패하면 여기서 멈추고 localStorage 를 건드리지 않는다.
      // 둘이 갈리면 다음 로그인의 1순위가 어긋난다(의 ②).
      await saveLocale(next);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      return;
    }
    rememberLang(next as Lang);
    // 재로드가 탭 비우기를 함께 한다 — frontend/packages.md 이 새로고침에 탭을 복원하지 않기로 했다.
    window.location.reload();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={label(MSG.SETTINGS_TITLE)}
      // 저장 버튼을 두지 않는다 — 닫기 하나다.
      footer={
        <Button onClick={ui.resetAll}>
          {label(MSG.SETTINGS_RESET_ALL)}
        </Button>
      }
      width={520}
    >
      <Group group="general" title={MSG.SETTINGS_GROUP_GENERAL}>
        <Row title={MSG.SETTINGS_LANGUAGE}>
          <Select
            style={{ width: 160 }}
            value={lang}
            onChange={(next: string) => void changeLanguage(next)}
            // 코드가 아니라 이름이다 — 명칭의 단일 원본은 SYS_MESSAGE 다(sys/code.md).
            // `title: ''` — 판은 고른 항목의 글자를 그대로 브라우저 툴팁으로 단다.
            // 보이는 글자를 한 번 더 띄우는 것이고, 모양도 셸의 툴팁과 다르다(frontend/grid.md).
            options={langs.map((code) => ({
              value: code,
              title: '',
              label: codeLabel(LANG_CD, code),
            }))}
          />
        </Row>
        <Row title={MSG.SETTINGS_HEADER_AUTOHIDE}>
          <SettingSwitch checked={ui.headerAutoHide} onChange={ui.setHeaderAutoHide} />
        </Row>
        {/* 접기가 아니라 자동 숨기기다 — 접기는 헤더 왼쪽 버튼이 이미 하고 있어, 설정에
            같은 것을 한 번 더 두면 조작점만 둘이 된다(frontend/tabs.md). */}
        <Row title={MSG.SETTINGS_SIDER_AUTOHIDE}>
          <SettingSwitch checked={ui.siderAutoHide} onChange={ui.setSiderAutoHide} />
        </Row>
      </Group>

      <Group group="theme" title={MSG.SETTINGS_GROUP_THEME}>
        <Row title={MSG.SETTINGS_THEME_MODE}>
          <Segmented<ThemeMode>
            value={ui.themeMode}
            onChange={ui.setThemeMode}
            /*
              `title: ''` 는 <b>브라우저 기본 툴팁을 끄는 것</b>이다(2026-08-30 실물).
              판은 세그먼트의 글자를 그대로 `title` 에 넣어 두는데(글자가 잘릴 때를 위한
              것이다), 여기는 잘릴 일이 없어 <b>보이는 글자를 그대로 한 번 더</b> 띄운다 —
              게다가 그것은 antd 툴팁이 아니라 <b>OS 의 노란 상자</b>라 셸의 다른 툴팁과
              모양이 다르다.
            */
            options={[
              { value: 'light', label: label(MSG.SHELL_THEME_LIGHT), title: '' },
              { value: 'dark', label: label(MSG.SHELL_THEME_DARK), title: '' },
              { value: 'system', label: label(MSG.SHELL_THEME_SYSTEM), title: '' },
            ]}
          />
        </Row>
        <Row title={MSG.SETTINGS_COLOR_TONE}>
          <Segmented<ColorTone>
            value={ui.colorTone}
            onChange={ui.setColorTone}
            options={[
              { value: 'neutral', label: label(MSG.SETTINGS_TONE_NEUTRAL), title: '' },
              { value: 'warm', label: label(MSG.SETTINGS_TONE_WARM), title: '' },
              { value: 'cold', label: label(MSG.SETTINGS_TONE_COLD), title: '' },
              { value: 'green', label: label(MSG.SETTINGS_TONE_GREEN), title: '' },
            ]}
          />
        </Row>
        {/*
          모드의 네 번째 칸이 아니라 <b>다른 축</b>이다 — 그래야 "시스템 따름 + 회색" 이
          성립한다(frontend/tabs.md).

          <b>라벨이 모드를 따라간다.</b> 라이트에서는 흰색의 농도이고 다크에서는 검은색의
          농도라, 한 이름으로 부르면 절반은 거짓말이 된다 — 값과 눈금은 하나이고
          <b>무엇의 농도인가</b>만 갈린다.
        */}
        <Row
          title={dark ? MSG.SETTINGS_BLACK_DENSITY : MSG.SETTINGS_WHITE_DENSITY}
          range={range(BG_DENSITY_MIN, BG_DENSITY_MAX, '%')}
        >
          <NumberField
            value={ui.bgDensity}
            min={BG_DENSITY_MIN}
            max={BG_DENSITY_MAX}
            onChange={ui.setBgDensity}
          />
        </Row>
        <Row title={MSG.SETTINGS_PRIMARY_COLOR}>
          <PrimaryColorField />
        </Row>
        <Row title={MSG.SETTINGS_COMPACT}>
          <SettingSwitch checked={ui.compact} onChange={ui.setCompact} />
        </Row>
      </Group>

      <Group group="font" title={MSG.SETTINGS_GROUP_FONT}>
        <Row title={MSG.SETTINGS_FONT_FAMILY}>
          <FontFamilyField />
        </Row>
        <Row title={MSG.SETTINGS_FONT_SIZE} range={range(12, 18, 'px')}>
          <NumberField value={ui.fontSize} min={12} max={18} onChange={ui.setFontSize} />
        </Row>
        {/* 크기와 다른 축이다 — 굵기는 <b>자리를 그대로 두고</b> 또렷해진다(frontend/tabs.md). */}
        <Row title={MSG.SETTINGS_FONT_WEIGHT}>
          <Segmented<FontWeight>
            value={ui.fontWeight}
            onChange={ui.setFontWeight}
            options={[
              { value: 'light', label: label(MSG.SETTINGS_FONT_WEIGHT_LIGHT), title: '' },
              { value: 'normal', label: label(MSG.SETTINGS_FONT_WEIGHT_NORMAL), title: '' },
              { value: 'bold', label: label(MSG.SETTINGS_FONT_WEIGHT_BOLD), title: '' },
            ]}
          />
        </Row>
      </Group>

      <Group group="grid" title={MSG.SETTINGS_GROUP_GRID}>
        <Row title={MSG.SETTINGS_GRID_HEADER_HEIGHT} range={range(28, 56, 'px')}>
          <NumberField value={ui.gridHeaderHeight} min={28} max={56} onChange={ui.setGridHeaderHeight} />
        </Row>
        <Row title={MSG.SETTINGS_GRID_ROW_HEIGHT} range={range(24, 52, 'px')}>
          <NumberField value={ui.gridRowHeight} min={24} max={52} onChange={ui.setGridRowHeight} />
        </Row>
        <Row title={MSG.SETTINGS_GRID_FONT_SIZE} range={range(11, 18, 'px')}>
          <NumberField value={ui.gridFontSize} min={11} max={18} onChange={ui.setGridFontSize} />
        </Row>
      </Group>
    </Modal>
  );
}

// ── 레이아웃 조각 ─────────────────────────────────────────────────

function Group(props: { group: SettingsGroup; title: string; children: React.ReactNode }) {
  const resetGroup = useUiStore((state) => state.resetGroup);

  return (
    <section>
      {/* antd 6 에서 `orientation` 은 가로·세로 축이고 글자 정렬은 `titlePlacement` 다. */}
      <Divider titlePlacement="start" style={{ margin: '12px 0 8px' }}>
        <Space size={8}>
          <Typography.Text strong>{label(props.title)}</Typography.Text>
          <Button type="link" onClick={() => resetGroup(props.group)}>
            {label(MSG.SETTINGS_RESET_GROUP)}
          </Button>
        </Space>
      </Divider>
      {props.children}
    </section>
  );
}

function Row(props: { title: string; range?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 0',
      }}
    >
      <Typography.Text type="secondary">
        {label(props.title)}
        {/* 범위는 <b>라벨의 것</b>이다 — 값 옆에 두면 지금 값과 한계가 같은 자리에서
            섞여 읽힌다(2026-08-30). 단위도 여기서만 말한다. */}
        {props.range !== undefined && ` ${props.range}`}
      </Typography.Text>
      {props.children}
    </div>
  );
}

/** `(12~18px)` — 라벨 뒤에 붙는 범위. 단위는 `%` · `px` 처럼 번역이 필요 없는 것만 쓴다. */
function range(min: number, max: number, unit: string): string {
  return `(${min}~${max}${unit})`;
}

/**
 * <b>기본 너비의 두 배로 둔다.</b> 판의 작은 스위치는 28px 이라 켠 쪽과 끈 쪽의 차이가
 * 손잡이 하나 폭이고, 설정 창처럼 <b>여러 개가 세로로 늘어선 자리</b>에서는 지금 무엇이
 * 켜져 있는지 훑어보기 어렵다.
 *
 * <p><b>기본 크기다</b>(2026-08-30) — 모달 안의 컨트롤이 전부 조회조건 칸과 같은 크기여야
 * 한 화면에 두 크기가 섞이지 않는다. 폭만 넓힌 것은 그리드 셀의 스위치와 같은 이유로,
 * 켜짐·꺼짐이 갈리는 것이 <b>손잡이가 어느 쪽 끝에 있는가</b>이기 때문이다.
 */
const SETTING_SWITCH_WIDTH = 72;

function SettingSwitch(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Switch style={{ minWidth: SETTING_SWITCH_WIDTH }} checked={props.checked} onChange={props.onChange} />
  );
}

/**
 * 슬라이더 양옆에 <b>한 칸씩 옮기는 버튼</b>을 둔다 — frontend/tabs.md.
 *
 * <p>범위가 좁아서(글자 크기는 12~18) <b>슬라이더만으로는 한 칸을 정확히 집기 어렵다</b>.
 * 끌다 보면 원하는 값을 지나치고, 되돌리려다 또 지나친다.
 *
 * <p><b>끝에서는 비활성이다.</b> 눌리는데 아무 일도 없으면 고장으로 읽힌다.
 */
function NumberField(props: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  // 범위를 벗어난 값을 만들지 않는다 — 상한을 넘긴 글자 크기는 되돌릴 방법이 슬라이더뿐이다.
  const step = (by: number) => props.onChange(Math.min(props.max, Math.max(props.min, props.value + by)));

  return (
    <Space size={4}>
      <Button
        icon={<MinusOutlined />}
        disabled={props.disabled === true || props.value <= props.min}
        onClick={() => step(-1)}
        aria-label={label(MSG.SETTINGS_STEP_DOWN)}
      />
      <Gauge value={props.value} min={props.min} max={props.max} disabled={props.disabled} />
      <Button
        icon={<PlusOutlined />}
        disabled={props.disabled === true || props.value >= props.max}
        onClick={() => step(1)}
        aria-label={label(MSG.SETTINGS_STEP_UP)}
      />
    </Space>
  );
}

const GAUGE_WIDTH = 110;

/**
 * 값이 <b>손잡이 안에</b> 있는 눈금 — frontend/tabs.md.
 *
 * <p>판의 슬라이더가 아니다. 끌 수 없게 만든 순간 남은 일은 <b>읽는 것</b>뿐인데, 판의
 * 손잡이는 동그라미라 <i>지금 값이 얼마인지</i> 를 말하지 못한다 — 자리만 말한다
 * (2026-08-30 실물). 숫자를 옆에 따로 두면 <b>같은 것을 두 곳에서</b> 보게 되므로 자리와
 * 숫자를 한 몸으로 둔다.
 *
 * <p><b>끝에서 튀어나가지 않는다.</b> 가로 이동을 자기 폭의 비율만큼 되돌리므로(`-{p}%`)
 * 최솟값에서는 왼쪽 끝에, 최댓값에서는 오른쪽 끝에 붙는다 — 가운데 정렬로 두면 양 끝에서
 * 칸 밖으로 나간다.
 */
function Gauge(props: { value: number; min: number; max: number; disabled?: boolean }) {
  const { token } = theme.useToken();
  const percent = ((props.value - props.min) / (props.max - props.min)) * 100;
  const dim = props.disabled === true;

  return (
    <div style={{ position: 'relative', width: GAUGE_WIDTH, height: token.controlHeightSM }}>
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: '50%',
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: token.colorFillSecondary,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: '50%',
          width: `${percent}%`,
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: dim ? token.colorFill : token.colorPrimaryBorder,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInlineStart: `${percent}%`,
          transform: `translateX(-${percent}%)`,
          height: token.controlHeightSM,
          lineHeight: `${token.controlHeightSM - 2}px`,
          padding: '0 6px',
          borderRadius: token.borderRadiusSM,
          border: `1px solid ${dim ? token.colorBorder : token.colorPrimary}`,
          background: dim ? token.colorBgContainerDisabled : token.colorBgContainer,
          color: dim ? token.colorTextDisabled : token.colorText,
          fontSize: token.fontSizeSM,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

/**
 * <b>프리셋을 기본 경로로 둔다</b> — frontend/tabs.md. 커스텀은 열되 대비가 모자라면 경고하고
 * <b>막지는 않는다</b>: 조직 CI 색을 써야 하는 경우가 있다(01 P9).
 */
function PrimaryColorField() {
  const primaryColor = useUiStore((state) => state.primaryColor);
  const setPrimaryColor = useUiStore((state) => state.setPrimaryColor);
  const dim = primaryColor !== null && !hasEnoughContrast(primaryColor);

  return (
    <Space size={8}>
      {dim && (
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          {label(MSG.SETTINGS_PRIMARY_CONTRAST)}
        </Typography.Text>
      )}
      <ColorPicker
        value={primaryColor}
        presets={[{ label: label(MSG.SETTINGS_PRIMARY_COLOR), colors: PRESET_COLORS }]}
        onChangeComplete={(color) => setPrimaryColor(color.toHexString())}
      />
      <Button type="link" onClick={() => setPrimaryColor(null)}>
        {label(MSG.SETTINGS_PRIMARY_DEFAULT)}
      </Button>
    </Space>
  );
}

/** 대비가 검증된 색들 — AntD 프리셋의 주계열이다. */
const PRESET_COLORS = [
  '#1677ff',
  '#5b8c00',
  '#08979c',
  '#531dab',
  '#c41d7f',
  '#d4380d',
  '#ad6800',
  '#434343',
];

/**
 * 흰 글씨가 읽히는가 — 상대 휘도로 판단한다.
 *
 * <p>정확한 WCAG 대비비를 계산하지 않는 것은 <b>여기서 하는 일이 경고 하나</b>이기
 * 때문이다. 문턱을 넘는지만 알면 되고, 막지 않으므로 오차의 대가가 작다.
 */
function hasEnoughContrast(hex: string): boolean {
  const value = hex.replace('#', '');
  if (value.length < 6) return true;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.6;
}

/**
 * 설치 글꼴 목록은 <b>사용자가 열 때</b> 읽는다 — frontend/tabs.md.
 *
 * <p>모달을 여는 것만으로 권한 프롬프트가 뜨면 <b>대부분의 사용자가 이유를 모른 채
 * 거부한다.</b> 못 읽어도 기능 실패가 아니다 — 웹 세이프 목록으로 떨어진다.
 */
function FontFamilyField() {
  const fontFamily = useUiStore((state) => state.fontFamily);
  const setFontFamily = useUiStore((state) => state.setFontFamily);
  const [fonts, setFonts] = useState<string[]>(WEB_SAFE_FONTS);
  const [local, setLocal] = useState<'idle' | 'loaded' | 'denied'>('idle');

  const loadLocalFonts = async () => {
    const query = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> })
      .queryLocalFonts;
    if (!query) {
      setLocal('denied');
      return;
    }
    try {
      const found = await query();
      setFonts([...new Set(found.map((entry) => entry.family))].sort());
      setLocal('loaded');
    } catch {
      // 권한 거부 · 미지원 — 둘을 가르지 않는다. 사용자가 할 일이 같다.
      setLocal('denied');
    }
  };

  return (
    <Space size={8}>
      {local === 'denied' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label(MSG.SETTINGS_FONT_LOCAL_DENIED)}
        </Typography.Text>
      )}
      {local === 'idle' && (
        <Button type="link" onClick={() => void loadLocalFonts()}>
          {label(MSG.SETTINGS_FONT_LOAD_LOCAL)}
        </Button>
      )}
      {/* `null` 을 옵션 값으로 쓰지 않는다 — 판이 경고를 내고, 검색으로 걸러질 때
          비교 대상이 없어 그 항목만 사라진다. 빈 문자열을 쓰고 경계에서 되돌린다. */}
      <Select
        showSearch
        style={{ width: 180 }}
        value={fontFamily ?? ''}
        onChange={(family: string) => setFontFamily(family === '' ? null : family)}
        options={[
          { value: '', title: '', label: label(MSG.SETTINGS_FONT_DEFAULT) },
          ...fonts.map((family) => ({ value: family, title: '', label: family })),
        ]}
      />
    </Space>
  );
}
