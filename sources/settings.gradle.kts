rootProject.name = "ai-agent"

// 모듈 구성과 의존 방향은 aidd-guide/standard/backend/packages.md §1 이 단일 원본이다.
val includeSample = providers.gradleProperty("includeSample")
    .map(String::toBoolean)
    .getOrElse(false)

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
