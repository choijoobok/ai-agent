package com.aiagent.domain.authz.role;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowErrors;
import com.aiagent.domain.authz.entity.SysRole;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysRoleRepository;
import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code ROLE_MGMT} 의 저장 — screen/role/requirements.md. <b>역할 자체의 생애를 다룬다.</b>
 *
 * <p>만들고 · 이름을 바꾸고 · 끄고 · 지운다. 권한을 붙이는 것은 {@link RoleAuthService}이고
 * 역할을 사람에게 주는 것은 {@code USER_MGMT}(screen/user/requirements.md)다 — <b>셋이 각자 다른 테이블을 쓴다.</b>
 *
 * <h2>삭제 게이트가 처음 실물이 된다 — 자식 둘, 디테일 하나</h2>
 *
 * frontend/grid.md 는 <i>"디테일이 전부 도착한 뒤 판정"</i> 이라고만 적었다. <b>디테일이 자식 전부를
 * 보여주지 않는 화면</b>이 여기서 처음 나온다 — {@code SYS_USER_ROLE} 은 하단 pane 이 보여
 * 주지만 {@code SYS_ROLE_MENU_AUTH} 는 <b>이 화면에 디테일이 없다</b>(편집은 §2 다).
 * 마스터의 건수 컬럼이 그 자리를 대신하고(screen/role/requirements.md), 여기서 <b>한 번 더 센다</b>.
 *
 * <p><b>화면이 미리 막는 것은 저장 시점의 실패를 조회 시점에 알리는 일이지 보증이 아니다.</b>
 * 판정과 저장 사이에 누가 부여를 만들 수 있으므로 여기서 다시 세고, 그래도 남는 창은 FK 가
 * 닫는다(screen/menu/requirements.md).
 *
 * <h2>세션 무효화는 <b>부르는 쪽</b>이 한다</h2>
 *
 * {@code USE_YN} 을 끄면 보유자 전원의 유효 권한이 바뀐다(backend/security.md). 그 사람들의 세션에
 * {@code authzDirty} 를 세워야 하는데 <b>세션은 도메인이 아는 것이 아니다</b>(backend/packages.md) —
 * 그래서 이 메서드는 <b>영향받은 사용자 ID 를 돌려주고</b>, 컨트롤러가 그것을 세션 저장소에
 * 전한다. 도메인이 세션 레포지토리를 들면 계층이 뒤집힌다.
 *
 * <p><b>이름만 고친 저장에서는 비어 있다.</b> 유효 권한이 바뀌지 않았으므로 재계산을 시킬
 * 이유가 없고, 시키면 로그인한 전원이 다음 요청에서 쓸데없이 계산한다.
 */
@Service
public class RoleService {

    private final SysRoleRepository roles;
    private final SysUserRoleRepository grants;
    private final SysRoleMenuAuthRepository auths;

    public RoleService(
            SysRoleRepository roles,
            SysUserRoleRepository grants,
            SysRoleMenuAuthRepository auths) {
        this.roles = roles;
        this.grants = grants;
        this.auths = auths;
    }

    /**
     * 일괄 저장 — frontend/grid.md. <b>한 트랜잭션이다</b>(UX-14).
     *
     * @return 유효 권한이 바뀐 사용자들 — 컨트롤러가 세션을 무효화한다
     */
    @Transactional
    public Set<String> save(List<RoleSaveRow> rows) {
        Set<String> seen = new HashSet<>();
        Set<String> affected = new LinkedHashSet<>();

        RowErrors.each(rows, row -> {
            /*
              같은 요청 안의 중복은 화면이 막지만, 막혔다고 서버가 안 봐도 되는 것은 아니다 —
              두 번째 C 의 존재 확인이 첫 번째의 flush 를 만나지 못해 조용히 덮인다.
            */
            if (!seen.add(row.roleId())) {
                throw duplicate(row.roleId());
            }
            switch (row.rowState()) {
                case C -> create(row);
                case U -> affected.addAll(update(row));
                case D -> affected.addAll(delete(row));
            }
        });
        return affected;
    }

