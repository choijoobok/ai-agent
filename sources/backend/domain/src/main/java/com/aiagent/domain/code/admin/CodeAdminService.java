package com.aiagent.domain.code.admin;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowTx;
import com.aiagent.domain.code.entity.SysCode;
import com.aiagent.domain.code.entity.SysCodeGroup;
import com.aiagent.domain.code.entity.SysCodeGrpRef;
import com.aiagent.domain.code.entity.SysCodeGrpRefId;
import com.aiagent.domain.code.entity.SysCodeId;
import com.aiagent.domain.code.entity.SysCodeRef;
import com.aiagent.domain.code.repository.SysCodeGroupRepository;
import com.aiagent.domain.code.repository.SysCodeGrpRefRepository;
import com.aiagent.domain.code.repository.SysCodeRefRepository;
import com.aiagent.domain.code.repository.SysCodeRepository;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessage;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.MessageService;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * {@code CODE_MGMT} 의 저장 — screen/code/requirements.md. <b>버튼 하나가 테이블 셋을 쓴다.</b>
 *
 * <p>하단의 저장 하나가 {@code SYS_CODE} · {@code SYS_MESSAGE}(코드명 — §2.3) ·
 * {@code SYS_CODE_REF}(참조값 — §2.4)를 쓴다. 화면이 셋을 각각 부르게 하면 <b>부분 실패</b>가
 * 생기고, 그때 무엇이 반영됐는지는 사용자가 알 수 없다 — 일괄 저장은 한 트랜잭션이다(UX-14).
 *
 * <h2>게이트 하나, 확인 둘</h2>
 *
 * screen/code/requirements.md 가 셋을 갈랐고 <b>가르는 기준은 <i>DB 가 거부하는가</i></b> 다(frontend/grid.md).
 *
 * <table>
 *   <tr><td>그룹 삭제</td><td><b>게이트</b></td><td>코드가 남의 것이라 FK 가 거부한다</td></tr>
 *   <tr><td>코드 삭제</td><td>확인</td><td>참조값은 그 행의 파생 — 서비스가 먼저 지운다</td></tr>
 *   <tr><td>정의 삭제</td><td>확인</td><td>〃 — 값 → 정의 순서면 거부되지 않는다</td></tr>
 * </table>
 *
 * <p><b>확인은 화면의 일이고 서버는 그냥 지운다.</b> 여기서 한 번 더 막으면 <i>확인했는데
 * 거절당하는</i> 화면이 된다.
 *
 * <h2>{@code SYS_YN} 은 여기서도 막는다</h2>
 *
 * 화면이 입력 수단을 없앤 것(screen/code/requirements.md)과 별개로 저장이 판정한다 — 읽기 전용은 화면에서만
 * 읽기 전용이고 요청 본문은 조작할 수 있다(sys/code.md · 원칙 P1). 켜고 끄는 것 자체는
 * <b>DTO 에 필드가 없어</b> 구조적으로 불가능하다.
 *
 * <p><b>막는 것이 단계마다 다르다</b>(2026-08-30 — sys/code.md 이 그룹의 {@code USE_YN} 을
 * 없앤 뒤).
 *
 * <table>
 *   <tr><td>그룹</td><td><b>삭제만</b></td>
 *       <td>막을 <i>비활성</i> 이라는 것이 없다. 남은 셋({@code GRP_NM}·{@code GRP_DESC}·
 * {@code SORT_NO})은 sys/code.md 이 시스템 행에서도 허용한 것들이다</td></tr>
 *   <tr><td>코드</td><td><b>삭제와 비활성</b></td>
 *       <td>{@code USE_YN} 이 있고 <b>끄는 것이 지우는 것과 같은 효과</b>다 — 콤보에서
 * 사라지므로(sys/code.md) 소스가 그 코드값을 못 찾는다</td></tr>
 * </table>
 */
@Service
public class CodeAdminService {

    private final SysCodeGroupRepository groups;
    private final SysCodeRepository codes;
    private final SysCodeGrpRefRepository refDefs;
    private final SysCodeRefRepository refValues;
    private final SysMessageKeyRepository messageKeys;
    private final SysMessageRepository messageValues;
    private final SysCacheVersionRepository versions;
    private final MessageService messages;
    private final Clock clock;

