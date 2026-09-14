import org.gradle.kotlin.dsl.extra

rootProject.name = "ai-agent"

// 모듈 구성과 의존 방향은 aidd-guide/standard/backend/packages.md §1 이 단일 원본이다.

/**
 * local 프로파일인가 — sample 모듈 포함 여부를 가르는 유일한 기본 판정이다(ARCH-027).
 *
 * settings 가 project 보다 먼저 평가되므로 여기가 원본이고, `bootstrap/build.gradle.kts` 는
 * `gradle.extra` 로 **같은 값을 읽는다.** 태스크 이름으로 추정하지 않는다 — `bootRun` 은
 * local뿐 아니라 개발·운영 프로파일도 실행할 수 있고, 축약 태스크명도 같은 태스크가 된다.
 *
 * 프로파일을 주지 않는 일반 build·check·bootJar는 제품 변형이다. 서버를 실제로 띄우는
 * bootRun은 bootstrap 태스크가 `-Pprofile` 누락을 태스크 실행 전에 거부한다.
 */
val isLocalProfile = providers.gradleProperty("profile")
    .map(String::trim)
    .map { it == "local" }
    .getOrElse(false)
gradle.extra["isLocalProfile"] = isLocalProfile

/** local 프로파일만 sample 포함이 기본이다. 명시한 옵션은 이 기본값보다 우선한다. */
val includeSample = providers.gradleProperty("includeSample")
    .map(String::toBoolean)
    .getOrElse(isLocalProfile)
gradle.extra["includeSample"] = includeSample

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
