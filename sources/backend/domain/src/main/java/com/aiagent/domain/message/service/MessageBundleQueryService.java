// @feat FEAT-505
package com.aiagent.domain.message.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.message.entity.SysCacheVersion;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 공개 번들의 버전과 DB 본문이 같은 커밋 상태인지 확인한다. */
@Service
@Transactional(readOnly = true, propagation = Propagation.NOT_SUPPORTED)
public class MessageBundleQueryService {

    private static final int MAX_READS = 3;

    private final MessageService messages;
    private final CacheVersionService versions;

    public MessageBundleQueryService(MessageService messages, CacheVersionService versions) {
        this.messages = messages;
        this.versions = versions;
    }

    /** 이전 조회의 영속성 컨텍스트를 재사용하면 전후 버전 검사가 같은 옛 값을 읽을 수 있다. */
    public Bundle get(String lang, Long clientVersion) {
        long version = versions.current(SysCacheVersion.MESSAGE);
        if (clientVersion != null && clientVersion == version) {
            return new Bundle(version, true, null);
        }
        for (int attempt = 0; attempt < MAX_READS; attempt++) {
            Map<String, String> body = messages.freshBundle(lang);
            long after = versions.current(SysCacheVersion.MESSAGE);
            if (version == after) {
                return new Bundle(version, false, body);
            }
            version = after;
        }
        throw new BusinessException(
                CommonErrorCode.CONFLICT, "메시지 번들 조회 중 변경이 반복되었습니다 — 다시 조회하세요");
    }

    public record Bundle(long version, boolean unchanged, Map<String, String> messages) {}
}
