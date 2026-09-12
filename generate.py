import json
import os

sql = []

# PostgreSQL valid deletes
sql.append("DELETE FROM class_topics WHERE classroom_id >= 90000;")
sql.append("DELETE FROM _class_joining WHERE class_id >= 90000;")
sql.append("DELETE FROM _quiz_assigning WHERE classroom_id >= 90000;")
sql.append("DELETE FROM _question_creating WHERE quiz_id = '00000000-0000-0000-0000-000000000001';")
sql.append("DELETE FROM _quiz WHERE id = '00000000-0000-0000-0000-000000000001';")
sql.append("DELETE FROM _classroom WHERE id >= 90000;")
sql.append("DELETE FROM _answer WHERE question_id >= 90000;")
sql.append("DELETE FROM _question WHERE created_id IN (9980, 9981, 9982, 9990, 9991, 9992, 9993, 9997, 9998, 9999);")
sql.append("DELETE FROM categories WHERE creator_id IN (9980, 9981, 9982, 9990, 9991, 9992, 9993, 9997, 9998, 9999);")
sql.append("DELETE FROM _user WHERE id IN (9980, 9981, 9982, 9990, 9991, 9992, 9993, 9997, 9998, 9999);")

password_hash = "$2a$10$mKPA.JpfPPsx8KUxC4LmSuSSmKgAuiTOhadQFo9YIb.0F82ZzbrWq"

# PostgreSQL Boolean literals are true/false without quotes
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9999, 'TEACHER', 'teacher@gmail.com', '{password_hash}', 'Nguyễn Minh Đức', true, true, '2024-05-01 08:00:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9998, 'ADMIN', 'admin@gmail.com', '{password_hash}', 'Trần Quốc Bảo', true, true, '2024-05-01 08:30:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9997, 'STUDENT', 'student@gmail.com', '{password_hash}', 'Lê Minh Triết', true, true, '2024-05-02 09:00:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9990, 'STUDENT', 'student1@gmail.com', '{password_hash}', 'Nguyễn Gia Khánh', true, true, '2024-05-02 09:15:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9991, 'STUDENT', 'student2@gmail.com', '{password_hash}', 'Trần Khánh Quỳnh', true, true, '2024-05-02 09:30:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9992, 'STUDENT', 'student3@gmail.com', '{password_hash}', 'Lê Hải Đăng', true, true, '2024-05-02 09:45:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9993, 'STUDENT', 'student4@gmail.com', '{password_hash}', 'Phạm Trúc Anh', true, true, '2024-05-02 10:00:00');")

sql.append("-- Học sinh mới để Test Excel (Không có lớp)")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9980, 'STUDENT', 'test_excel1@gmail.com', '{password_hash}', 'Đỗ Minh Khang', true, true, '2024-05-03 14:00:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9981, 'STUDENT', 'test_excel2@gmail.com', '{password_hash}', 'Bùi Thanh Phong', true, true, '2024-05-03 14:15:00');")
sql.append(f"INSERT INTO _user (id, role, email, password, full_name, is_enable, is_verified, created_at) VALUES (9982, 'STUDENT', 'test_excel3@gmail.com', '{password_hash}', 'Nguyễn Thảo Nguyên', true, true, '2024-05-03 14:30:00');")

global_cat_id = 90000
global_question_id = 90000
global_answer_id = 90000

def process_file(file_path, subject_name, creator_id=9999, is_public=False, chapter_prefix="Chương", chapter_offset=0, parent_id=None):
    global global_cat_id, global_question_id, global_answer_id
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    chapters = {}
    for item in data:
        chap = item.get('chapter', 1) + chapter_offset
        if chap not in chapters:
            chapters[chap] = []
        chapters[chap].append(item)
        
    public_val = "true" if is_public else "false"
    if parent_id is None:
        parent_cat_id = global_cat_id
        global_cat_id += 1
        sql.append(f"INSERT INTO categories (id, name, creator_id, is_public, parent_id) VALUES ({parent_cat_id}, '{subject_name}', {creator_id}, {public_val}, NULL);")
    else:
        parent_cat_id = parent_id
    
    for chap, questions in chapters.items():
        cat_id = global_cat_id
        global_cat_id += 1
        cat_name = f"{chapter_prefix} {chap}"
        
        sql.append(f"INSERT INTO categories (id, name, creator_id, is_public, parent_id) VALUES ({cat_id}, '{cat_name}', {creator_id}, {public_val}, {parent_cat_id});")
        
        for q in questions:
            q_text = str(q['question']).replace("'", "''")
            
            # Determine question type: SINGLE_CHOICE if 1 or 0 correct answers, MULTIPLE_CHOICE if > 1
            correct_count = sum(1 for ans in q.get('answers', []) if ans.get('is_correct', False))
            q_type = 'SINGLE_CHOICE' if correct_count <= 1 else 'MULTIPLE_CHOICE'
            
            status = 'PUBLIC' if is_public else 'PRIVATE'
            sql.append(f"INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES ({global_question_id}, '{q_text}', '{q_type}', {cat_id}, {creator_id}, '{status}', 'MEDIUM');")
            
            for ans in q.get('answers', []):
                a_text = str(ans.get('content', '')).replace("'", "''")
                is_correct = "true" if ans.get('is_correct', False) else "false"
                sql.append(f"INSERT INTO _answer (id, text, is_correct, question_id) VALUES ({global_answer_id}, '{a_text}', {is_correct}, {global_question_id});")
                global_answer_id += 1
                
            global_question_id += 1
            
    return parent_cat_id