    public CodeAdminService(
            SysCodeGroupRepository groups,
            SysCodeRepository codes,
            SysCodeGrpRefRepository refDefs,
            SysCodeRefRepository refValues,
            SysMessageKeyRepository messageKeys,
            SysMessageRepository messageValues,
            SysCacheVersionRepository versions,
            MessageService messages,
            Clock clock) {
        this.groups = groups;
        this.codes = codes;
        this.refDefs = refDefs;
        this.refValues = refValues;
        this.messageKeys = messageKeys;
        this.messageValues = messageValues;
        this.versions = versions;
        this.messages = messages;
        this.clock = clock;
    }

    // ── 마스터 — 코드 그룹 ───────────────────────────────────────────

    @Transactional
    public void saveGroup(List<CodeGroupSaveRow> rows) {
        Set<String> seen = new HashSet<>();

        RowTx.oneTxForAll(rows, row -> {
            // 같은 요청 안의 중복은 화면이 막지만, 막혔다고 서버가 안 봐도 되는 것은 아니다 —
            // 두 번째 C 의 존재 확인이 첫 번째의 flush 를 만나지 못해 조용히 덮인다.
            if (!seen.add(row.grpCd())) {
                throw new BusinessException(
                        CodeErrorCode.GROUP_DUPLICATE,
                        "같은 그룹이 두 번 왔다 — " + row.grpCd(),
                        List.of(new BusinessException.FieldError(
                                "grpCd", "이미 있는 코드 그룹입니다", row.grpCd())));
            }
            switch (row.rowState()) {
                case C -> createGroup(row);
                case U -> updateGroup(row);
                case D -> deleteGroup(row);
            }
        });
        bump(SysCacheVersion.CODE);
    }

    private void createGroup(CodeGroupSaveRow row) {
        require(row.grpNm(), "grpNm", "그룹명");
        if (groups.existsById(row.grpCd())) {
            throw duplicateGroup(row.grpCd());
        }
        groups.save(SysCodeGroup.created(
                row.grpCd(), row.grpNm(), row.grpDesc(), row.sortNoOrZero()));
    }

    /**
     * <b>여기에 {@code SYS_YN} 검사가 없다</b>(2026-08-30 — sys/code.md). 그룹에서 막을
     * <i>비활성</i> 이라는 것이 없어졌기 때문이다 — {@code USE_YN} 컬럼이 사라졌고, 남은
     * 셋({@code GRP_NM} · {@code GRP_DESC} · {@code SORT_NO})은 sys/code.md 이 시스템 행에서도
     * <b>허용한</b> 것들이다. 그룹의 {@code SYS_YN} 이 지키는 것은 이제 <b>삭제 하나</b>다.
     *
     * <p>코드 쪽({@link #updateCode})에는 그 검사가 남는다 — 거기는 {@code USE_YN} 이 있다.
     */
    private void updateGroup(CodeGroupSaveRow row) {
        require(row.grpNm(), "grpNm", "그룹명");
        requireGroup(row.grpCd()).apply(row.grpNm(), row.grpDesc(), row.sortNoOrZero());
    }

    /**
     * <b>게이트가 여기 있다</b> — frontend/grid.md 의 첫 실물(screen/code/requirements.md).
     *
     * <p>화면은 하단이 {@code 0} 건일 때만 체크박스를 연다. 그 판정은 <b>조회 시점</b>의
     * 것이므로 그 사이에 다른 사람이 코드를 추가할 수 있다 — 여기서 한 번 더 세는 것이 그
     * 창을 좁히고, 그래도 남는 창은 FK 가 닫는다.
     *
     * <p><b>정의는 함께 지운다.</b> 코드가 {@code 0} 건이면 참조값도 {@code 0} 건이라
     * 안전하며, 남기면 <i>지워진 그룹의 정의</i> 라는 읽을 경로가 없는 행이 된다.
     */
    private void deleteGroup(CodeGroupSaveRow row) {
        SysCodeGroup group = requireGroup(row.grpCd());
        if (Boolean.TRUE.equals(group.getSysYn())) {
            throw systemLocked("시스템 그룹은 지울 수 없다 — " + row.grpCd());
        }
        if (codes.countByGrpCd(row.grpCd()) > 0) {
            throw new BusinessException(
                    CodeErrorCode.GROUP_HAS_CODE,
                    "코드가 남아 있다 — " + row.grpCd(),
                    List.of(new BusinessException.FieldError(
                            "grpCd", "코드가 있어 그룹을 지울 수 없습니다", row.grpCd())));
        }
        refDefs.deleteAll(refDefs.findByGrpCdOrderByRefCdAsc(row.grpCd()));
        groups.delete(group);
    }