    /**
     * 신규 — <b>보유자가 없으므로 무효화할 세션도 없다</b>.
     *
     * <p>부여는 {@code USER_MGMT} 의 일이고 권한은 §2 의 일이라, 방금 만든 역할은 <b>아무에게도
     * 아무것도 주지 않는다</b>. screen/role/requirements.md 의 {@code defaults} 가 {@code useYn: 'Y'} 하나뿐인
     * 이유이기도 하다 — 켜 두어도 영향이 없다.
     */
    private void create(RoleSaveRow row) {
        requireName(row);
        if (roles.existsById(row.roleId())) {
            throw duplicate(row.roleId());
        }
        roles.save(SysRole.created(
                row.roleId(), row.roleNm(), row.roleDesc(), row.useYnOrTrue()));
    }

    /**
     * 수정 — <b>{@code USE_YN} 이 바뀐 경우에만</b> 보유자를 돌려준다.
     *
     * <p>{@code USE_YN} 은 유효 권한 계산의 <b>입력 필터</b>다(backend/security.md ②) — 끄면 이 역할의 권한이
     * 합집합에 들어가지 않고, 켜면 다시 들어온다. <b>양방향 모두 재계산이 필요하다</b>:
     * screen/role/requirements.md 이 <i>"켜는 방향에는 경고가 없다"</i> 고 한 것은 <b>확인 문구</b>의 이야기이지
     * 세션의 이야기가 아니다. 켜고서 반영이 안 되면 <i>"켰는데 왜 안 되나"</i> 가 된다.
     *
     * <p>이름·설명만 바꾼 저장은 <b>빈 집합</b>이다 — 유효 권한이 그것을 보지 않는다.
     */
    private Set<String> update(RoleSaveRow row) {
        requireName(row);
        SysRole role = require(row.roleId());
        boolean flipped = !Boolean.valueOf(row.useYnOrTrue()).equals(role.getUseYn());

        role.apply(row.roleNm(), row.roleDesc(), row.useYnOrTrue());
        return flipped ? Set.copyOf(grants.findUserIdsByRoleId(row.roleId())) : Set.of();
    }

    /**
     * 삭제 — <b>게이트를 통과하는 역할은 한 번도 쓰이지 않은 것뿐이다</b>(screen/role/requirements.md).
     *
     * <p>그것이 정확히 <i>잘못 만든 역할</i> 이며, <b>쓰인 역할을 지우는 길은 없고 그것이
     * 의도다</b> — 지우면 <i>누가 무슨 역할을 가졌었나</i> 가 사라진다(sys/menu.md).
     *
     * <p><b>막는 것은 보유 인원이지 유효 인원이 아니다.</b> 만료된 부여도
     * {@code SYS_USER_ROLE} 행이며 <b>FK 는 날짜를 보지 않는다</b> — 유효 인원이 {@code 0} 인데
     * 삭제가 막히는 것이 정상이고, 그래서 화면이 컬럼을 둘 다 둔다.
     *
     * <p>돌려줄 것이 없다 — 보유자가 {@code 0} 명이어야 여기 닿는다.
     */
    private Set<String> delete(RoleSaveRow row) {
        SysRole role = require(row.roleId());
        long holders = grants.countByRoleId(row.roleId());
        long authorities = auths.countByRoleId(row.roleId());

        if (holders > 0 || authorities > 0) {
            throw new BusinessException(
                    RoleErrorCode.NOT_DELETABLE,
                    "보유 " + holders + "명 · 권한 " + authorities + "건이 남아 있다 — " + row.roleId(),
                    List.of(new BusinessException.FieldError(
                            "roleId", "보유 사용자나 권한이 있어 삭제할 수 없습니다", row.roleId())));
        }
        roles.delete(role);
        return Set.of();
    }

    private void requireName(RoleSaveRow row) {
        if (row.roleNm() == null || row.roleNm().isBlank()) {
            throw new BusinessException(
                    RoleErrorCode.NAME_REQUIRED,
                    "역할명이 비었다 — " + row.roleId(),
                    List.of(new BusinessException.FieldError("roleNm", "역할명은 필수입니다")));
        }
    }

    private SysRole require(String roleId) {
        return roles.findById(roleId)
                .orElseThrow(() -> new BusinessException(
                        RoleErrorCode.NOT_FOUND,
                        "없는 역할이다 — " + roleId,
                        List.of(new BusinessException.FieldError(
                                "roleId", "없는 역할입니다", roleId))));
    }

    private BusinessException duplicate(String roleId) {
        return new BusinessException(
                RoleErrorCode.DUPLICATE_ID,
                "이미 있는 역할 ID 다 — " + roleId,
                List.of(new BusinessException.FieldError(
                        "roleId", "이미 있는 역할 ID 입니다", roleId)));
    }
}
