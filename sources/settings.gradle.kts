rootProject.name = "ordinary-backoffice"

// 모듈 구성과 의존 방향은 llm-guide/06-framework/backend/_study/architecture.md §1 이 단일 원본이다.
include(
    "backend:core",
    "backend:support",
    "backend:domain",
    "backend:api",
    "backend:bootstrap",
)

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