    // ── 하단 — 코드 ──────────────────────────────────────────────────

    /**
     * 코드 저장 — <b>{@code refs} 는 그 그룹의 정의 목록을 루프한다</b>(screen/code/requirements.md).
     *
     * @param lang 세션 언어 — 코드명이 쓰이는 {@code SYS_MESSAGE} 행의 언어다(screen/code/requirements.md).
     *     도메인이 요청을 모르므로 컨트롤러가 준다
     */
    @Transactional
    public void save(String grpCd, String lang, List<CodeSaveRow> rows) {
        requireGroup(grpCd);
        // 정의 목록을 한 번만 읽는다 — 행마다 읽으면 같은 질의가 코드 수만큼 나간다.
        List<SysCodeGrpRef> defs = refDefs.findByGrpCdOrderByRefCdAsc(grpCd);
        Set<String> seen = new HashSet<>();
        /* 람다 밖으로 값을 내보내는 자리 — 실패한 행이 있어도 마지막에 던지므로 롤백된다. */
        boolean[] nameChanged = {false};

        RowTx.oneTxForAll(rows, row -> {
            if (!seen.add(row.dtlCd())) {
                throw duplicateCode(row.dtlCd());
            }
            nameChanged[0] |= switch (row.rowState()) {
                case C -> createCode(grpCd, lang, row, defs);
                case U -> updateCode(grpCd, lang, row, defs);
                case D -> deleteCode(grpCd, row);
            };
        });
        bump(SysCacheVersion.CODE);
        if (nameChanged[0]) {
            // 이름의 원본이 SYS_MESSAGE 라 프론트는 그것을 번들에서 읽는다 — code 만 올리면
            // 목록은 새것인데 라벨이 옛것인 화면이 나온다(sys/code.md).
            bump(SysCacheVersion.MESSAGE);
            evictAfterCommit();
        }
    }

    private boolean createCode(String grpCd, String lang, CodeSaveRow row, List<SysCodeGrpRef> defs) {
        if (codes.existsById(new SysCodeId(grpCd, row.dtlCd()))) {
            throw duplicateCode(row.dtlCd());
        }
        codes.save(SysCode.created(
                grpCd, row.dtlCd(), row.dtlDesc(), row.useYnOrTrue(), row.sortNoOrZero()));
        writeRefs(grpCd, row, defs);
        return writeName(grpCd, row.dtlCd(), lang, row.codeNm());
    }

    private boolean updateCode(String grpCd, String lang, CodeSaveRow row, List<SysCodeGrpRef> defs) {
        SysCode code = requireCode(grpCd, row.dtlCd());
        if (Boolean.TRUE.equals(code.getSysYn()) && !row.useYnOrTrue()) {
            throw systemLocked("시스템 코드는 끌 수 없다 — " + grpCd + "." + row.dtlCd());
        }
        code.apply(row.dtlDesc(), row.useYnOrTrue(), row.sortNoOrZero());
        writeRefs(grpCd, row, defs);
        return writeName(grpCd, row.dtlCd(), lang, row.codeNm());
    }

