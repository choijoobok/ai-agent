package com.aiagent.domain.config.admin;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.Condition;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchErrorCode;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.core.search.SortDir;
import com.aiagent.core.search.SortSpec;
import com.aiagent.domain.config.entity.SysConfig;
import com.aiagent.domain.config.repository.SysConfigRepository;
import com.aiagent.support.config.ConfigCatalog;
import com.aiagent.support.config.ConfigKey;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code CONFIG_MGMT} 의 조회 — screen/config/requirements.md.
 *
 * <p><b>{@code QuerySpec} 을 쓰지 않는 유일한 목록이다.</b> 그 기계는 <b>왼쪽 테이블이
 * DB 에 있을 때</b>의 것이고, 여기는 왼쪽이 <b>코드</b>다(`yml` 이 정한 키 목록). 아우터
 * 조인의 왼쪽을 SQL 로 만들 수 없으므로 조인도 필터도 정렬도 <b>메모리에서</b> 편다.
 *
 * <pre>
 * yml 이 정한 키 목록   LEFT OUTER JOIN   SYS_CONFIG   ON key
 *
 * 기본값 = yml 값                                ← 언제나 있다
 * 적용값 = COALESCE(SYS_CONFIG.CFG_VAL, 기본값)   ← 행이 없으면 기본값을 복사해 보여준다
 * </pre>
 *
 * <p><b>전건을 메모리에 올리는 것이 겁나지 않는 이유는 행 수가 코드가 정한 상수이기
 * 때문이다.</b> 스무 줄짜리 표이며 <b>사용자 데이터가 아니라서 자라지 않는다</b> — 자라려면
 * 개발자가 필드를 더해야 하고, 그때는 이 판단을 다시 볼 사람이 그 자리에 있다.
 *
 * <p><b>screen/menu/requirements.md 의 <i>미등록</i> 과 같은 구조인데 답이 다르다.</b> API 카탈로그는 없는 행을
 * 목록에 낼 수 없어 <b>빈 상태가 진단</b>이 됐다. 여기는 왼쪽 테이블이 코드에 있어서 낼 수
 * 있다 — <b>차이는 후보 집합을 아는가</b>다. 그래서 이 화면에는 그런 빈 상태가 없다.
 */
@Service
@Transactional(readOnly = true)
public class ConfigQueryService {

    /** 키와 설명을 <b>한 칸이 함께 건다</b> — sys/code.md 이 분류 컬럼 대신 고른 것이다. */
    private static final String KEYWORD = "keyword";

    /** 전 키에서 <b>도출</b>한다 — 목록을 관리하지 않는다(screen/config/requirements.md). */
    private static final String PREFIX = "prefix";

    /** {@code Y}(변경됨) · {@code N}(기본값). 판정은 <b>행의 존재</b>다(screen/config/requirements.md). */
    private static final String OVERRIDDEN = "overridden";

    /** 정렬은 키 하나만 연다 — 나머지는 값이라 <b>정렬해서 얻을 것이 없다</b>(frontend/grid.md). */
    private static final String SORT_KEY = "cfgKey";

    private final ConfigCatalog catalog;
    private final SysConfigRepository overrides;

    public ConfigQueryService(ConfigCatalog catalog, SysConfigRepository overrides) {
        this.catalog = catalog;
        this.overrides = overrides;
    }

    public PageResponse<ConfigRow> getList(SearchRequest<Void> request) {
        List<ConfigRow> rows = join();

        for (Condition condition : request.conditionsOrEmpty()) {
            rows = apply(rows, condition);
        }
        // 거른 결과는 불변 목록이다 — 제자리 정렬을 하려면 한 벌 뜬다.
        rows = new ArrayList<>(rows);
        sort(rows, request.sortsOrEmpty());

        int size = request.page().sizeOrDefault();
        int page = request.page().pageOrFirst();
        int from = Math.min(page * size, rows.size());
        int to = Math.min(from + size, rows.size());
        return PageResponse.offset(List.copyOf(rows.subList(from, to)), size, page, rows.size());
    }

    /**
     * 접두사 콤보의 후보 — screen/config/requirements.md.
     *
     * <p><b>관리하지 않는다.</b> 전 키에서 마디 단위로 도출하므로 <i>"새로 관리할 것도,
     * 어긋날 것도 없다"</i>(sys/code.md). 키를 하나 더하면 그 접두사가 <b>저절로</b> 목록에 선다.
     *
     * <p>마지막 마디는 접두사가 아니다 — {@code auth.login.fail-limit} 이 내는 것은
     * {@code auth.} 와 {@code auth.login.} 둘이며 <b>자기 자신은 아니다</b>. 자기 자신을 넣으면
     * 후보가 키 수만큼 늘어 콤보가 목록이 된다.
     */
    public List<String> prefixes() {
        var found = new TreeSet<String>();
        for (ConfigKey key : catalog.keys()) {
            int at = key.key().indexOf('.');
            while (at >= 0) {
                found.add(key.key().substring(0, at + 1));
                at = key.key().indexOf('.', at + 1);
            }
        }
        return List.copyOf(found);
    }

