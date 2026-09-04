import { normalizeLang, resolveLang, type Lang } from '@/shared/i18n/lang';

/**
 * 서버 번들이 닿지 않을 때의 문구 — 50 §3.2.
 *
 * <p><b>전체 폴백이 아니다.</b> 정적 파일로 전 문구를 갖고 있으면 DB 번들과 시간이 갈수록
 * 벌어지고, 어긋났을 때 어느 쪽이 맞는지 화면만 봐서는 알 수 없다 — 이 프로젝트가 반복해서
 * 피해 온 실패 모드다. 여기 있는 것은 **번들 로드 자체가 실패했을 때** 보일 몇 개뿐이며,
 * 내용이 고정적이라 벌어질 여지가 없다.
 *
 * <p>그래서 이 키들은 `MSG` 에도 `SYS_MESSAGE` 에도 없다. **서버가 없을 때 쓰는 것**이므로
 * 서버에 두면 뜻이 없다.
 */
const STATIC: Record<Lang, Record<string, string>> = {
  ko: {
    'boot.failed.title': '문구를 불러오지 못했습니다',
    'boot.failed.desc': '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
    'boot.retry': '다시 시도',
    'net.unreachable': '서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.',
    'net.unknown': '알 수 없는 오류가 발생했습니다.',
    'net.failed': '처리 중 오류가 발생했습니다.',
  },
  en: {
    'boot.failed.title': 'Could not load messages',
    'boot.failed.desc': 'The server is unreachable. Please try again in a moment.',
    'boot.retry': 'Retry',
    'net.unreachable': 'Could not reach the server. Please try again in a moment.',
    'net.unknown': 'An unknown error occurred.',
    'net.failed': 'The request could not be completed.',
  },
};

export type StaticKey = keyof (typeof STATIC)['ko'];

/**
 * <b>스토어를 읽지 않는다.</b> 이 문구가 필요한 상황이 곧 *"스토어를 채우지 못했다"* 이며,
 * `shared/api` 도 이것을 쓰므로 스토어를 참조하면 순환 의존이 된다.
 */
export function staticText(key: StaticKey, lang?: string): string {
  const resolved = lang ? normalizeLang(lang) : resolveLang();
  return STATIC[resolved][key];
}
