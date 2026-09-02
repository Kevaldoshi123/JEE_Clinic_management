package com.medeuon.clinic.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/portal").setViewName("forward:/portal.html");
        registry.addViewController("/doctor").setViewName("forward:/doctor.html");
        registry.addViewController("/admin").setViewName("forward:/admin.html");
        registry.addViewController("/register").setViewName("forward:/register.html");
        registry.addViewController("/display").setViewName("forward:/display.html");
        registry.addViewController("/staff").setViewName("forward:/staff_portal_design.html");
    }
}
