package com.example.quizhub.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;

@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Lỗi hệ thống không xác định", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_KEY(1001, "Khóa không hợp lệ", HttpStatus.BAD_REQUEST),
    USER_NOT_FOUND(1002, "Không tìm thấy người dùng", HttpStatus.NOT_FOUND),
    CATEGORY_NOT_FOUND(1003, "Không tìm thấy danh mục", HttpStatus.NOT_FOUND),
    QUESTION_NOT_FOUND(1004, "Không tìm thấy câu hỏi", HttpStatus.NOT_FOUND),
    ANSWER_NOT_FOUND(1005, "Không tìm thấy câu trả lời", HttpStatus.NOT_FOUND),
    QUIZ_NOT_FOUND(1006, "Không tìm thấy đề thi", HttpStatus.NOT_FOUND),

    BLANK_FIELD(1007, "Trường này không được để trống", HttpStatus.BAD_REQUEST),
    INVALID_EMAIL(1008, "Định dạng email không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_PASSWORD(1009, "Mật khẩu phải có ít nhất 6 ký tự", HttpStatus.BAD_REQUEST),
    PASSWORD_MISMATCH(1010, "Mật khẩu xác nhận không khớp", HttpStatus.BAD_REQUEST),
    WRONG_PASSWORD(1011, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(1012, "Không có quyền truy cập", HttpStatus.UNAUTHORIZED),
    USER_EXISTED(1013, "Email đã tồn tại", HttpStatus.BAD_REQUEST),
    QUESTION_INVALID_LOGIC(1014, "Logic câu hỏi không hợp lệ", HttpStatus.BAD_REQUEST),
    CATEGORY_HAS_QUESTIONS(1015, "Danh mục vẫn còn chứa câu hỏi", HttpStatus.BAD_REQUEST),
    CATEGORY_INVALID_LOGIC(1016, "Logic danh mục không hợp lệ", HttpStatus.BAD_REQUEST),
    CLASSROOM_NOT_FOUND(1017, "Không tìm thấy lớp học", HttpStatus.NOT_FOUND),
    QUIZ_ASSIGNING_NOT_FOUND(1018, "Không tìm thấy phân công đề thi", HttpStatus.NOT_FOUND),
    ATTEMPT_NOT_FOUND(1019, "Không tìm thấy lượt làm bài", HttpStatus.NOT_FOUND),
    ATTEMPT_ALREADY_SUBMITTED(1020, "Bài làm đã được nộp trước đó", HttpStatus.BAD_REQUEST),
    INVALID_OTP(1021, "Mã OTP không hợp lệ", HttpStatus.BAD_REQUEST),
    PASSWORD_SAME(1022, "Mật khẩu mới không được trùng với mật khẩu cũ", HttpStatus.BAD_REQUEST),
    USER_NOT_IN_CLASS(1023, "Thành viên này không có trong lớp học", HttpStatus.BAD_REQUEST),
    USER_ALREADY_IN_CLASS(1024, "Thành viên này đã tham gia lớp học trước đó", HttpStatus.BAD_REQUEST),
    QUESTION_ALREADY_PUBLIC(1025, "Câu hỏi này đã ở trạng thái công khai", HttpStatus.BAD_REQUEST),
    CLASS_TOPIC_NOT_FOUND(1026, "Không tìm thấy chủ đề của lớp học", HttpStatus.NOT_FOUND),
    PRACTICE_NOT_FOUND(1027, "Không tìm thấy lượt luyện tập", HttpStatus.NOT_FOUND),
    MAX_ATTEMPTS_REACHED(1028, "Bạn đã đạt giới hạn tối đa số lần làm đề thi này", HttpStatus.BAD_REQUEST),
    QUIZ_EXPIRED(1029, "Đề thi đã kết thúc thời gian làm bài", HttpStatus.BAD_REQUEST),
    QUIZ_NOT_STARTED(1030, "Đề thi chưa bắt đầu thời gian làm bài", HttpStatus.BAD_REQUEST),
    INVALID_DATE_RANGE(1031, "Hạn nộp bài phải sau thời gian bắt đầu", HttpStatus.BAD_REQUEST),
    INVALID_DURATION(1032, "Thời gian làm bài phải lớn hơn 0 và không vượt quá khoảng thời gian mở đề", HttpStatus.BAD_REQUEST),
    PRACTICE_ALREADY_SUBMITTED(1033, "Lượt luyện tập đã được nộp trước đó", HttpStatus.BAD_REQUEST),
    EXCEL_IMPORT_ERROR(1034, "Có lỗi xảy ra khi nhập tệp Excel", HttpStatus.BAD_REQUEST),
    INVALID_GENERATION_METHOD(1035, "Phương thức tạo câu hỏi không hợp lệ. Phải là RANDOM hoặc RANGE", HttpStatus.BAD_REQUEST),
    QUESTION_TEXT_EMPTY(1036, "Nội dung câu hỏi không được để trống", HttpStatus.BAD_REQUEST),
    QUESTION_ANSWERS_EMPTY(1037, "Câu hỏi phải có ít nhất một đáp án lựa chọn", HttpStatus.BAD_REQUEST),
    AI_GENERATION_FAILED(1038, "Có lỗi xảy ra khi tạo câu hỏi bằng AI, vui lòng thử lại.", HttpStatus.BAD_REQUEST),
    QUIZ_STRUCTURE_LOCKED(1039, "Đề thi đã được giao cho lớp, không thể thêm/xóa/thay đổi danh sách câu hỏi. Hãy tạo bản sao để chỉnh sửa.", HttpStatus.BAD_REQUEST),
    QUIZ_DISABLED(1040, "Đề thi đã bị xóa hoặc đã bị ẩn, không thể giao mới.", HttpStatus.BAD_REQUEST),
    QUIZ_ASSIGNING_HAS_SUBMISSIONS(1041, "Không thể xóa bài thi đã có học sinh làm bài", HttpStatus.BAD_REQUEST),
    DEADLINE_IN_PAST(1042, "Hạn chót không được nằm trong quá khứ", HttpStatus.BAD_REQUEST);

    final int code;
    final String message;
    final HttpStatusCode statusCode;

}
