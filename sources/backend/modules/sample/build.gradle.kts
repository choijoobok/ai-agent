// @feat FEAT-503
// sample — 제품 모듈이 아닌 삭제 가능한 참조 구현(ARCH-027).
dependencies {
    // HTTP·Security 경계와 현재 공통 도메인 계약은 api가 공개한 클래스패스를 재사용한다.
    implementation(project(":backend:api"))

    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    implementation(libs.querydsl.jpa)
    annotationProcessor(variantOf(libs.querydsl.apt) { classifier("jakarta") })
    annotationProcessor("jakarta.persistence:jakarta.persistence-api")
    annotationProcessor("jakarta.annotation:jakarta.annotation-api")

    testImplementation(libs.querydsl.jpa)
    testAnnotationProcessor(variantOf(libs.querydsl.apt) { classifier("jakarta") })
    testAnnotationProcessor("jakarta.persistence:jakarta.persistence-api")
    testAnnotationProcessor("jakarta.annotation:jakarta.annotation-api")
}
