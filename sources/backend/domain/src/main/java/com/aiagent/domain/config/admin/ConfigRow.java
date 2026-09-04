package com.aiagent.domain.config.admin;

import com.aiagent.support.config.ConfigValueType;
import java.time.Instant;

/**
 * 그리드의 한 행 — 63 §4.3. <b>아우터 조인의 결과 한 줄이다.</b>
 *
 * <pre>
 * yml 이 정한 키 목록   LEFT OUTER JOIN   SYS_CONFIG   ON key
 * </pre>
 *
 * <p><b>행 수는 설정 키 수로 고정</b>이며 {@code SYS_CONFIG} 의 행 수와 무관하다.
 *
 * @param cfgKey PK. <b>코드가 정한다</b> — 화면이 만들지 않는다(행 추가가 없다)
 * @param defaultVal {@code yml} 기본값. <b>언제나 있다</b>. 되돌리면 무엇이 되는지가 행마다
 *     보여야 §4.4 의 확인이 놀라움을 주지 않으므로 <b>숨기지 않는다</b>
 * @param cfgVal 적용값 — {@code SYS_CONFIG} 행이 있으면 그 값, 없으면 <b>기본값을 복사해</b>
 *     보여준다. 이 화면의 <b>유일한 입력 칸</b>이다
 * @param cfgType 필드 타입에서 온 유형. 화면은 이것에 맞는 <b>형식</b>만 검사한다(63 §4.5)
 * @param cfgDesc 필드 Javadoc. <b>{@code SYS_CONFIG} 행이 없어도 비지 않는다</b> — 원천이
 *     빌드 산출물이기 때문이다(63 §4.2)
 * @param overridden {@code 변경됨} 의 근거. <b>값이 다른가가 아니라 행이 있는가</b>다 —
 *     기본값과 같은 값으로 저장해 둔 키가 있고, 그것도 <b>되돌릴 수 있어야</b> 한다(63 §4.3)
 * @param regId 감사 4컬럼은 <b>{@code SYS_CONFIG} 행이 있는 키에만</b> 값이 있다
 */
public record ConfigRow(
        String cfgKey,
        String defaultVal,
        String cfgVal,
        ConfigValueType cfgType,
        String cfgDesc,
        boolean overridden,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
