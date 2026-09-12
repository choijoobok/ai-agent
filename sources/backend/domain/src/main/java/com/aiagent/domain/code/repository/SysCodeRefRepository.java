package com.aiagent.domain.code.repository;

import com.aiagent.domain.code.entity.SysCodeRef;
import com.aiagent.domain.code.entity.SysCodeRefId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysCodeRefRepository extends JpaRepository<SysCodeRef, SysCodeRefId> {

    /** 한 코드의 참조값 전량 — 저장이 정의 목록과 맞대 본다(screen/admin/system/code/requirements.md). */
    List<SysCodeRef> findByGrpCdAndDtlCd(String grpCd, String dtlCd);

    /**
     * 정의 하나에 딸린 값들 — <b>정의 삭제의 확인 문구가 세는 것</b>이자 그 삭제가 먼저
     * 지우는 것이다(screen/admin/system/code/requirements.md). 값 → 정의 순서면 FK 가 거부하지 않는다.
     */
    List<SysCodeRef> findByGrpCdAndRefCd(String grpCd, String refCd);

    long countByGrpCdAndRefCd(String grpCd, String refCd);

    /** 코드 삭제가 먼저 지우는 것 — 참조값은 <b>그 행의 파생</b>이라 함께 사라진다(screen/admin/system/code/requirements.md). */
    void deleteByGrpCdAndDtlCd(String grpCd, String dtlCd);

    void deleteByGrpCdAndRefCd(String grpCd, String refCd);
}
