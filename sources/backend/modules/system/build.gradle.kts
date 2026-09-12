// @feat FEAT-501
// system — 계정·메뉴·역할·권한과 공통 운영 기반(ARCH-022).
dependencies {
    // 기능별 이행이 끝날 때까지 기존 api/domain 구현을 재사용한다. 컨트롤러 진입점은 이 모듈만 소유한다.
    implementation(project(":backend:api"))

    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // 역할 조회가 QueryDSL 조립을 직접 소유한다. domain의 구현 의존성은 전이되지 않는다.
    implementation(libs.querydsl.jpa)

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