    /**
     * 코드 삭제 — <b>참조값도 이름도 함께 사라진다</b>(screen/code/requirements.md).
     *
     * <p>참조값은 그 행의 파생이라 함께 지우고, 이름은 <b>키까지</b> 지운다. 값만 지우고 키를
     * 남기면 그 키는 {@code USE_SCOPE='DATA'} 인 채로 영영 남는데,
     * {@code generateMessageSeed} 가 {@code code.} 접두를 건드리지 않으므로(seed.md) <b>죽은
     * 키로 표시될 경로조차 없다</b> — {@code MESSAGE_MGMT} 에서 손으로 찾아 지우는 수밖에
     * 없어진다. 데이터가 만든 키는 <b>그 데이터가 거둔다.</b>
     */
    private boolean deleteCode(String grpCd, CodeSaveRow row) {
        SysCode code = requireCode(grpCd, row.dtlCd());
        if (Boolean.TRUE.equals(code.getSysYn())) {
            throw systemLocked("시스템 코드는 지울 수 없다 — " + grpCd + "." + row.dtlCd());
        }
        refValues.deleteByGrpCdAndDtlCd(grpCd, row.dtlCd());

        String msgKey = SysCode.messageKey(grpCd, row.dtlCd());
        boolean hadName = !messageValues.findByMsgKey(msgKey).isEmpty();
        // 값 → 키 순서다. 반대로 지우면 FK 가 거부한다(005 changelog).
        messageValues.deleteByMsgKey(msgKey);
        messageKeys.findById(msgKey).ifPresent(messageKeys::delete);

        codes.delete(code);
        return hadName;
    }

    /**
     * 코드명 — <b>비우면 그 언어의 행을 지운다</b>(screen/code/requirements.md).
     *
     * <p>빈 문자열을 넣지 않는 이유는 sys/code.md 의 폴백이 죽기 때문이다. 값이 없으면 기본
     * 언어로, 그것도 없으면 <b>키 문자열</b>로 떨어져야 <i>아직 안 채웠다</i> 가 화면에서
     * 드러난다 — 빈 문자열은 <b>이름이 없는 코드를 조용히</b> 만든다.
     *
     * <p><b>키 행은 지우지 않는다.</b> 다른 언어의 값이 남아 있을 수 있고, 코드가 살아 있는 한
     * 그 키도 살아 있다 — 키를 거두는 자리는 {@link #deleteCode} 하나다.
     *
     * @return {@code SYS_MESSAGE} 가 실제로 바뀌었는가 — 캐시 버전을 올릴지의 근거다
     */
    private boolean writeName(String grpCd, String dtlCd, String lang, String codeNm) {
        String msgKey = SysCode.messageKey(grpCd, dtlCd);
        SysMessage current = messageValues.findByMsgKey(msgKey).stream()
                .filter(value -> lang.equals(value.getLangCd()))
                .findFirst()
                .orElse(null);

        if (codeNm == null) {
            if (current == null) {
                return false;
            }
            messageValues.delete(current);
            return true;
        }
        if (current == null) {
            if (!messageKeys.existsById(msgKey)) {
                // USE_SCOPE 는 DATA 다 — 소스에 상수가 없는 것이 정상인 키다(sys/message.md).
                messageKeys.save(SysMessageKey.dataKey(msgKey));
            }
            messageValues.save(SysMessage.of(msgKey, lang, codeNm));
            return true;
        }
        if (codeNm.equals(current.getMsgVal())) {
            return false;
        }
        current.changeValue(codeNm);
        return true;
    }

