package com.ordinary.backoffice.domain.code.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.grid.RowState;
import com.ordinary.backoffice.domain.code.entity.SysCode;
import com.ordinary.backoffice.domain.code.entity.SysCodeGroup;
import com.ordinary.backoffice.domain.code.entity.SysCodeGrpRef;
import com.ordinary.backoffice.domain.code.entity.SysCodeGrpRefId;
import com.ordinary.backoffice.domain.code.entity.SysCodeId;
import com.ordinary.backoffice.domain.code.entity.SysCodeRef;
import com.ordinary.backoffice.domain.code.repository.SysCodeGroupRepository;
import com.ordinary.backoffice.domain.code.repository.SysCodeGrpRefRepository;
import com.ordinary.backoffice.domain.code.repository.SysCodeRefRepository;
import com.ordinary.backoffice.domain.code.repository.SysCodeRepository;
import com.ordinary.backoffice.domain.message.MessageScope;
import com.ordinary.backoffice.domain.message.entity.SysCacheVersion;
import com.ordinary.backoffice.domain.message.entity.SysMessage;
import com.ordinary.backoffice.domain.message.entity.SysMessageKey;
import com.ordinary.backoffice.domain.message.repository.SysCacheVersionRepository;
import com.ordinary.backoffice.domain.message.repository.SysMessageKeyRepository;
import com.ordinary.backoffice.domain.message.repository.SysMessageRepository;
import com.ordinary.backoffice.domain.message.service.MessageService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

/**
 * 저장 셋이 무엇을 지키는가 — 63 §2.
 *
 * <p><b>여기서 지키는 것 넷이다.</b> ① 그룹 삭제의 <b>게이트</b>와 코드·정의 삭제의
 * <b>확인</b>이 다른 것이다(§2.5), ② {@code SYS_YN} 은 화면이 아니라 <b>여기서도</b>
 * 막는다(43 §4.3), ③ 코드명은 <b>비우면 지운다</b>(§2.3), ④ 참조값은 <b>정의 목록을</b>
 * 루프한다(§2.4).
 *
 * <p>③과 ④가 특히 조용히 깨진다. 빈 문자열을 저장해도 성공하고 그 뒤에 폴백이 <b>기본
 * 언어로 가지 않고 빈 이름</b>을 내며(43 §7.3), 맵을 루프하면 <b>지우는 경로가 아예
 * 사라진다</b> — 둘 다 저장은 되고 화면만 이상해진다.
 */
class CodeAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-30T00:00:00Z");
    private static final String GRP = "ORDER_KIND";

    private SysCodeGroupRepository groups;
    private SysCodeRepository codes;
    private SysCodeGrpRefRepository refDefs;
    private SysCodeRefRepository refValues;
    private SysMessageKeyRepository messageKeys;
    private SysMessageRepository messageValues;
    private SysCacheVersionRepository versions;
    private CodeAdminService service;

    @BeforeEach
    void setUp() {
        groups = mock(SysCodeGroupRepository.class);
        codes = mock(SysCodeRepository.class);
        refDefs = mock(SysCodeGrpRefRepository.class);
        refValues = mock(SysCodeRefRepository.class);
        messageKeys = mock(SysMessageKeyRepository.class);
        messageValues = mock(SysMessageRepository.class);
        versions = mock(SysCacheVersionRepository.class);

        when(groups.findById(GRP)).thenReturn(Optional.of(group(GRP, false)));
        when(refDefs.findByGrpCdOrderByRefCdAsc(anyString())).thenReturn(List.of());
        when(refValues.findByGrpCdAndDtlCd(anyString(), anyString())).thenReturn(List.of());
        when(messageValues.findByMsgKey(anyString())).thenReturn(List.of());
        when(versions.findById(anyString())).thenReturn(Optional.empty());

        service = new CodeAdminService(
                groups,
                codes,
                refDefs,
                refValues,
                messageKeys,
                messageValues,
                versions,
                mock(MessageService.class),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // ── 고정물 ───────────────────────────────────────────────────────

    private static SysCodeGroup group(String grpCd, boolean system) {
        SysCodeGroup entity = SysCodeGroup.created(grpCd, "주문 유형", null, 0);
        if (system) {
            systemFlag(entity, "sysYn");
        }
        return entity;
    }

    private static SysCode code(String dtlCd, boolean system) {
        SysCode entity = SysCode.created(GRP, dtlCd, null, true, 0);
        if (system) {
            systemFlag(entity, "sysYn");
        }
        return entity;
    }

    /**
     * {@code SYS_YN} 을 켤 <b>수단이 없는 것</b>이 설계라(43 §4.3) 테스트도 정상 경로로는
     * 만들 수 없다. 시드만 이 값을 넣으므로 여기서는 리플렉션으로 그 상태를 재현한다 —
     * <b>세터를 열면 그 순간 설계가 무너진다.</b>
     */
    private static void systemFlag(Object entity, String field) {
        try {
            var declared = entity.getClass().getDeclaredField(field);
            declared.setAccessible(true);
            declared.set(entity, Boolean.TRUE);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static CodeGroupSaveRow groupRow(RowState state, String grpCd, String grpNm) {
        return new CodeGroupSaveRow(state, grpCd, grpNm, null, 0);
    }

    private static CodeSaveRow codeRow(RowState state, String dtlCd, String codeNm) {
        return new CodeSaveRow(state, dtlCd, codeNm, null, true, 0, Map.of());
    }

    private void existingCode(String dtlCd, boolean system) {
        SysCodeId id = new SysCodeId(GRP, dtlCd);
        when(codes.existsById(id)).thenReturn(true);
        when(codes.findById(id)).thenReturn(Optional.of(code(dtlCd, system)));
    }

    // ── 그룹 ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("코드 그룹")
    class Groups {

        @Test
        @DisplayName("코드가 남아 있으면 지울 수 없다 — 게이트는 조회 시점이 아니라 여기가 마지막이다")
        void deleteIsGatedByChildCount() {
            when(codes.countByGrpCd(GRP)).thenReturn(4L);

            assertThatThrownBy(() -> service.saveGroup(List.of(groupRow(RowState.D, GRP, null))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.GROUP_HAS_CODE);
        }

        @Test
        @DisplayName("코드가 0건이면 정의가 남아 있어도 함께 지운다 — 값도 0건이라 안전하다")
        void deleteAlsoRemovesDefinitions() {
            when(codes.countByGrpCd(GRP)).thenReturn(0L);
            SysCodeGrpRef def = SysCodeGrpRef.created(GRP, "PARENT", "상위", null);
            when(refDefs.findByGrpCdOrderByRefCdAsc(GRP)).thenReturn(List.of(def));

            service.saveGroup(List.of(groupRow(RowState.D, GRP, null)));

            verify(refDefs).deleteAll(List.of(def));
            verify(groups).delete(any(SysCodeGroup.class));
        }

        @Test
        @DisplayName("시스템 그룹은 지울 수 없다 — 화면에 수단이 없어도 본문은 조작할 수 있다")
        void systemGroupCannotBeDeleted() {
            when(groups.findById("LANG_CD")).thenReturn(Optional.of(group("LANG_CD", true)));

            assertThatThrownBy(() ->
                            service.saveGroup(List.of(groupRow(RowState.D, "LANG_CD", null))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.SYSTEM_LOCKED);
        }

        /**
         * 43 §4.1 이 그룹의 {@code USE_YN} 을 없앤 뒤 <b>남은 셋은 시스템 그룹에서도
         * 열려 있다</b> — 43 §4.3 이 원래 허용한 것들이다. 이 테스트가 지키는 것은
         * <i>그룹의 {@code SYS_YN} 이 삭제 하나만 막는다</i> 는 사실이다.
         */
        @Test
        @DisplayName("시스템 그룹도 이름·설명·정렬은 고쳐진다 — 막는 것은 삭제 하나다")
        void systemGroupStillTakesEdits() {
            SysCodeGroup locked = group("LANG_CD", true);
            when(groups.findById("LANG_CD")).thenReturn(Optional.of(locked));

            service.saveGroup(List.of(groupRow(RowState.U, "LANG_CD", "지원 언어")));

            assertThat(locked.getGrpNm()).isEqualTo("지원 언어");
        }

        @Test
        @DisplayName("화면이 만든 그룹은 언제나 업무 그룹이다 — 잠글 경로가 없다")
        void newGroupIsNeverSystem() {
            service.saveGroup(List.of(groupRow(RowState.C, "NEW_GRP", "새 그룹")));

            ArgumentCaptor<SysCodeGroup> saved = ArgumentCaptor.forClass(SysCodeGroup.class);
            verify(groups).save(saved.capture());
            assertThat(saved.getValue().getSysYn()).isFalse();
        }

        @Test
        @DisplayName("그룹명이 비면 거부한다 — 삭제 행에서는 묻지 않는다")
        void groupNameIsRequiredExceptOnDelete() {
            assertThatThrownBy(() -> service.saveGroup(List.of(groupRow(RowState.C, "X", "  "))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.REQUIRED);

            when(codes.countByGrpCd(GRP)).thenReturn(0L);
            assertThatCode(() -> service.saveGroup(List.of(groupRow(RowState.D, GRP, null))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("같은 요청 안의 중복도 거부한다 — 두 번째의 존재 확인이 첫 번째를 못 본다")
        void duplicateWithinOneRequest() {
            assertThatThrownBy(() -> service.saveGroup(List.of(
                            groupRow(RowState.C, "A", "가"), groupRow(RowState.C, "A", "나"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.GROUP_DUPLICATE);
        }
    }

    // ── 코드 · 코드명 ────────────────────────────────────────────────

    @Nested
    @DisplayName("코드명")
    class CodeNames {

        @Test
        @DisplayName("코드명은 SYS_MESSAGE 로 간다 — 키는 서버가 PK 로 조립한다")
        void nameGoesToMessageTable() {
            service.save(GRP, "ko", List.of(codeRow(RowState.C, "B2B", "기업 간 거래")));

            ArgumentCaptor<SysMessage> saved = ArgumentCaptor.forClass(SysMessage.class);
            verify(messageValues).save(saved.capture());
            assertThat(saved.getValue().getMsgKey()).isEqualTo("code.ORDER_KIND.B2B");
            assertThat(saved.getValue().getLangCd()).isEqualTo("ko");
        }

        @Test
        @DisplayName("데이터가 만든 키의 사용처는 DATA 다 — NONE 이면 죽은 키로 잡힌다")
        void dataKeyScope() {
            service.save(GRP, "ko", List.of(codeRow(RowState.C, "B2B", "기업 간 거래")));

            ArgumentCaptor<SysMessageKey> saved = ArgumentCaptor.forClass(SysMessageKey.class);
            verify(messageKeys).save(saved.capture());
            assertThat(saved.getValue().getUseScope()).isEqualTo(MessageScope.DATA);
        }

        @Test
        @DisplayName("비우면 그 언어의 행을 지운다 — 빈 문자열을 저장하면 폴백이 죽는다")
        void blankNameDeletesTheRow() {
            existingCode("B2B", false);
            SysMessage current = SysMessage.of("code.ORDER_KIND.B2B", "ko", "기업 간 거래");
            when(messageValues.findByMsgKey("code.ORDER_KIND.B2B")).thenReturn(List.of(current));

            service.save(GRP, "ko", List.of(codeRow(RowState.U, "B2B", "   ")));

            verify(messageValues).delete(current);
            verify(messageValues, never()).save(any(SysMessage.class));
        }

        @Test
        @DisplayName("다른 언어의 값은 건드리지 않는다 — 여기서 채우는 것은 세션 언어 하나다")
        void otherLanguagesAreUntouched() {
            existingCode("B2B", false);
            SysMessage english = SysMessage.of("code.ORDER_KIND.B2B", "en", "B2B");
            when(messageValues.findByMsgKey("code.ORDER_KIND.B2B")).thenReturn(List.of(english));

            service.save(GRP, "ko", List.of(codeRow(RowState.U, "B2B", "기업 간 거래")));

            verify(messageValues, never()).delete(english);
            assertThat(english.getMsgVal()).isEqualTo("B2B");
        }

        @Test
        @DisplayName("이름이 안 바뀌면 메시지 캐시 버전도 올리지 않는다 — 전 사용자의 번들을 버릴 이유가 없다")
        void unchangedNameDoesNotBumpMessageVersion() {
            existingCode("B2B", false);
            when(messageValues.findByMsgKey("code.ORDER_KIND.B2B"))
                    .thenReturn(List.of(SysMessage.of("code.ORDER_KIND.B2B", "ko", "기업 간 거래")));

            service.save(GRP, "ko", List.of(codeRow(RowState.U, "B2B", "기업 간 거래")));

            verify(versions).findById(SysCacheVersion.CODE);
            verify(versions, never()).findById(SysCacheVersion.MESSAGE);
        }
    }

    @Nested
    @DisplayName("코드 삭제")
    class DeleteCode {

        @Test
        @DisplayName("참조값 → 메시지 값 → 메시지 키 → 코드 순서다 — 반대면 FK 가 거부한다")
        void deletesChildrenFirst() {
            existingCode("B2B", false);
            when(messageKeys.findById("code.ORDER_KIND.B2B"))
                    .thenReturn(Optional.of(SysMessageKey.dataKey("code.ORDER_KIND.B2B")));

            service.save(GRP, "ko", List.of(codeRow(RowState.D, "B2B", null)));

            InOrder order = inOrder(refValues, messageValues, messageKeys, codes);
            order.verify(refValues).deleteByGrpCdAndDtlCd(GRP, "B2B");
            order.verify(messageValues).deleteByMsgKey("code.ORDER_KIND.B2B");
            order.verify(messageKeys).delete(any(SysMessageKey.class));
            order.verify(codes).delete(any(SysCode.class));
        }

        @Test
        @DisplayName("시스템 코드는 지울 수 없다 — 지키는 것은 코드의 존재다")
        void systemCodeCannotBeDeleted() {
            existingCode("B2B", true);

            assertThatThrownBy(() -> service.save(GRP, "ko", List.of(codeRow(RowState.D, "B2B", null))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.SYSTEM_LOCKED);
        }
    }

    // ── 참조값 ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("참조값")
    class RefValues {

        private SysCodeGrpRef parent;

        @BeforeEach
        void definitions() {
            parent = SysCodeGrpRef.created(GRP, "PARENT", "상위 창고", null);
            when(refDefs.findByGrpCdOrderByRefCdAsc(GRP)).thenReturn(List.of(parent));
        }

        private CodeSaveRow withRefs(RowState state, String dtlCd, Map<String, String> refs) {
            Map<String, String> copy = new HashMap<>(refs);
            return new CodeSaveRow(state, dtlCd, null, null, true, 0, copy);
        }

        @Test
        @DisplayName("값이 있으면 만든다")
        void writesValue() {
            existingCode("B2B", false);

            service.save(GRP, "ko", List.of(withRefs(RowState.U, "B2B", Map.of("PARENT", "SEOUL"))));

            ArgumentCaptor<SysCodeRef> saved = ArgumentCaptor.forClass(SysCodeRef.class);
            verify(refValues).save(saved.capture());
            assertThat(saved.getValue().getRefVal()).isEqualTo("SEOUL");
        }

        @Test
        @DisplayName("맵에 키가 없으면 지운다 — 맵을 루프하면 이 경로가 사라진다")
        void missingKeyDeletesTheValue() {
            existingCode("B2B", false);
            SysCodeRef current = SysCodeRef.of(GRP, "B2B", "PARENT", "SEOUL");
            when(refValues.findByGrpCdAndDtlCd(GRP, "B2B")).thenReturn(List.of(current));

            service.save(GRP, "ko", List.of(withRefs(RowState.U, "B2B", Map.of())));

            verify(refValues).delete(current);
        }

        @Test
        @DisplayName("빈 값도 지운다 — 없는 값의 표현은 하나다(43 §5.4)")
        void blankValueDeletesTheValue() {
            existingCode("B2B", false);
            SysCodeRef current = SysCodeRef.of(GRP, "B2B", "PARENT", "SEOUL");
            when(refValues.findByGrpCdAndDtlCd(GRP, "B2B")).thenReturn(List.of(current));

            service.save(GRP, "ko", List.of(withRefs(RowState.U, "B2B", Map.of("PARENT", "  "))));

            verify(refValues).delete(current);
            verify(refValues, never()).save(any(SysCodeRef.class));
        }

        @Test
        @DisplayName("정의에 없는 참조 코드는 거부한다 — FK 의 500 보다 어느 칸인지 말하는 400 이 낫다")
        void unknownRefCdIsRejected() {
            existingCode("B2B", false);

            assertThatThrownBy(() -> service.save(
                            GRP, "ko", List.of(withRefs(RowState.U, "B2B", Map.of("COLOR", "RED")))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.REF_DEF_UNKNOWN);
        }

        @Test
        @DisplayName("시스템 코드의 참조값은 열려 있다 — SYS_YN 이 지키는 것은 속성값이 아니다")
        void systemCodeStillTakesRefValues() {
            existingCode("B2B", true);

            service.save(GRP, "ko", List.of(withRefs(RowState.U, "B2B", Map.of("PARENT", "SEOUL"))));

            verify(refValues).save(any(SysCodeRef.class));
        }
    }

    // ── 정의 ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("참조 코드 정의")
    class RefDefinitions {

        private static CodeRefDefSaveRow defRow(RowState state, String refCd, String refNm) {
            return new CodeRefDefSaveRow(state, refCd, refNm, null);
        }

        @Test
        @DisplayName("화이트리스트 밖의 값은 거부한다 — 정의 테이블이 그 통제를 대신하지 않는다")
        void refCdMustBeWhitelisted() {
            when(codes.existsById(new SysCodeId(SysCodeGrpRef.REF_CD_GROUP, "TYPO")))
                    .thenReturn(false);

            assertThatThrownBy(() ->
                            service.saveRefDef(GRP, List.of(defRow(RowState.C, "TYPO", "오타"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.REF_CD_UNKNOWN);
        }

        @Test
        @DisplayName("이름이 비면 거부한다 — 컬럼 헤더가 비면 그리드를 읽을 수 없다")
        void refNameIsRequired() {
            when(codes.existsById(new SysCodeId(SysCodeGrpRef.REF_CD_GROUP, "PARENT")))
                    .thenReturn(true);

            assertThatThrownBy(() ->
                            service.saveRefDef(GRP, List.of(defRow(RowState.C, "PARENT", " "))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CodeErrorCode.REQUIRED);
        }

        @Test
        @DisplayName("삭제는 값 → 정의 순서다 — 그래서 게이트가 아니라 확인이다")
        void deleteRemovesValuesFirst() {
            SysCodeGrpRefId id = new SysCodeGrpRefId(GRP, "PARENT");
            when(refDefs.findById(id))
                    .thenReturn(Optional.of(SysCodeGrpRef.created(GRP, "PARENT", "상위", null)));

            service.saveRefDef(GRP, List.of(defRow(RowState.D, "PARENT", null)));

            InOrder order = inOrder(refValues, refDefs);
            order.verify(refValues).deleteByGrpCdAndRefCd(GRP, "PARENT");
            order.verify(refDefs).delete(any(SysCodeGrpRef.class));
        }
    }
}
