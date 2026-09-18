package com.example.quizhub.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * "/", "/login", "/register" and "/forgot-password" are now owned by the
 * React SPA (see SpaController). Only pages still rendered by Thymeleaf
 * remain here.
 */
@Controller
public class HomeController{
    @GetMapping("/profile")
    public String profilePage(){
        return "profile";
    }
}
