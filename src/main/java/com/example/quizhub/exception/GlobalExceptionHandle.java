package com.example.quizhub.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.example.quizhub.dto.ErrorResponse;

import lombok.extern.slf4j.Slf4j;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandle {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleAppException(AppException e) {
        ErrorCode errorCode = e.getErrorCode();
        ErrorResponse errorResponse = ErrorResponse.builder()
                .code(errorCode.getCode())
                .status(errorCode.getStatusCode().value())
                .message(errorCode.getMessage())
                .timestamp(LocalDateTime.now())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(errorResponse);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException e) {
        log.error("Unhandled Exception: ", e);
        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
        ErrorResponse errorResponse = ErrorResponse.builder()
                .code(errorCode.getCode())
                .status(errorCode.getStatusCode().value())
                .message("Đã có lỗi hệ thống xảy ra, vui lòng thử lại sau.")
                .timestamp(LocalDateTime.now())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(errorResponse);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : e.getBindingResult().getFieldErrors()) {
            String field = fieldError.getField();
            String enumKey = fieldError.getDefaultMessage();
            String errorMessage = enumKey;
            try {
                ErrorCode errorCode = ErrorCode.valueOf(enumKey);
                errorMessage = errorCode.getMessage();
            } catch (IllegalArgumentException ex) {
            }
            errors.put(field, errorMessage);
        }
        ErrorResponse errorResponse = ErrorResponse.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .message("Dữ liệu không hợp lệ")
                .timestamp(LocalDateTime.now())
                .errors(errors)
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
}
