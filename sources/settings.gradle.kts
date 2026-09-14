import org.gradle.kotlin.dsl.extra

rootProject.name = "ai-agent"

// 모듈 구성과 의존 방향은 aidd-guide/standard/backend/packages.md §1 이 단일 원본이다.

/**
 * 이 실행이 `bootRun` 을 부르는가 — **로컬 기동의 기본값을 가르는 유일한 판정이다.**
 *
 * settings 가 project 보다 먼저 평가되므로 여기가 원본이고, `bootstrap/build.gradle.kts` 는
 * `gradle.extra` 로 **같은 값을 읽는다.** 같은 식을 두 곳에 적으면 한쪽만 고쳐져 모듈은
 * 빠졌는데 리소스는 들어가는 어긋남이 난다 — 2026-09-14 에 실제로 한 번 그랬다.
 */
val isBootRun = gradle.startParameter.taskNames.any { it.substringAfterLast(':') == "bootRun" }
gradle.extra["isBootRun"] = isBootRun

/** 로컬 기동은 곧 local 변형이다(ADR-009). `build`·`bootJar`·`check` 의 기본값은 그대로 `false`. */
val includeSample = providers.gradleProperty("includeSample")
    .map(String::toBoolean)
    .getOrElse(isBootRun)

include(
    "backend:core",
    "backend:support",
    "backend:domain",
    "backend:api",
    "backend:modules:system",
    "backend:bootstrap",
)

if (includeSample) {
    include("backend:modules:sample")
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
