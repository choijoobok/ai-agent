// core — 도메인 비종속 커널. 다른 모듈을 참조하지 않는다(21 §1).
// 프레임워크 의존을 최소로 유지한다 — 스타터가 아니라 필요한 API 만 가져온다.
dependencies {
    api("jakarta.persistence:jakarta.persistence-api")
    api("jakarta.validation:jakarta.validation-api")
    api("com.fasterxml.jackson.core:jackson-annotations")

    // 감사 애너테이션(@CreatedBy 등)만 쓴다. 리포지토리·JPA 는 domain 의 것이다(21 §1).
    api("org.springframework.data:spring-data-commons")

    // core 에 @MappedSuperclass 가 있으면 Q 클래스도 core 에 생겨야 한다 —
    // 상속받는 엔티티의 Q 클래스가 `_super` 로 그것을 참조하기 때문이다.
    // 그래서 프로세서가 여기서도 돌고, 생성물이 쓰는 querydsl-core 가 api 로 나간다.
    // querydsl-jpa 는 필요 없다 — JPA 쿼리를 조립하는 것은 domain 이다.
    api(libs.querydsl.core)
    annotationProcessor(variantOf(libs.querydsl.apt) { classifier("jakarta") })
    annotationProcessor("jakarta.persistence:jakarta.persistence-api")
    annotationProcessor("jakarta.annotation:jakarta.annotation-api")
}