def process_student_file(file_path, subject_name, category_id=99001, creator_id=9997, start_q_id=300000, start_a_id=300000):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    sql.append(f"INSERT INTO categories (id, name, creator_id, is_public, parent_id) VALUES ({category_id}, '{subject_name}', {creator_id}, false, NULL);")
    
    q_id = start_q_id
    a_id = start_a_id
    for item in data:
        q_text = str(item['question']).replace("'", "''")
        
        correct_count = sum(1 for ans in item.get('answers', []) if ans.get('is_correct', False))
        q_type = 'SINGLE_CHOICE' if correct_count <= 1 else 'MULTIPLE_CHOICE'
        
        sql.append(f"INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES ({q_id}, '{q_text}', '{q_type}', {category_id}, {creator_id}, 'PRIVATE', 'MEDIUM');")
        
        for ans in item.get('answers', []):
            a_text = str(ans.get('content', '')).replace("'", "''")
            is_correct = "true" if ans.get('is_correct', False) else "false"
            sql.append(f"INSERT INTO _answer (id, text, is_correct, question_id) VALUES ({a_id}, '{a_text}', {is_correct}, {q_id});")
            a_id += 1
        q_id += 1

process_file('d:/quiz-hub/de_trac_nghiem_tu_tuong_ho_chi_minh_theo_chuong.json', 'Môn Tư tưởng Hồ Chí Minh')
process_file('d:/quiz-hub/de_trac_nghiem_mang_may_tinh_so_1_co_giai_thich.json', 'Môn Mạng Máy Tính')
process_file('d:/quiz-hub/de_trac_nghiem_phap_luat_dai_cuong_theo_chuong.json', 'Môn Pháp Luật Đại Cương')
process_student_file('d:/quiz-hub/de_trac_nghiem_kinh_te_chinh_tri_mac_lenin_so_4.json', 'Kinh tế chính trị Mác - Lênin')
security_parent_id = process_file('d:/quiz-hub/de_trac_nghiem_an_toan_bao_mat_he_thong_thong_tin_so_1.json', 'An toàn bảo mật hệ thống thông tin', creator_id=9998, is_public=True, chapter_prefix="Đề số")
process_file('d:/quiz-hub/de_trac_nghiem_an_toan_bao_mat_he_thong_thong_tin_so_2.json', 'An toàn bảo mật hệ thống thông tin', creator_id=9998, is_public=True, chapter_prefix="Đề số", chapter_offset=1, parent_id=security_parent_id)
process_file('d:/quiz-hub/de_trac_nghiem_co_so_du_lieu_so_1.json', 'Cơ sở dữ liệu', creator_id=9998, is_public=True, chapter_prefix="Đề số")
process_file('d:/quiz-hub/de_trac_nghiem_an_toan_web_va_csdl_so_1.json', 'An toàn Web và Cơ sở dữ liệu', creator_id=9998, is_public=True, chapter_prefix="Đề số")
process_file('d:/quiz-hub/de_trac_nghiem_phuong_phap_luan_nghien_cuu_khoa_hoc_so_1.json', 'Phương pháp luận nghiên cứu khoa học', creator_id=9998, is_public=True, chapter_prefix="Đề số")

# ========== THÊM DANH MỤC LÀM BÀI LUYỆN TẬP CÔNG KHAI VÀ CÂU HỎI NHIỀU LOẠI ==========
sql.append("INSERT INTO categories (id, name, creator_id, is_public, parent_id) VALUES (99000, 'Danh mục Luyện tập Chung (Public)', 9998, true, NULL);")

# Câu hỏi Điền khuyết (FILL_IN_BLANK) - Public
sql.append("INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES (299001, 'Năm Bác Hồ ra đi tìm đường cứu nước là năm nào?', 'FILL_IN_BLANK', 99000, 9998, 'PUBLIC', 'MEDIUM');")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299001, '1911', true, 299001);")

# Câu hỏi Nhiều lựa chọn (MULTIPLE_CHOICE) - Public
sql.append("INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES (299002, 'Các thành phần cơ bản của mạng máy tính bao gồm:', 'MULTIPLE_CHOICE', 99000, 9998, 'PUBLIC', 'MEDIUM');")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299002, 'Thiết bị đầu cuối', true, 299002);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299003, 'Môi trường truyền dẫn', true, 299002);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299004, 'Giao thức mạng', true, 299002);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299005, 'Bàn phím cơ', false, 299002);")

