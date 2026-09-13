rootProject.name = "ai-agent"

// 모듈 구성과 의존 방향은 aidd-guide/standard/backend/packages.md §1 이 단일 원본이다.
include(
    "backend:core",
    "backend:support",
    "backend:domain",
    "backend:api",
    "backend:modules:system",
    "backend:modules:sample",
    "backend:bootstrap",
)

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
