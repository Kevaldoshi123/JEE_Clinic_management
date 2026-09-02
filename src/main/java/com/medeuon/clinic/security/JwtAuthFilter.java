package com.medeuon.clinic.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();

            if (!token.isEmpty() && jwtUtil.validateToken(token)) {
                try {
                    Claims claims = jwtUtil.extractClaims(token);
                    String email = claims.getSubject();
                    if (email == null || email.isEmpty()) {
                        email = (String) claims.get("email");
                    }
                    if (email == null || email.isEmpty()) {
                        email = (String) claims.get("username");
                    }
                    if (email == null) {
                        email = "anonymous_user";
                    }

                    String role = (String) claims.get("role");
                    List<SimpleGrantedAuthority> authorities = new ArrayList<>();

                    if (role != null && !role.trim().isEmpty()) {
                        String r = role.trim().toUpperCase();
                        if (r.equals("ADMIN") || r.equals("SUPERADMIN")) {
                            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                            authorities.add(new SimpleGrantedAuthority("ROLE_SUPERADMIN"));
                        } else if (r.equals("DOCTOR")) {
                            authorities.add(new SimpleGrantedAuthority("ROLE_DOCTOR"));
                        } else if (r.equals("PATIENT")) {
                            authorities.add(new SimpleGrantedAuthority("ROLE_PATIENT"));
                        } else {
                            if (!r.startsWith("ROLE_")) {
                                authorities.add(new SimpleGrantedAuthority("ROLE_" + r));
                            } else {
                                authorities.add(new SimpleGrantedAuthority(r));
                            }
                        }
                    }

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(email, null, authorities);
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (Exception e) {
                    // Continue filter chain unauthenticated on extraction failure
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
