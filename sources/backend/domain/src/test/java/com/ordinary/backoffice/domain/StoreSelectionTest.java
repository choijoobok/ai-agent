package com.ordinary.backoffice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.ordinary.backoffice.domain.lock.DbLockStore;
import com.ordinary.backoffice.domain.lock.repository.SysDataLockRepository;
import com.ordinary.backoffice.domain.progress.JdbcJobProgressStore;
import com.ordinary.backoffice.domain.progress.JobProgressStore;
import com.ordinary.backoffice.domain.progress.repository.SysJobProgressRepository;
import com.ordinary.backoffice.support.lock.LockStore;
import com.ordinary.backoffice.support.lock.NodeId;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.domain.AuditorAware;

/**
 * 저장소를 설정이 고른다 — 30 §6.1 · 31 §3.
 *
 * <p><b>고를 것이 하나씩인데 왜 설정으로 두는가.</b> 목적은 고르는 것이 아니라 <b>모르는
 * 값을 조용히 삼키지 않는 것</b>이다. {@code redis} 라 적었는데 DB 로 떨어지면 락도 진행률도
 * <i>동작은 하므로</i> 아무 증상이 없고, 배포는 Redis 를 쓰는 줄 안 채로 돈다 — 그 착각은
 * 한참 뒤 엉뚱한 자리에서만 드러난다.
 *
 * <p>그래서 여기서 세는 것은 둘이다.
 *
 * <ul>
 *   <li><b>설정이 없으면 기본 구현이 뜬다</b> — 기본값이 문서가 아니라 코드에 있다
 *   <li><b>구현이 없는 값을 적으면 빈이 없다</b> — 받는 자리가 실패해 <b>기동이 죽는다</b>
 * </ul>
 */
class StoreSelectionTest {

    @Nested
    @DisplayName("진행률 저장소 — app.progress.store")
    class Progress {

        private final ApplicationContextRunner context = new ApplicationContextRunner()
                .withBean(SysJobProgressRepository.class, () -> mock(SysJobProgressRepository.class))
                .withBean(Clock.class, Clock::systemUTC)
                .withUserConfiguration(JdbcJobProgressStore.class);

        @Test
        @DisplayName("설정이 없으면 jdbc 다 — 템플릿의 기본 가정이 다중화·Redis 없음이다")
        void defaultsToJdbc() {
            context.run(loaded -> assertThat(loaded).hasSingleBean(JobProgressStore.class));
        }

        @Test
        @DisplayName("jdbc 라 적으면 그것이다")
        void jdbcWhenAsked() {
            context.withPropertyValues("app.progress.store=jdbc")
                    .run(loaded -> assertThat(loaded).hasSingleBean(JobProgressStore.class));
        }

        /*
          <b>여기가 이 파일의 존재 이유다.</b> 구현이 없는 값을 삼키면 그 배포는 자기가
          무엇을 쓰는지 모른 채 돈다 — 빈이 없어야 받는 자리가 터진다.
        */
        @Test
        @DisplayName("구현이 없는 값이면 빈이 없다 — 조용히 jdbc 로 떨어지지 않는다")
        void unknownValueLeavesNoBean() {
            context.withPropertyValues("app.progress.store=redis")
                    .run(loaded -> assertThat(loaded).doesNotHaveBean(JobProgressStore.class));
        }
    }

    @Nested
    @DisplayName("락 저장소 — app.lock.store")
    class Lock {

        private final ApplicationContextRunner context = new ApplicationContextRunner()
                .withBean(SysDataLockRepository.class, () -> mock(SysDataLockRepository.class))
                .withBean(EntityManager.class, () -> mock(EntityManager.class))
                .withBean(NodeId.class, () -> mock(NodeId.class))
                .withBean(AuditorAware.class, () -> mock(AuditorAware.class))
                .withBean(Clock.class, Clock::systemUTC)
                .withUserConfiguration(DbLockStore.class);

        @Test
        @DisplayName("설정이 없으면 db 다 — Redis 없는 배포에서도 락은 동작해야 한다")
        void defaultsToDb() {
            context.run(loaded -> assertThat(loaded).hasSingleBean(LockStore.class));
        }

        @Test
        @DisplayName("구현이 없는 값이면 빈이 없다 — 락이 걸리는 것처럼 보이면서 다른 것을 쓰지 않는다")
        void unknownValueLeavesNoBean() {
            context.withPropertyValues("app.lock.store=redis")
                    .run(loaded -> assertThat(loaded).doesNotHaveBean(LockStore.class));
        }
    }
}
