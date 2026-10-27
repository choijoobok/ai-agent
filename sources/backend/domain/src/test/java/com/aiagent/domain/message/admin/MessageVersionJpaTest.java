// @feat FEAT-505
package com.aiagent.domain.message.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import jakarta.persistence.EntityManagerFactory;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.support.TransactionTemplate;

/** DB UPDATE가 현재 버전에 더하고, 값 저장과 같은 트랜잭션으로 롤백되는지 실제 JPA로 검사한다. */
class MessageVersionJpaTest {

    private LocalContainerEntityManagerFactoryBean factory;
    private SysCacheVersionRepository versions;
    private TransactionTemplate transactions;

    @BeforeEach
    void setUp() {
        factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(
                "jdbc:h2:mem:message-version-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", ""));
        factory.setManagedTypes(PersistenceManagedTypes.of(SysCacheVersion.class.getName()));
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop"));
        factory.afterPropertiesSet();
        EntityManagerFactory entityManagers = factory.getObject();
        versions = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(entityManagers))
                .getRepository(SysCacheVersionRepository.class);
        transactions = new TransactionTemplate(new JpaTransactionManager(entityManagers));
    }

    @AfterEach
    void tearDown() {
        if (factory != null) {
            factory.destroy();
        }
    }

    @Test
    @DisplayName("TC-5056 실제 JPA의 두 동시 트랜잭션이 커밋되면 버전은 두 번 증가한다")
    void concurrentCommittedIncrementsAreNotLost() throws Exception {
        initialize();
        CyclicBarrier startTogether = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> incrementTogether(startTogether));
            var second = executor.submit(() -> incrementTogether(startTogether));
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        }

        assertThat(current()).isEqualTo(3L);
    }

    @Test
    @DisplayName("TC-5056 값 저장이 롤백되면 같은 트랜잭션의 원자 버전 증가도 롤백된다")
    void rolledBackSaveDoesNotAdvanceTheVersion() {
        initialize();

        transactions.executeWithoutResult(status -> {
            versions.advance(SysCacheVersion.MESSAGE, Instant.now());
            status.setRollbackOnly();
        });

        assertThat(current()).isEqualTo(1L);
    }

    @Test
    @DisplayName("TC-5051 버전 시드가 없으면 최초 저장이 버전 1을 생성한다")
    void missingVersionIsInitialized() {
        transactions.executeWithoutResult(status -> versions.advance(SysCacheVersion.MESSAGE, Instant.now()));

        assertThat(current()).isEqualTo(1L);
    }

    private void initialize() {
        transactions.executeWithoutResult(status ->
                versions.saveAndFlush(SysCacheVersion.started(SysCacheVersion.MESSAGE, Instant.EPOCH)));
    }

    private long current() {
        return transactions.execute(status -> versions.findById(SysCacheVersion.MESSAGE).orElseThrow().getVersion());
    }

    private void incrementTogether(CyclicBarrier startTogether) {
        transactions.executeWithoutResult(status -> {
            try {
                startTogether.await(5, TimeUnit.SECONDS);
            } catch (Exception error) {
                throw new IllegalStateException("동시 버전 증가 시험을 시작하지 못했습니다", error);
            }
            versions.advance(SysCacheVersion.MESSAGE, Instant.now());
        });
    }
}