    /**
     * 참조값 — <b>정의 목록을 루프한다</b>(screen/code/requirements.md).
     *
     * <p>맵을 루프하지 않는 것이 요점이다. 맵에 <b>키가 없는 것</b>과 <b>값이 빈 것</b>은 같은
     * 뜻(<i>값 없음</i> — sys/code.md)인데, 맵을 돌면 앞엣것이 <i>손대지 않음</i> 으로 읽혀
     * <b>지우는 경로가 사라진다</b>.
     *
     * <p>정의에 없는 {@code REF_CD} 는 거부한다. FK 도 같은 것을 막지만 그쪽의 실패는
     * 제약 이름을 단 500 이고, 이쪽은 <b>어느 칸이 왜인지</b> 를 말하는 400 이다.
     */
    private void writeRefs(String grpCd, CodeSaveRow row, List<SysCodeGrpRef> defs) {
        Map<String, String> sent = row.refsOrEmpty();
        Set<String> known = new HashSet<>();
        defs.forEach(def -> known.add(def.getRefCd()));

        for (String refCd : sent.keySet()) {
            if (!known.contains(refCd)) {
                throw new BusinessException(
                        CodeErrorCode.REF_DEF_UNKNOWN,
                        "이 그룹에 정의되지 않은 참조 코드다 — " + grpCd + "." + refCd,
                        List.of(new BusinessException.FieldError(
                                "ref." + refCd, "이 그룹에 정의되지 않은 참조 코드입니다")));
            }
        }

        Map<String, SysCodeRef> existing = new HashMap<>();
        refValues.findByGrpCdAndDtlCd(grpCd, row.dtlCd())
                .forEach(value -> existing.put(value.getRefCd(), value));

        for (SysCodeGrpRef def : defs) {
            String value = CodeSaveRow.blankToNull(sent.get(def.getRefCd()));
            SysCodeRef current = existing.get(def.getRefCd());
            if (value == null) {
                if (current != null) {
                    refValues.delete(current);
                }
            } else if (current == null) {
                refValues.save(SysCodeRef.of(grpCd, row.dtlCd(), def.getRefCd(), value));
            } else {
                current.changeValue(value);
            }
        }
    }

    // ── 정의 모달 — 참조 코드 ────────────────────────────────────────

    /**
     * 정의 저장 — <b>모달 안에서 닫힌다</b>(screen/code/requirements.md).
     *
     * <p>{@code REF_CD} 는 {@code CODE_REF_KEY} 공통코드의 화이트리스트에서만 온다(sys/code.md).
     * 화면이 콤보로 막지만 <b>정의 테이블이 그 통제를 대신하지 않으므로</b> 여기서도 본다 —
     * 소스가 이 값을 문자열로 참조하기 때문이며, 오타 하나가 <i>영영 안 걸리는 콤보</i> 가
     * 된다.
     */
    @Transactional
    public void saveRefDef(String grpCd, List<CodeRefDefSaveRow> rows) {
        requireGroup(grpCd);
        Set<String> seen = new HashSet<>();

        RowTx.oneTxForAll(rows, row -> {
            if (!seen.add(row.refCd())) {
                throw duplicateRefDef(row.refCd());
            }
            switch (row.rowState()) {
                case C -> createRefDef(grpCd, row);
                case U -> updateRefDef(grpCd, row);
                case D -> deleteRefDef(grpCd, row);
            }
        });
        // 정의가 바뀌면 하단의 **컬럼 집합**이 바뀐다 — 프론트 코드 캐시도 그 축에 있다.
        bump(SysCacheVersion.CODE);
    }

    private void createRefDef(String grpCd, CodeRefDefSaveRow row) {
        require(row.refNm(), "refNm", "참조 코드명");
        if (!codes.existsById(new SysCodeId(SysCodeGrpRef.REF_CD_GROUP, row.refCd()))) {
            throw new BusinessException(
                    CodeErrorCode.REF_CD_UNKNOWN,
                    "화이트리스트 밖의 참조 코드다 — " + row.refCd(),
                    List.of(new BusinessException.FieldError(
                            "refCd", "허용되지 않은 참조 코드 값입니다", row.refCd())));
        }
        if (refDefs.existsById(new SysCodeGrpRefId(grpCd, row.refCd()))) {
            throw duplicateRefDef(row.refCd());
        }
        refDefs.save(SysCodeGrpRef.created(grpCd, row.refCd(), row.refNm(), row.refDesc()));
    }

    private void updateRefDef(String grpCd, CodeRefDefSaveRow row) {
        require(row.refNm(), "refNm", "참조 코드명");
        requireRefDef(grpCd, row.refCd()).apply(row.refNm(), row.refDesc());
    }

    /** 값 → 정의 순서면 FK 가 거부하지 않는다 — 그래서 게이트가 아니라 확인이다(screen/code/requirements.md). */
    private void deleteRefDef(String grpCd, CodeRefDefSaveRow row) {
        SysCodeGrpRef def = requireRefDef(grpCd, row.refCd());
        refValues.deleteByGrpCdAndRefCd(grpCd, row.refCd());
        refDefs.delete(def);
    }

