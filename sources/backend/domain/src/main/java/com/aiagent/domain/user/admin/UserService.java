package com.aiagent.domain.user.admin;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowTx;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.domain.user.service.PasswordHistory;
import com.aiagent.domain.user.service.TemporaryPasswords;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code USER_MGMT} 의 쓰기 — screen/admin/system/user/requirements.md. <b>경로가 넷이고 각자 자기 컬럼만 쓴다.</b>
 *
 * <table>
 *   <tr><td>{@link #save}</td><td>셀 편집 — <b>관리자 축</b>({@code USE_YN} · 사용 기간 · 이름 · 이메일 · 언어)</td></tr>
 *   <tr><td>{@link #unlock}</td><td>{@code LOCK_YN} · {@code LOCK_DTM} · {@code LOGIN_FAIL_CNT}</td></tr>
 *   <tr><td>{@link #releaseDormant}</td><td>{@code DORMANT_YN}</td></tr>
 *   <tr><td>{@link #resetPassword}</td><td>{@code PWD} · {@code PWD_CHG_DTM} · {@code PWD_INIT_YN}</td></tr>
 * </table>
 *
 * <h2>메서드가 넷인 것이 sys/user-role.md 규칙 3의 집행이다</h2>
 *
 * <p>계정을 못 쓰게 하는 넷은 <b>서로 덮지 않아야 한다</b>. 화면에서는 컬럼별 편집 가능
 * 여부가 그것을 지키고(screen/admin/system/user/requirements.md) 여기서는 <b>메서드 경계</b>가 지킨다 — 하나의 저장 메서드가
 * 넷을 다 받으면 <i>"잠금을 풀려다 사용 기간을 지웠다"</i> 가 셀 하나 차이로 일어난다.
 *
 * <p><b>잠금 해제가 {@code EXECUTE} 가 아니라 {@code SAVE} 인 이유</b>가 여기서 보인다
 * (screen/admin/system/user/requirements.md). 기준은 <i>버튼이 위험해 보이는가</i> 가 아니라 <b>우리 테이블의 컬럼을
 * 쓰는가</b>이고, 이 넷은 전부 {@code SYS_USER} 를 쓴다 — 그래서 경로가 전부 {@code save*} 다.
 *
 * <h2>삭제가 없다</h2>
 *
 * <p>{@code SYS_USER} 는 물리 삭제를 하지 않는다(sys/user-role.md · USER-02). 화면에 삭제 컬럼이
 * 아예 없고(screen/admin/system/user/requirements.md) 여기서도 {@code D} 는 <b>거부</b>다 — 이력 테이블이 {@code USER_ID} 를
 * <b>값으로</b> 갖고 있어(sys/user-role.md) 행을 지우면 <b>지난 이력의 주인이 사라진다</b>.
 *
 * <h2>세션을 건드리지 않는다</h2>
 *
 * <p>{@code RoleService} 는 유효 권한이 바뀐 사용자를 돌려주고 컨트롤러가 세션을
 * 무효화했다(backend/security.md). 여기는 그럴 것이 없다 — <b>{@code USE_YN} 은 유효 권한의 입력이 아니라
 * 로그인 체인의 것</b>이고(sys/user-role.md), 이미 로그인한 세션은 <b>다음 로그인부터</b> 막힌다
 * (screen/admin/system/user/requirements.md 이 역할 회수에 대해 같은 말을 한다). 지금 세션까지 끊고 싶으면 그것은
 * <b>다른 버튼</b>이다 — 강제 로그아웃({@code EXECUTE} · screen/admin/system/user/requirements.md).
 */
@Service
public class UserService {

    private final SysUserRepository users;
    private final PasswordHistory history;
    private final PasswordEncoder encoder;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public UserService(
            SysUserRepository users,
            PasswordHistory history,
            PasswordEncoder encoder,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.users = users;
        this.history = history;
        this.encoder = encoder;
        this.configs = configs;
        this.calendar = calendar;
    }

    // ── 셀 편집 (screen/admin/system/user/requirements.md) ────────────────────────────────────────────

    /**
     * 일괄 저장 — frontend/grid.md. <b>한 트랜잭션이다</b>(UX-14).
     *
     * <p><b>신규 행은 비밀번호를 함께 발급받는다.</b> screen/admin/system/user/requirements.md 가 <i>"저장 시 임시 비밀번호로
     * 발급되며 {@code PWD_INIT_YN='Y'} 로 들어간다"</i> 고 정했다 — 관리자가 값을 정하는
     * 자리를 두지 않은 결과이며, 그래서 <b>저장의 반환값이 있다</b>.
     *
     * @param actorId 지금 저장하는 사람 — 자기 비활성화를 막는 데만 쓴다(screen/admin/system/user/requirements.md)
     * @return 새로 만들어진 계정들의 임시 비밀번호. 수정만 했으면 빈 목록이다
     */
    @Transactional
    public List<IssuedPassword> save(List<UserSaveRow> rows, String actorId) {
        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);
        Instant now = calendar.now();

        Set<String> seen = new HashSet<>();
        List<IssuedPassword> issued = new ArrayList<>();

        RowTx.oneTxForAll(rows, row -> {
            /*
              같은 요청 안의 중복은 화면이 막지만, 막혔다고 서버가 안 봐도 되는 것은
              아니다 — 두 번째 C 의 존재 확인이 첫 번째의 flush 를 만나지 못해 조용히 덮인다.
            */
            if (!seen.add(row.userId())) {
                throw new BusinessException(
                        UserAdminErrorCode.DUPLICATE_ID,
                        "같은 요청에 같은 ID 가 둘이다 — " + row.userId(),
                        List.of(new BusinessException.FieldError(
                                "userId", "같은 ID 가 두 번 왔습니다", row.userId())));
            }
            switch (row.rowState()) {
                case C -> issued.add(create(row, policy, now));
                case U -> update(row, actorId);
                case D -> throw new BusinessException(
                        UserAdminErrorCode.DELETE_NOT_SUPPORTED,
                        "계정 삭제 요청 — " + row.userId(),
                        List.of(new BusinessException.FieldError(
                                "userId", "계정은 지울 수 없습니다 — 사용 여부를 끄세요", row.userId())));
            }
        });
        return issued;
    }

    private IssuedPassword create(UserSaveRow row, AuthPasswordProps policy, Instant now) {
        if (users.existsById(row.userId())) {
            throw new BusinessException(
                    UserAdminErrorCode.DUPLICATE_ID,
                    "이미 있다 — " + row.userId(),
                    List.of(new BusinessException.FieldError(
                            "userId", "이미 있는 사용자 ID 입니다", row.userId())));
        }
        validate(row);

        String raw = TemporaryPasswords.generate(policy.minLength(), policy.requireCharsetKinds());
        SysUser user = SysUser.builder()
                .userId(row.userId())
                .userNm(row.userNm())
                .email(row.email())
                .pwd(encoder.encode(raw))
                .validFromDt(row.validFromDt())
                .validToDt(row.validToDt())
                .localeCd(row.localeCd())
                .build();
        /*
          빌더가 {@code USE_YN='Y'} 로 고정하므로 화면이 끈 채로 만든 행을 여기서 반영한다.
          <b>빌더에 열지 않는 것</b>은 그 자리가 sys/user-role.md 의 <i>관리자 축</i> 이고, 그 축의
          유일한 표면이 {@code changeByAdmin} 이기 때문이다.
        */
        user.changeByAdmin(
                row.userNm(), row.email(), row.useYnOrTrue(),
                row.validFromDt(), row.validToDt(), row.localeCd());
        /*
          <b>이력을 남기지 않는다.</b> 옮길 <i>지금 값</i> 이 없다 — 방금 만든 계정의
          {@code PWD} 는 이 임시 비밀번호이고, 그것을 이력에 넣으면 <b>사용자가 첫 변경에서
          거절당한다</b>(재사용 금지에 걸린다).
        */
        user.resetPasswordByAdmin(user.getPwd(), calendar.now());
        users.save(user);

        return new IssuedPassword(user.getUserId(), user.getUserNm(), raw);
    }

    private void update(UserSaveRow row, String actorId) {
        SysUser user = find(row.userId());
        validate(row);

        // screen/admin/system/user/requirements.md — 그 자리에서 화면 밖으로 밀려난다. 되돌릴 사람이 그 사람 자신이다.
        if (!row.useYnOrTrue() && row.userId().equals(actorId)) {
            throw new BusinessException(
                    UserAdminErrorCode.SELF_DISABLE,
                    "자기 계정을 끄려 한다 — " + row.userId(),
                    List.of(new BusinessException.FieldError(
                            "useYn", "자기 계정은 끌 수 없습니다")));
        }
        user.changeByAdmin(
                row.userNm(), row.email(), row.useYnOrTrue(),
                row.validFromDt(), row.validToDt(), row.localeCd());
    }

    /**
     * 화면도 같은 것을 막지만 그것은 UX 다(frontend/grid.md).
     *
     * <p><b>기간의 역전을 여기서 본다.</b> 컬럼 두 개에 걸친 조건이라 셀 하나를 보는 검증으로는
     * 표현되지 않고, DB 제약으로도 걸 수 없다 — {@code CHECK} 의 문법이 벤더마다 다르다(backend/persistence.md).
     */
    private static void validate(UserSaveRow row) {
        if (row.userNm() == null || row.userNm().isBlank()) {
            throw new BusinessException(
                    UserAdminErrorCode.NAME_REQUIRED,
                    "이름이 비었다 — " + row.userId(),
                    List.of(new BusinessException.FieldError("userNm", "필수 값이 비어 있습니다")));
        }
        if (row.email() == null || row.email().isBlank()) {
            throw new BusinessException(
                    UserAdminErrorCode.EMAIL_REQUIRED,
                    "이메일이 비었다 — " + row.userId(),
                    List.of(new BusinessException.FieldError("email", "필수 값이 비어 있습니다")));
        }
        if (row.validFromDt() != null
                && row.validToDt() != null
                && row.validFromDt().isAfter(row.validToDt())) {
            throw new BusinessException(
                    UserAdminErrorCode.PERIOD_REVERSED,
                    "기간이 뒤집혔다 — " + row.validFromDt() + " ~ " + row.validToDt(),
                    List.of(new BusinessException.FieldError(
                            "validToDt",
                            "종료일이 시작일보다 빠릅니다",
                            row.validToDt().toString())));
        }
    }

    // ── 전용 API 셋 (screen/admin/system/user/requirements.md) ────────────────────────────────────────

    /**
     * 잠금 해제 — AUTH-04. <b>{@code LOCK_YN} · {@code LOCK_DTM} · {@code LOGIN_FAIL_CNT} 만
     * 쓴다</b>({@code SysUser#unlock}).
     *
     * <p><b>잠기지 않은 계정에 눌러도 실패가 아니다.</b> 상태를 다시 확인해 거절하면
     * <i>다른 사람이 방금 풀었다</i> 는 이유로 실패 모달이 뜨는데, 사용자가 원한 결과는
     * <b>이미 이뤄져 있다</b> — 그 자리에서 할 말이 없다.
     */
    @Transactional
    public void unlock(List<String> userIds) {
        for (String userId : userIds) {
            find(userId).unlock();
        }
    }

    /**
     * 휴면 해제 — screen/admin/system/user/requirements.md. <b>메일이 안 되는 환경을 위한 관리자 경로</b>다.
     *
     * <p>정상 경로는 본인의 비밀번호 재설정이며 그것이 곧 본인 재인증이다(sys/user-role.md · screen/_standalone/README.md).
     * <b>잠금은 같이 풀리지 않는다.</b>
     */
    @Transactional
    public void releaseDormant(List<String> userIds) {
        for (String userId : userIds) {
            find(userId).releaseDormant();
        }
    }

    /**
     * 임시 비밀번호 발급 — AUTH-07 · backend/security.md 체인 #5.
     *
     * <p><b>잠금을 풀지 않는다</b>(screen/admin/system/user/requirements.md). screen/_standalone/README.md 이 자기 재설정에서 같은 판단을 했다 —
     * 발송만으로 풀리면 <i>실패 5회 → 초기화 → 다시 5회</i> 가 무한 반복된다.
     *
     * <p><b>이력을 남긴다.</b> 지금 값을 {@code SYS_USER_PWD_HIST} 로 옮기므로, 사용자가
     * 강제 변경 화면에서 <b>옛 비밀번호를 그대로 다시 쓸 수 없다</b>(sys/user-role.md) — 그 경로를
     * 본인 변경에만 두면 관리자 발급이 재사용 금지를 통째로 우회한다.
     *
     * @return 발급된 값들 — <b>이 응답에만 있다</b>({@link IssuedPassword})
     */
    @Transactional
    public List<IssuedPassword> resetPassword(List<String> userIds) {
        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);
        if (!Boolean.TRUE.equals(policy.adminResetEnabled())) {
            throw new BusinessException(UserAdminErrorCode.RESET_DISABLED);
        }
        Instant now = calendar.now();

        List<IssuedPassword> issued = new ArrayList<>(userIds.size());
        for (String userId : userIds) {
            SysUser user = find(userId);
            String raw = TemporaryPasswords.generate(
                    policy.minLength(), policy.requireCharsetKinds());

            // 바꾸기 <b>전에</b> 옮긴다 — 뒤에 부르면 옮겨지는 것이 새 값이다.
            history.archive(user, policy.reuseBlockCount());
            user.resetPasswordByAdmin(encoder.encode(raw), now);

            issued.add(new IssuedPassword(user.getUserId(), user.getUserNm(), raw));
        }
        return issued;
    }

    private SysUser find(String userId) {
        return users.findById(userId)
                .orElseThrow(() -> new BusinessException(
                        UserAdminErrorCode.NOT_FOUND,
                        "없는 계정이다 — " + userId,
                        List.of(new BusinessException.FieldError(
                                "userId", "없는 계정입니다", userId))));
    }
}