    // ── 아우터 조인 ──────────────────────────────────────────────────

    private List<ConfigRow> join() {
        Map<String, SysConfig> byKey = new HashMap<>();
        overrides.findAll().forEach(entity -> byKey.put(entity.getCfgKey(), entity));

        List<ConfigRow> rows = new ArrayList<>(catalog.keys().size());
        for (ConfigKey key : catalog.keys()) {
            // 오른쪽이 비어 있는 것이 정상이다 — screen/config/requirements.md.
            SysConfig override = byKey.get(key.key());
            rows.add(new ConfigRow(
                    key.key(),
                    key.defaultValue(),
                    override == null ? key.defaultValue() : override.getCfgVal(),
                    key.type(),
                    key.description(),
                    override != null,
                    override == null ? null : override.getRegId(),
                    override == null ? null : override.getRegDtm(),
                    override == null ? null : override.getModId(),
                    override == null ? null : override.getModDtm()));
        }
        return rows;
    }

    // ── 조회조건 ─────────────────────────────────────────────────────

    /**
     * 화이트리스트는 <b>셋</b>이다 — screen/config/requirements.md.
     *
     * <p>{@code QuerySpec} 이 없다고 화이트리스트까지 없는 것은 아니다. 모르는 필드는
     * <b>조용히 무시하지 않고 400</b> 이며(backend/api.md), 무시하면 화면의 오타가 <i>"조건이 안
     * 걸린다"</i> 로만 나타나 원인을 짚을 수 없다.
     */
    private static List<ConfigRow> apply(List<ConfigRow> rows, Condition condition) {
        return switch (condition.field()) {
            case KEYWORD -> rows.stream().filter(row -> keywordHit(row, condition)).toList();
            case PREFIX -> {
                String value = text(condition, Op.startsWith);
                yield rows.stream().filter(row -> row.cfgKey().startsWith(value)).toList();
            }
            case OVERRIDDEN -> {
                boolean want = "Y".equalsIgnoreCase(text(condition, Op.eq));
                yield rows.stream().filter(row -> row.overridden() == want).toList();
            }
            default -> throw new BusinessException(
                    SearchErrorCode.UNKNOWN_FIELD,
                    "화이트리스트에 없는 필드: " + condition.field());
        };
    }

    /**
     * <b>한 칸이 키와 설명을 함께 건다</b> — sys/code.md.
     *
     * <p>분류 컬럼({@code CFG_GRP_CD})을 두지 않았으므로 <i>"여러 영역에 걸치는 설정"</i> 을
     * 찾는 수단이 검색뿐이다. 설명의 원천은 메타데이터라(screen/config/requirements.md) 이 조건이 <b>DB 에 없는
     * 문자열</b>을 건다 — SQL 로는 표현할 수 없는 조건이며, 그것이 이 목록이 메모리인 또
     * 하나의 이유다.
     */
    private static boolean keywordHit(ConfigRow row, Condition condition) {
        String value = text(condition, null).toLowerCase(Locale.ROOT);
        return matches(row.cfgKey(), value, condition.op())
                || matches(row.cfgDesc(), value, condition.op());
    }

    private static boolean matches(String target, String value, Op op) {
        if (target == null) {
            return false;
        }
        String lower = target.toLowerCase(Locale.ROOT);
        return switch (op) {
            case eq -> lower.equals(value);
            case startsWith -> lower.startsWith(value);
            case contains -> lower.contains(value);
            case endsWith -> lower.endsWith(value);
            default -> throw new BusinessException(
                    SearchErrorCode.OP_TYPE_MISMATCH, "키·설명 조건은 문자열 비교만 받는다 — " + op);
        };
    }

    /** 값이 없는 연산자({@code isNull} 계열)는 이 화면에 없다 — 셋 다 값을 받는다. */
    private static String text(Condition condition, Op required) {
        if (required != null && condition.op() != required) {
            throw new BusinessException(
                    SearchErrorCode.OP_TYPE_MISMATCH,
                    condition.field() + " 조건은 " + required + " 만 받는다 — " + condition.op());
        }
        if (condition.value() == null) {
            throw new BusinessException(
                    SearchErrorCode.INVALID_VALUE, "값이 없다 — 필드 " + condition.field());
        }
        return condition.value().toString();
    }

    // ── 정렬 ─────────────────────────────────────────────────────────

    /**
     * 기본은 <b>키 오름차순</b>이다.
     *
     * <p>tie-breaker 를 붙이지 않는다 — {@code cfgKey} 가 PK 라 이미 유일하다.
     */
    private static void sort(List<ConfigRow> rows, List<SortSpec> sorts) {
        Comparator<ConfigRow> order = Comparator.comparing(ConfigRow::cfgKey);
        for (SortSpec sort : sorts) {
            if (!SORT_KEY.equals(sort.field())) {
                throw new BusinessException(
                        SearchErrorCode.NOT_SORTABLE, "정렬 불가 필드: " + sort.field());
            }
            order = sort.dir() == SortDir.desc ? order.reversed() : order;
        }
        rows.sort(order);
    }
}
