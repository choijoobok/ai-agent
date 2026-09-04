plugins {
    java
    alias(libs.plugins.spring.boot) apply false
}

// 모듈 공통 규약. 모듈별 책임과 의존 방향은
// aidd-guide/standard/backend/_study/architecture.md §1 이 단일 원본이다.
subprojects {
    apply(plugin = "java-library")

    group = "com.ordinary"
    version = "0.0.1-SNAPSHOT"

    extensions.configure<JavaPluginExtension> {
        // 20-tech-stack §1.1 — JDK 25 (LTS)
        toolchain { languageVersion = JavaLanguageVersion.of(25) }
    }

    dependencies {
        // Spring Boot BOM. 관리 대상 아티팩트는 버전을 명시하지 않는다 — 20 §4.1
        add("implementation", platform(rootProject.libs.spring.boot.bom))
        add("annotationProcessor", platform(rootProject.libs.spring.boot.bom))
        add("testImplementation", platform(rootProject.libs.spring.boot.bom))
        add("testAnnotationProcessor", platform(rootProject.libs.spring.boot.bom))

        add("compileOnly", "org.projectlombok:lombok")
        add("annotationProcessor", "org.projectlombok:lombok")
        add("testCompileOnly", "org.projectlombok:lombok")
        add("testAnnotationProcessor", "org.projectlombok:lombok")

        add("testImplementation", "org.springframework.boot:spring-boot-starter-test")
        add("testRuntimeOnly", "org.junit.platform:junit-platform-launcher")
    }

    tasks.withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        options.compilerArgs.add("-parameters")
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
        testLogging { events("passed", "skipped", "failed") }
    }
}
