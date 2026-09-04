package com.aiagent.support.lock;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 이 프로세스의 식별자 — sys/batch.md. <b>세 테이블이 같은 값을 쓴다.</b>
 *
 * <p>{@code SYS_DATA_LOCK} · {@code SYS_BATCH_HISTORY} · {@code SYS_NOTI_OUTBOX} 가 모두 이
 * 컬럼을 갖는다. 셋이 다른 규칙을 쓰면 <i>"락을 잡은 노드"</i> 와 <i>"배치를 실행한 노드"</i>
 * 를 대조할 수 없으므로 <b>여기 하나가 값을 만든다</b>.
 *
 * <h2>요구가 둘이고 서로 당긴다</h2>
 *
 * <table>
 *   <tr><td><b>호스트를 알아볼 수 있어야 한다</b></td>
 *       <td>사람이 이력 화면에서 읽는다 — 랜덤 문자열이면 <i>어느 서버인가</i> 에 답하지 못한다</td></tr>
 *   <tr><td><b>프로세스가 바뀌면 달라야 한다</b></td>
 *       <td>재기동한 노드가 <b>옛 프로세스의 락을 자기 것으로 오인</b>하면 안 된다</td></tr>
 * </table>
 *
 * <p>호스트명만 쓰면 둘째가 깨지고 기동마다 UUID 를 만들면 첫째가 깨진다. <b>{@code
 * {호스트}#{기동}}</b> 이 둘을 함께 만족한다 — 앞은 사람이 읽고 뒤가 프로세스를 가른다.
 *
 * <p><b>설정으로 덮을 수 있다</b>({@code app.node.id}) — 컨테이너에서 호스트명이 랜덤 해시가
 * 되기 때문이다. 생성 규칙의 확정은 backend/persistence.md 의 미결이며(Phase 7), 여기서 고정한 것은
 * <b>형태와 그 근거 둘</b>이다.
 */
@Component
public class NodeId {

    /** {@code SYS_DATA_LOCK.NODE_ID} 등 세 컬럼이 {@code VARCHAR(100)} 이다 — sys/batch.md. */
    private static final int MAX_LENGTH = 100;

    private final String value;

    public NodeId(@Value("${app.node.id:}") String configured) {
        this.value = configured == null || configured.isBlank() ? generate() : trim(configured);
    }

    public String value() {
        return value;
    }

    /**
     * {@code {호스트}#{기동}}.
     *
     * <p><b>호스트명을 못 읽어도 던지지 않는다.</b> 이 값은 <b>진단용</b>이며(sys/batch.md) 락의
     * 판정에는 쓰이지 않는다 — 여기서 기동을 실패시키면 <i>사람이 읽기 편하라고 둔 컬럼</i>
     * 때문에 서버가 안 뜬다. 대신 {@code unknown} 이라고 적어 <b>그 사실이 이력에 남는다</b>.
     */
    private static String generate() {
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            host = "unknown";
        }
        // 기동을 가르는 것이 목적이라 8자면 충분하다 — 100자 안에 호스트명이 들어가야 한다.
        return trim(host + "#" + UUID.randomUUID().toString().substring(0, 8));
    }

    private static String trim(String raw) {
        return raw.length() <= MAX_LENGTH ? raw : raw.substring(0, MAX_LENGTH);
    }
}
