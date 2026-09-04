package com.aiagent.domain.message.repository;

import com.aiagent.domain.message.MessageRow;
import com.aiagent.domain.message.entity.SysMessage;
import com.aiagent.domain.message.entity.SysMessageId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysMessageRepository extends JpaRepository<SysMessage, SysMessageId> {

    /**
     * 요청 언어와 기본 언어를 <b>한 번에</b> 읽는다 — 폴백(43 §7.3)을 메모리에서 접기 위해서다.
     * 언어마다 조회하면 왕복이 둘이고, SQL 로 접으면 벤더별 문법이 갈린다(db-portability.md §4).
     *
     * <p><b>{@code MSG_VAL IS NULL} 인 행은 아예 실어 오지 않는다.</b> 미번역은 <i>"값이
     * 비었다"</i> 이므로(ADR-0023 §3) 없는 것과 같게 다뤄야 폴백이 한 갈래로 돈다 — 실어 오면
     * 맵에 {@code null} 이 들어가 <i>"키가 있는데 값이 없다"</i> 는 세 번째 상태가 생긴다.
     */
    @Query(
            """
            select new com.aiagent.domain.message.MessageRow(
                       m.msgKey, m.langCd, m.msgVal, k.useScope)
              from SysMessage m, SysMessageKey k
             where k.msgKey = m.msgKey
               and m.langCd in :langs
               and m.msgVal is not null
            """)
    List<MessageRow> findRows(@Param("langs") Collection<String> langs);

    /** 관리 화면의 저장이 한 키의 현재 값을 통째로 읽는다 — 63 §3.2 의 {@code values} 는 전량이다. */
    List<SysMessage> findByMsgKey(String msgKey);

    /**
     * 키 삭제의 앞 단계 — <b>값 → 키 순서</b>여야 FK 가 거부하지 않는다(63 §3.2).
     *
     * <p>파생 삭제라 조회 후 삭제이며 언어 수만큼의 행이다. 벌크 {@code @Modifying} 으로
     * 두면 영속성 컨텍스트가 같은 트랜잭션 안에서 낡은 것을 들고 있게 된다.
     */
    void deleteByMsgKey(String msgKey);
}
