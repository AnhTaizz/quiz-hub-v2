package com.example.quizhub;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;

@EnableScheduling
@SpringBootApplication
public class QuizHubApplication {
	@PostConstruct
	public void init() {
		// Thiết lập múi giờ mặc định cho toàn bộ ứng dụng là giờ Việt Nam
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
	}
	public static void main(String[] args) {
		SpringApplication.run(QuizHubApplication.class, args);
	}

}
