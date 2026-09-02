package com.medeuon.clinic.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthFilter jwtAuthFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Authentication token is missing or invalid.\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Forbidden\",\"message\":\"Access denied. Insufficient role permissions.\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                // Allow static resources and HTML pages
                .requestMatchers("/", "/*.html", "/*.css", "/*.js", "/uploads/**", "/resources/**", "/favicon.ico").permitAll()
                // Allow public APIs (auth, public queue, registration, clinic info, ai chatbot, notice tickers, public booking, doctor availability)
                .requestMatchers("/api/auth", "/api/auth/**", "/api/public", "/api/public/**", "/api/clinic", "/api/clinic/**", "/api/clinics", "/api/clinics/**", "/api/queue", "/api/queue/**", "/api/ai", "/api/ai/**", "/api/notice", "/api/notice/**", "/api/doctor-availability", "/api/doctor-availability/**", "/api/public/appointments").permitAll()
                // Patient profile access for Doctors and Admins
                .requestMatchers("/api/admin/patients", "/api/admin/patients/**").hasAnyRole("DOCTOR", "ADMIN")
                // Admin exclusive endpoints
                .requestMatchers("/api/admin", "/api/admin/**").hasRole("ADMIN")
                // Doctor and Admin operational endpoints
                .requestMatchers("/api/doctor", "/api/doctor/**", "/api/appointments", "/api/appointments/**", "/api/bills", "/api/bills/**", "/api/inventory", "/api/inventory/**", "/api/lab", "/api/lab/**", "/api/lab-reports", "/api/lab-reports/**", "/api/metrics", "/api/clinical-catalog", "/api/reports", "/api/reports/**").hasAnyRole("DOCTOR", "ADMIN")
                .requestMatchers("/api/patient", "/api/patient/**").authenticated()
                // All other endpoints require authentication
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
