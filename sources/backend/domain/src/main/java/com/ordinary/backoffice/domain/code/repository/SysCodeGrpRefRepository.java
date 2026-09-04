package com.ordinary.backoffice.domain.code.repository;

import com.ordinary.backoffice.domain.code.entity.SysCodeGrpRef;
import com.ordinary.backoffice.domain.code.entity.SysCodeGrpRefId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysCodeGrpRefRepository extends JpaRepository<SysCodeGrpRef, SysCodeGrpRefId> {

    /** 정의 목록 — <b>컬럼 집합</b>이다. 하단 저장이 이 목록을 루프한다(63 §2.4). */
    List<SysCodeGrpRef> findByGrpCdOrderByRefCdAsc(String grpCd);
}
