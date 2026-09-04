package com.ordinary.backoffice.domain.user.repository;

import com.ordinary.backoffice.domain.user.entity.SysUserIpAllow;
import com.ordinary.backoffice.domain.user.entity.SysUserIpAllowId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysUserIpAllowRepository
        extends JpaRepository<SysUserIpAllow, SysUserIpAllowId> {

    /**
     * 한 사용자의 허용 대역 전부 — <b>꺼진 것도 낸다</b>.
     *
     * <p>화면이 켜고 끄는 곳이므로 꺼진 행이 보여야 다시 켤 수 있다. 판정이 쓸 때는
     * {@code USE_YN} 을 보고 거르지만(AUTH-08 핸들러가 설 때) 그것은 <b>다른 질문</b>이다.
     */
    List<SysUserIpAllow> findByUserIdOrderByIpCidrAsc(String userId);
}
