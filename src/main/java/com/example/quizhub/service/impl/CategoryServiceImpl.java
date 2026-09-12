package com.example.quizhub.service.impl;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import java.text.Collator;
import java.util.Locale;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.category.CategoryRequestDTO;
import com.example.quizhub.dto.category.CategoryResponseDTO;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Practice;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.mapper.CategoryMapper;
import com.example.quizhub.repository.CategoryRepository;
import com.example.quizhub.repository.PracticeRepository;
import com.example.quizhub.repository.QuestionRepository;
import com.example.quizhub.repository.QuizRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.CategoryService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final QuizRepository quizRepository;
    private final PracticeRepository practiceRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponseDTO> getAllCategories(){
        List<Category> allCategories = categoryRepository.findAll();
        return buildTree(allCategories, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponseDTO> getPublicCategories() {
        // JOIN FETCH đảm bảo parent được load trong transaction
        List<Category> publicCats = categoryRepository.findAllPublicWithParent();
        List<CategoryResponseDTO> dtos = buildTree(publicCats, null);
        List<Category> allCategories = categoryRepository.findAll();
        attachPublicQuizCount(dtos, allCategories);
        return dtos;
    }

    @Override
    public List<CategoryResponseDTO> getMyCategories() {
        User me = getCurrentUser();
        // JOIN FETCH đảm bảo parent được load trong transaction
        List<Category> myCats = categoryRepository.findAllByCreatorIdWithParent(me.getId());
        List<CategoryResponseDTO> dtos = buildTree(myCats, null);
        List<Category> allCategories = categoryRepository.findAll();
        attachMyQuizCount(dtos, me.getId(), allCategories);
        return dtos;
    }

    // ─── Helper: Xây cây từ danh sách flat ───
    private List<CategoryResponseDTO> buildTree(List<Category> categories, Long parentId) {
        Map<Long, CategoryResponseDTO> dtoMap = categories.stream()
                .collect(Collectors.toMap(Category::getId, CategoryResponseDTO::new));

        List<CategoryResponseDTO> roots = new ArrayList<>();
        for (Category c : categories) {
            CategoryResponseDTO dto = dtoMap.get(c.getId());
            if (c.getParent() == null) {
                roots.add(dto);
            } else {
                CategoryResponseDTO parentDto = dtoMap.get(c.getParent().getId());
                if (parentDto != null) parentDto.getChildren().add(dto);
                else roots.add(dto); // parent không trong list → treat as root
            }
        }

        Collator collator = Collator.getInstance(new Locale("vi", "VN"));
        Comparator<CategoryResponseDTO> comparator = (a, b) -> {
            String nameA = a.getName() != null ? a.getName() : "";
            String nameB = b.getName() != null ? b.getName() : "";
            return collator.compare(nameA, nameB);
        };

        // Sắp xếp các danh mục con cho từng phần tử
        for (CategoryResponseDTO dto : dtoMap.values()) {
            if (dto.getChildren() != null && !dto.getChildren().isEmpty()) {
                dto.getChildren().sort(comparator);
            }
        }

        // Sắp xếp các danh mục gốc
        roots.sort(comparator);

        return roots;
    }

    private void attachPublicQuizCount(List<CategoryResponseDTO> dtos, List<Category> allCategories) {
        for (CategoryResponseDTO dto : dtos) {
            List<Long> allIds = getAllDescendantIds(dto.getId(), allCategories);
            // Đối với danh mục công khai, đếm số câu hỏi thay vì số đề thi
            long count = questionRepository.countPublicQuestionsByCategories(allIds, QuestionStatus.PUBLIC);
            dto.setQuizCount(count);
            if (dto.getChildren() != null) attachPublicQuizCount(dto.getChildren(), allCategories);
        }
    }

    private void attachMyQuizCount(List<CategoryResponseDTO> dtos, Long creatorId, List<Category> allCategories) {
        for (CategoryResponseDTO dto : dtos) {
            List<Long> allIds = getAllDescendantIds(dto.getId(), allCategories);
            long count = quizRepository.countByCategoryIdInAndCreatorIdAndIsEnableTrue(allIds, creatorId);
            dto.setQuizCount(count);
            if (dto.getChildren() != null) attachMyQuizCount(dto.getChildren(), creatorId, allCategories);
        }
    }

    @Override
    @Transactional
    public CategoryResponseDTO getCategoryById(Long id) {
        return categoryMapper.toResponseDTO(categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND)));
    }

    @Override
    @Transactional
    public CategoryResponseDTO createCategory(CategoryRequestDTO request) {
        Category parent = null;
        if (request.getParentId() != null) {
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }

        Category category = categoryMapper.toEntity(request);
        category.setParent(parent);
        category.setCreator(getCurrentUser());
        // Kế thừa isPublic từ request; mặc định false nếu null
        if (request.getIsPublic() != null) category.setIsPublic(request.getIsPublic());
        else category.setIsPublic(false);

        return categoryMapper.toResponseDTO(categoryRepository.save(category));
    }

    @Override
    @Transactional
    public CategoryResponseDTO updateCategory(Long id, CategoryRequestDTO request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRole() == Role.ADMIN;
        boolean isPublic = category.getIsPublic() != null && category.getIsPublic();
        boolean isCreator = category.getCreator() != null && category.getCreator().getId().equals(currentUser.getId());

        if (isPublic) {
            if (!isAdmin) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else {
            if (!isCreator && !isAdmin) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }

        Category parent = null;
        if (request.getParentId() != null) {
            if (id.equals(request.getParentId())) {
                throw new AppException(ErrorCode.CATEGORY_INVALID_LOGIC);
            }
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }

        Category tmp = parent;
        while(tmp != null){
            if(tmp.getId().equals(id)){
                throw new AppException(ErrorCode.CATEGORY_INVALID_LOGIC);
            }
            tmp = tmp.getParent();
        }

        category.setName(request.getName());
        category.setDescription(request.getDescription());
        category.setParent(parent);
        if (request.getIsPublic() != null) category.setIsPublic(request.getIsPublic());

        return categoryMapper.toResponseDTO(categoryRepository.save(category));
    }

//Xóa an toàn khi có danh mục con
    @Override
    @Transactional
    public void deleteCategory(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRole() == Role.ADMIN;
        boolean isPublic = category.getIsPublic() != null && category.getIsPublic();
        boolean isCreator = category.getCreator() != null && category.getCreator().getId().equals(currentUser.getId());

        if (isPublic) {
            if (!isAdmin) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else {
            if (!isCreator && !isAdmin) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }

        // 1. Move all questions in this category to "Unassigned" (null)
        List<Question> questions = questionRepository.findByCategoryId(id);
        if (!questions.isEmpty()) {
            for (Question q : questions) {
                q.setCategory(null);
            }
            questionRepository.saveAll(questions);
        }

        // 2. Move all quizzes in this category to "Unassigned" (null)
        List<Quiz> quizzes = quizRepository.findByCategoryId(id);
        if (!quizzes.isEmpty()) {
            for (Quiz q : quizzes) {
                q.setCategory(null);
            }
            quizRepository.saveAll(quizzes);
        }

        // 3. Move all practice sessions in this category to "Unassigned" (null)
        List<Practice> practices = practiceRepository.findByCategoryId(id);
        if (!practices.isEmpty()) {
            for (Practice p : practices) {
                p.setCategory(null);
            }
            practiceRepository.saveAll(practices);
        }

        // 4. Detach child categories
        List<Category> children = categoryRepository.findByParentId(id);
        if (children != null && !children.isEmpty()) {
            for (Category child : children) {
                child.setParent(null);
            }
            categoryRepository.saveAll(children);
        }

        if (category.getChildren() != null) {
            category.getChildren().clear();
        }

        categoryRepository.delete(category);
        categoryRepository.flush();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> getAllDescendantIds(Long categoryId) {
        List<Category> allCategories = categoryRepository.findAll();
        return getAllDescendantIds(categoryId, allCategories);
    }

    private List<Long> getAllDescendantIds(Long categoryId, List<Category> allCategories) {
        List<Long> descendantIds = new ArrayList<>();
        if (categoryId == null) return descendantIds;

        descendantIds.add(categoryId);
        collectDescendantIdsRecursive(categoryId, allCategories, descendantIds);
        return descendantIds;
    }

    private void collectDescendantIdsRecursive(Long parentId, List<Category> allCategories, List<Long> ids) {
        for (Category category : allCategories) {
            if (category.getParent() != null && category.getParent().getId().equals(parentId)) {
                ids.add(category.getId());
                collectDescendantIdsRecursive(category.getId(), allCategories, ids);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponseDTO> getAllCategoriesFlat() {
        List<Category> all = categoryRepository.findAll();

        // Xây map id -> category để tra cứu nhanh
        Map<Long, Category> idMap = all.stream()
                .collect(Collectors.toMap(Category::getId, c -> c));

        // Hàm đệ quy xây fullPath
        // Trả về đường dẫn từ gốc đến category (ví dụ: "Mạng Máy Tính > Chương 1")
        return all.stream()
                .map(c -> {
                    CategoryResponseDTO dto = new CategoryResponseDTO(c);

                    // Xây fullPath và tính depth
                    StringBuilder pathBuilder = new StringBuilder(c.getName());
                    Category current = c;
                    int depth = 0;
                    while (current.getParent() != null) {
                        Category parent = idMap.get(current.getParent().getId());
                        if (parent == null) break;
                        pathBuilder.insert(0, parent.getName() + " > ");
                        current = parent;
                        depth++;
                    }
                    dto.setFullPath(pathBuilder.toString());
                    dto.setDepth(depth);

                    // Set parentName nếu có
                    if (c.getParent() != null) {
                        Category parent = idMap.get(c.getParent().getId());
                        if (parent != null) dto.setParentName(parent.getName());
                    }

                    return dto;
                })
                .sorted((a, b) -> {
                    // Sắp xếp: public trước, sau đó theo fullPath
                    boolean aPublic = Boolean.TRUE.equals(a.getIsPublic());
                    boolean bPublic = Boolean.TRUE.equals(b.getIsPublic());
                    if (aPublic != bPublic) return aPublic ? -1 : 1;
                    Collator collator = Collator.getInstance(new Locale("vi", "VN"));
                    String pathA = a.getFullPath() != null ? a.getFullPath() : "";
                    String pathB = b.getFullPath() != null ? b.getFullPath() : "";
                    return collator.compare(pathA, pathB);
                })
                .collect(Collectors.toList());
    }
}

