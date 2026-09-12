// @feat FEAT-501
package com.aiagent.system.domain.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.domain.user.entity.SysUserIpAllow;
import com.aiagent.domain.user.repository.SysUserIpAllowRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AllowedIpServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 12);

    @Test
    @DisplayName("TC-5011 허용 IP 행이 없으면 제한하지 않고 IPv4·IPv6 대역 일치를 허용한다")
    void emptyOrMatchingRangesAllowLogin() {
        SysUserIpAllowRepository repository = mock(SysUserIpAllowRepository.class);
        AllowedIpService service = new AllowedIpService(repository, calendar());

        when(repository.findByUserIdOrderByIpCidrAsc("kim")).thenReturn(List.of());
        assertThat(service.isAllowed("kim", "10.0.0.8")).isTrue();

        when(repository.findByUserIdOrderByIpCidrAsc("kim")).thenReturn(List.of(
                row("10.0.0.0/24", true, null, null),
                row("2001:db8::/32", true, TODAY.minusDays(1), TODAY.plusDays(1))));
        assertThat(service.isAllowed("kim", "10.0.0.8")).isTrue();
        assertThat(service.isAllowed("kim", "2001:db8::8")).isTrue();
    }

    @Test
    @DisplayName("TC-5013 비활성·기간 밖·불일치 대역만 있으면 접속을 거부한다")
    void inactiveExpiredOrDifferentRangesDenyLogin() {
        SysUserIpAllowRepository repository = mock(SysUserIpAllowRepository.class);
        when(repository.findByUserIdOrderByIpCidrAsc("kim")).thenReturn(List.of(
                row("10.0.0.0/24", false, null, null),
                row("10.0.1.0/24", true, null, TODAY.minusDays(1)),
                row("10.0.2.0/24", true, TODAY.plusDays(1), null),
                row("10.0.3.0/24", true, null, null)));

        assertThat(new AllowedIpService(repository, calendar()).isAllowed("kim", "10.0.0.8"))
                .isFalse();
    }

    @Test
    @DisplayName("TC-5011 유효 기간 양끝과 CIDR 접두 경계를 포함한다")
    void dateAndPrefixBoundariesAreInclusive() {
        SysUserIpAllowRepository repository = mock(SysUserIpAllowRepository.class);
        when(repository.findByUserIdOrderByIpCidrAsc("kim")).thenReturn(List.of(
                row("10.0.0.0/25", true, TODAY, TODAY)));
        AllowedIpService service = new AllowedIpService(repository, calendar());

        assertThat(service.isAllowed("kim", "10.0.0.0")).isTrue();
        assertThat(service.isAllowed("kim", "10.0.0.127")).isTrue();
        assertThat(service.isAllowed("kim", "10.0.0.128")).isFalse();
    }

    @Test
    @DisplayName("TC-5013 잘못된 주소·접두와 주소 계열 불일치는 실패 폐쇄한다")
    void malformedOrDifferentAddressFamiliesDenyLogin() {
        SysUserIpAllowRepository repository = mock(SysUserIpAllowRepository.class);
        AllowedIpService service = new AllowedIpService(repository, calendar());

        for (String invalid : List.of(
                "host.example/24", "10.0.0.0/33", "10.0.0.0/-1", "10.0.0.0/24/extra")) {
            when(repository.findByUserIdOrderByIpCidrAsc("kim"))
                    .thenReturn(List.of(row(invalid, true, null, null)));
            assertThat(service.isAllowed("kim", "10.0.0.8")).as(invalid).isFalse();
        }

        when(repository.findByUserIdOrderByIpCidrAsc("kim"))
                .thenReturn(List.of(row("10.0.0.0/24", true, null, null)));
        assertThat(service.isAllowed("kim", "2001:db8::8")).isFalse();
    }

    @Test
    @DisplayName("TC-5011 접두 0·1·32와 호스트 단독 표기를 정확히 판정한다")
    void zeroBitAndExactPrefixesAreHandled() {
        SysUserIpAllowRepository repository = mock(SysUserIpAllowRepository.class);
        AllowedIpService service = new AllowedIpService(repository, calendar());

        when(repository.findByUserIdOrderByIpCidrAsc("kim"))
                .thenReturn(List.of(row("0.0.0.0/0", true, null, null)));
        assertThat(service.isAllowed("kim", "203.0.113.8")).isTrue();

        when(repository.findByUserIdOrderByIpCidrAsc("kim"))
                .thenReturn(List.of(row("128.0.0.0/1", true, null, null)));
        assertThat(service.isAllowed("kim", "127.255.255.255")).isFalse();
        assertThat(service.isAllowed("kim", "128.0.0.0")).isTrue();

        when(repository.findByUserIdOrderByIpCidrAsc("kim"))
                .thenReturn(List.of(row("10.0.0.8", true, null, null)));
        assertThat(service.isAllowed("kim", "10.0.0.8")).isTrue();
        assertThat(service.isAllowed("kim", "10.0.0.9")).isFalse();
    }

    private static SysUserIpAllow row(
            String cidr, boolean useYn, LocalDate validFrom, LocalDate validTo) {
        return SysUserIpAllow.created("kim", cidr, useYn, validFrom, validTo);
    }

    private static BusinessCalendar calendar() {
        Clock fixed = Clock.fixed(Instant.parse("2026-09-12T01:00:00Z"), ZoneId.of("Asia/Seoul"));
        return new BusinessCalendar("Asia/Seoul", fixed);
    }
}
