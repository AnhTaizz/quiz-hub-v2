package com.example.quizhub.dto.quiztaking.request;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ViolationRequestDTO {
    Long attemptId;
    String violationCode; // e.g., 'TAB_SWITCH', 'ESC_FULLSCREEN'
}