    // ── 캐시 ─────────────────────────────────────────────────────────

    private void bump(String cacheName) {
        Instant now = clock.instant();
        versions.findById(cacheName)
                .ifPresentOrElse(
                        version -> version.bump(now),
                        () -> versions.save(SysCacheVersion.started(cacheName, now)));
    }

    /**
     * <b>커밋 뒤에 비운다.</b> 커밋 전에 비우면 다른 스레드가 아직 옛 값인 DB 를 읽어 캐시를
     * 다시 채우고, 그 뒤에 커밋이 앉아 TTL 만큼 옛 문구가 나간다 — {@code MessageAdminService}
     * 가 같은 자리에서 같은 판단을 했다.
     */
    private void evictAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            messages.evict();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                messages.evict();
            }
        });
    }

    // ── 검증 ─────────────────────────────────────────────────────────

    private SysCodeGroup requireGroup(String grpCd) {
        return groups.findById(grpCd)
                .orElseThrow(() -> new BusinessException(
                        CodeErrorCode.GROUP_MISSING, "이미 지워진 그룹이다 — " + grpCd));
    }

    private SysCode requireCode(String grpCd, String dtlCd) {
        return codes.findById(new SysCodeId(grpCd, dtlCd))
                .orElseThrow(() -> new BusinessException(
                        CodeErrorCode.CODE_MISSING, "이미 지워진 코드다 — " + grpCd + "." + dtlCd));
    }

    private SysCodeGrpRef requireRefDef(String grpCd, String refCd) {
        return refDefs.findById(new SysCodeGrpRefId(grpCd, refCd))
                .orElseThrow(() -> new BusinessException(
                        CodeErrorCode.REF_DEF_UNKNOWN,
                        "이미 지워진 정의다 — " + grpCd + "." + refCd));
    }

    /**
     * 필수 값 — <b>애너테이션으로 두지 않는다.</b>
     *
     * <p>{@code @NotBlank} 를 레코드에 걸면 <b>삭제 행에서도</b> 돈다. 삭제는 대상만 가리키면
     * 되므로 화면이 이름을 보내지 않으며, 그때 400 이 나면 <i>지우는데 이름이 필요하다</i> 는
     * 말이 된다 — 상태에 따라 갈리는 검증은 상태를 아는 자리에 있어야 한다.
     */
    private static void require(String value, String field, String what) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(
                    CodeErrorCode.REQUIRED,
                    what + " 가 비었다",
                    List.of(new BusinessException.FieldError(field, "필수 값이 비어 있습니다")));
        }
    }

    private static BusinessException systemLocked(String detail) {
        return new BusinessException(CodeErrorCode.SYSTEM_LOCKED, detail);
    }

    /*
      셋 다 <b>값을 함께 싣는다</b>(backend/api.md §3-1). 화면이 행을 되찾으면 화면의 값을
      쓰므로 대개 쓰이지 않지만, 되찾지 못한 오류에서는 <i>무슨 값이 중복인가</i> 를 말할
      수 있는 <b>유일한 통로</b>다.
    */
    private static BusinessException duplicateGroup(String grpCd) {
        return new BusinessException(
                CodeErrorCode.GROUP_DUPLICATE,
                "이미 있는 그룹이다 — " + grpCd,
                List.of(new BusinessException.FieldError("grpCd", "이미 있는 코드 그룹입니다", grpCd)));
    }

    private static BusinessException duplicateCode(String dtlCd) {
        return new BusinessException(
                CodeErrorCode.CODE_DUPLICATE,
                "이미 있는 코드다 — " + dtlCd,
                List.of(new BusinessException.FieldError("dtlCd", "이미 있는 코드입니다", dtlCd)));
    }

    private static BusinessException duplicateRefDef(String refCd) {
        return new BusinessException(
                CodeErrorCode.REF_DEF_DUPLICATE,
                "이미 있는 정의다 — " + refCd,
                List.of(new BusinessException.FieldError("refCd", "이미 있는 참조 코드입니다", refCd)));
    }
}
