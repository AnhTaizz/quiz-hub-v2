package com.example.quizhub.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController{
    @GetMapping("/")
    public String homePage(){
        return "index";
    }

    @GetMapping("/login")
    public String loginPage(){
        return "login";
    }

    @GetMapping("/register")
    public String registerPage(){
        return "register";
    }

    @GetMapping("/profile")
    public String profilePage(){
        return "profile";
    }

    @GetMapping("/forgot-password")
    public String forgotPasswordPage(){
        return "forgot-password";
    }
}
