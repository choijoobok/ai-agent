package com.aiagent;

import java.util.Arrays;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;

@SpringBootApplication
public class AiAgentApplication {

    public static void main(String[] args) {
        var application = new SpringApplication(AiAgentApplication.class);
        application.addListeners((ApplicationListener<ApplicationEnvironmentPreparedEvent>)
                event -> requireActiveProfile(event.getEnvironment()));
        application.run(args);
    }

    /** 프로파일 누락을 데이터소스 자동설정보다 먼저 거부한다(ARCH-027 · TC-5036). */
    static void requireActiveProfile(Environment environment) {
        boolean explicitProfile = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> !profile.isBlank() && !"default".equalsIgnoreCase(profile));
        if (!explicitProfile) {
            throw new IllegalStateException(
                    "활성 프로파일이 없다 — local, 개발 또는 운영 프로파일을 명시해야 한다.");
        }
    }
}