# Câu hỏi Chọn một (SINGLE_CHOICE) - Public
sql.append("INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES (299003, 'Giao thức nào được sử dụng để duyệt web?', 'SINGLE_CHOICE', 99000, 9998, 'PUBLIC', 'EASY');")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299006, 'HTTP', true, 299003);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299007, 'FTP', false, 299003);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299008, 'SMTP', false, 299003);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299009, 'POP3', false, 299003);")

# Câu hỏi Điền khuyết (FILL_IN_BLANK) - Private MMT
sql.append("INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES (299004, 'Mô hình OSI có bao nhiêu tầng?', 'FILL_IN_BLANK', 90007, 9999, 'PRIVATE', 'EASY');")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299010, '7', true, 299004);")

# Câu hỏi Nhiều lựa chọn (MULTIPLE_CHOICE) - Private MMT
sql.append("INSERT INTO _question (id, text, type, category_id, created_id, approval_status, question_level) VALUES (299005, 'Các giao thức thuộc tầng Transport trong mô hình OSI là:', 'MULTIPLE_CHOICE', 90007, 9999, 'PRIVATE', 'MEDIUM');")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299011, 'TCP', true, 299005);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299012, 'UDP', true, 299005);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299013, 'IP', false, 299005);")
sql.append("INSERT INTO _answer (id, text, is_correct, question_id) VALUES (299014, 'HTTP', false, 299005);")

# --- Sample Classrooms & Quiz Data ---
# 1. Create Classrooms for each subject the teacher created
classrooms = [
    (90000, 'HCM001', 'Lớp học Tư tưởng Hồ Chí Minh'),
    (90001, 'MMT001', 'Lớp học Mạng Máy Tính'),
    (90002, 'PLD001', 'Lớp học Pháp Luật Đại Cương')
]

for c_id, c_code, c_name in classrooms:
    sql.append(f"INSERT INTO _classroom (id, code, name, is_enable, description, is_draft, created_id, require_approval, created_at) VALUES ({c_id}, '{c_code}', '{c_name}', true, 'Lớp học mẫu cho {c_name}', false, 9999, false, NOW());")
    # Add topics for each classroom
    sql.append(f"INSERT INTO class_topics (id, name, classroom_id) VALUES ({c_id + 100}, 'Kiểm tra & Bài tập', {c_id});")
    sql.append(f"INSERT INTO class_topics (id, name, classroom_id) VALUES ({c_id + 200}, 'Tài liệu tham khảo', {c_id});")

# 2. Create a Sample Quiz for one of the classrooms (e.g., Mạng Máy Tính)
quiz_id = '00000000-0000-0000-0000-000000000001'
sql.append(f"INSERT INTO _quiz (id, title, description, is_draft, is_enable, is_exam, created_id, created_at, updated_at) VALUES ('{quiz_id}', 'Kiểm tra Mạng Máy Tính', 'Bài kiểm tra kiến thức Mạng Máy Tính', false, true, false, 9999, NOW(), NOW());")

# 3. Add 10 questions to the Quiz from the "Mạng Máy Tính" category (cat_id starts from 90000)
# Let's find the start of MMT questions. HCM (90000), then subcats. 
# It's easier to just pick some IDs we know exist.
for i in range(10):
    q_id = 90280 + i  # MMT questions start after HCM (280 questions)
    sql.append(f"INSERT INTO _question_creating (quiz_id, quest_id) VALUES ('{quiz_id}', {q_id});")

sql.append(f"INSERT INTO _question_creating (quiz_id, quest_id) VALUES ('{quiz_id}', 299004);")
sql.append(f"INSERT INTO _question_creating (quiz_id, quest_id) VALUES ('{quiz_id}', 299005);")

# 4. Assign Quiz to the Mạng Máy Tính classroom (90001) under "Kiểm tra & Bài tập" topic (90101)
sql.append(f"INSERT INTO _quiz_assigning (classroom_id, quiz_id, note, max_attempt, question_shuffled, answer_shuffled, duration_in_mins, start_date, due_date, created_at, topic_id) VALUES (90001, '{quiz_id}', 'Làm bài trong 60 phút', 3, true, true, 60, '2026-05-01 00:00:00', '2026-06-30 10:30:00', NOW(), 90101);")

# 5. Enroll 5 Students in all classrooms
student_ids = [9997, 9990, 9991, 9992, 9993]
for c_id, _, _ in classrooms:
    for s_id in student_ids:
        sql.append(f"INSERT INTO _class_joining (class_id, learner_id, status, _displayed_name, joined_at) VALUES ({c_id}, {s_id}, 'APPROVED', (SELECT full_name FROM _user WHERE id={s_id}), NOW());")

with open('d:/quiz-hub/src/main/resources/data.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(sql))
print("Generated postgresql compatible mock_data.sql")
