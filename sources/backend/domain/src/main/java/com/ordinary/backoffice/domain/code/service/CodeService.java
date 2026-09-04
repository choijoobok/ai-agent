package com.ordinary.backoffice.domain.code.service;

import com.ordinary.backoffice.domain.code.entity.SysCode;
import com.ordinary.backoffice.domain.code.repository.SysCodeRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 콤보가 읽는 코드 — 43 §4.2 · §8.
 *
 * <h2>백엔드 캐시가 없다</h2>
 *
 * <p>ADR-0017 이 대상마다 캐싱 이유를 갈랐고 코드는 <b>캐싱하지 않는</b> 쪽이다. 조회가
 * 인덱스 한 번이라 서버 부하로 잡을 수준이 아니며, 정작 문제인 <i>"한 화면이 콤보를 여러 개
 * 띄울 때의 왕복"</i> 은 <b>프론트 캐시</b>가 푼다(43 §8). 여기 캐시를 두지 않으므로
 * MASTER-02 의 <i>수정 즉시 반영</i> 이 구조적으로 성립한다.
 *
 * <h2>이름을 담지 않는다</h2>
 *
 * <p>돌려주는 것은 <b>코드값뿐</b>이다. {@code DTL_NM} 은 이름이 아니라 메시지 키이고
 * (43 §4.4) 화면에 보일 글자는 <b>메시지 번들과 메모리에서 조인</b>한다. 그래서 언어를
 * 늘려도 이 응답은 그대로이고, 코드명만 고쳤을 때 코드 캐시를 버릴 이유도 없다.
 *
 * <p>키를 함께 실어 보내지 않는 것도 같은 이유다 — {@code code.{GRP_CD}.{DTL_CD}} 는
 * PK 에서 결정적으로 도출되므로(<code>SysCode.messageKey</code>) 프론트의
 * {@code codeLabel(grpCd, dtlCd)} 가 같은 규칙으로 만든다. 실어 보내면 <b>같은 규칙이 두
 * 곳</b>에 생기고 페이로드만 두 배가 된다.
 *
 * <h2>{@code USE_YN='N'} 은 빠진다</h2>
 *
 * <p>그 플래그의 뜻이 <b>"새로 고르지는 못한다"</b> 이기 때문이다(43 §4.1). 이미 저장된
 * 행의 이름 조회는 이 목록이 아니라 메시지 번들이 하므로 <b>옛 행은 여전히 읽힌다</b>.
 */
@Service
public class CodeService {

    private final SysCodeRepository codes;

    public CodeService(SysCodeRepository codes) {
        this.codes = codes;
    }

    /**
     * 그룹별 코드값 — <b>요청한 그룹은 하나도 빠지지 않는다</b>.
     *
     * <p>없는 그룹도 <b>빈 목록으로 답한다</b>. 키를 빼면 프론트 캐시가 <i>"아직 못 받았다"</i>
     * 와 <i>"받았는데 비어 있다"</i> 를 구분하지 못해 <b>화면을 열 때마다 다시 묻는다</b> —
     * 오타 난 그룹 하나가 영구적인 왕복이 된다.
     *
     * <p>정렬은 {@code SORT_NO} 이고 같으면 {@code DTL_CD} 다. 뒤엣것이 있어야 <b>순서가
     * 매 조회 흔들리지 않는다</b> — 콤보의 항목이 자리를 바꾸면 손이 자리를 기억하지 못한다.
     */
    @Transactional(readOnly = true)
    public Map<String, List<String>> codesOf(Collection<String> grpCds) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (String grpCd : grpCds) {
            result.put(grpCd, new ArrayList<>());
        }
        if (result.isEmpty()) {
            return result;
        }

        for (SysCode code : codes.findForCombo(result.keySet())) {
            result.get(code.getGrpCd()).add(code.getDtlCd());
        }
        return result;
    }
}
