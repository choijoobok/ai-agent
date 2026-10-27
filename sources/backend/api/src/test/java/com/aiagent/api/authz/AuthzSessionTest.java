// @feat FEAT-502
package com.aiagent.api.authz;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.authz.EffectiveAuthority;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.util.SerializationUtils;

class AuthzSessionTest {
    private final EffectiveAuthority authority = new EffectiveAuthority(Set.of(), LocalDate.of(2026, 10, 27));

    @Test
    void legacyDirtyIsRecalculatedOnceAndThenNewInvalidationIsDetected() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthzSession.AUTHORITY, authority);
        session.setAttribute(AuthzSession.DIRTY, true);
        assertThat(AuthzSession.read(session)).isEqualTo(authority);
        assertThat(AuthzSession.isDirty(session)).isTrue();

        AuthzSession.write(session, authority, AuthzSession.revision(session));
        assertThat(AuthzSession.isDirty(session)).isFalse();
        AuthzSession.markDirty(session);
        assertThat(AuthzSession.isDirty(session)).isTrue();
    }

    @Test
    void legacyCleanAuthorityAlsoRequiresOneRecalculation() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthzSession.AUTHORITY, authority);
        assertThat(AuthzSession.isDirty(session)).isTrue();
        AuthzSession.write(session, authority, AuthzSession.revision(session));
        assertThat(AuthzSession.isDirty(session)).isFalse();
    }

    @Test
    void loginSnapshotRequiresFirstRequestRecalculationAndSurvivesSerialization() {
        MockHttpSession session = new MockHttpSession();
        AuthzSession.initialize(session, authority);
        assertThat(AuthzSession.isDirty(session)).isTrue();
        AuthzSession.write(session, authority, AuthzSession.revision(session));
        session.setAttribute(AuthzSession.AUTHORITY,
                SerializationUtils.deserialize(SerializationUtils.serialize(session.getAttribute(AuthzSession.AUTHORITY))));
        assertThat(AuthzSession.read(session)).isEqualTo(authority);
        assertThat(AuthzSession.isDirty(session)).isFalse();
    }
}
