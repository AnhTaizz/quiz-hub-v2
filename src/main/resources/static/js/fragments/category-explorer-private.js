(function() {
    const USER_TYPE = (window.CATEGORY_EXPLORER_CONFIG && window.CATEGORY_EXPLORER_CONFIG.userType) 
        ? window.CATEGORY_EXPLORER_CONFIG.userType 
        : 'student';
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    window.fetchCategories = async function(source = 'private') {
        const role = (USER_TYPE === 'admin') ? 'teacher' : USER_TYPE;
        const type = (source === 'public') ? 'public' : 'mine';
        const url = `/api/${role}/categories/${type}`;
        
        let headers = {};
        if (token && token !== 'null') {
            headers['Authorization'] = 'Bearer ' + token;
        }
        
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('API Error: ' + res.status);
        return await res.json();
    };

    window.categorySelectTarget = 'filter';
    window.categorySelectSource = 'private';

    window.renderTreeNodes = function(nodes, target) {
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) return '';
        return `<ul class="list-unstyled ps-2 mt-1">${nodes.map(n => {
            const hasChildren = n.children && Array.isArray(n.children) && n.children.length > 0;
            return `
                <li class="mb-1">
                    <div class="d-flex align-items-start gap-2 category-node-row">
                        ${hasChildren ? `<i class="bi bi-chevron-right folder-toggle text-primary mt-1" onclick="toggleFolderNode(event, this)"></i>` : '<i class="bi bi-dot text-muted mt-1"></i>'}
                        <span class="category-selectable-name text-dark fw-bold small flex-grow-1" onclick="selectCategoryFromTree(${n.id}, '${escapeJS(n.name)}', '${target}')">
                            <i class="bi bi-folder-fill text-warning me-1"></i> ${escapeHTML(n.name)}
                        </span>
                    </div>
                    ${hasChildren ? `<div class="children-node" style="display: none;">${renderTreeNodes(n.children, target)}</div>` : ''}
                </li>
            `;
        }).join('')}</ul>`;
    };

    window.toggleFolderNode = function(e, el) {
        e.stopPropagation();
        const li = el.closest('li');
        const children = li.querySelector('.children-node');
        if (children) {
            const isHidden = children.style.display === 'none';
            children.style.display = isHidden ? 'block' : 'none';
            el.classList.toggle('open', isHidden);
        }
    };

    window.selectCategoryFromTree = function(id, name, target) {
        const currentTarget = target || window.categorySelectTarget;
        
        if (currentTarget === 'categoryCreateParent') {
            const idInput = document.getElementById('categoryCreateParentId');
            const nameInput = document.getElementById('categoryCreateParentName');
            const nameDisplay = document.getElementById('categoryCreateParentNameDisplay');
            
            if (idInput) idInput.value = id || '';
            if (nameInput) nameInput.value = name || 'Mặc định: Danh mục gốc';
            if (nameDisplay) {
                nameDisplay.textContent = name || 'Mặc định: Danh mục gốc';
                nameDisplay.classList.toggle('text-muted', !id);
                nameDisplay.classList.toggle('text-dark', !!id);
            }
        } else if (typeof window.handleCategorySelection === 'function') {
            window.handleCategorySelection(id, name, currentTarget);
        } else {
            // Support all common IDs in the system
            const ids = ['quiz-category', 'q-category', 'editor-q-category', 'filter-category', 'q-category-filter', 'folder-category', 'randomGenCategoryId'];
            const dispIds = ['quiz-category-display', 'q-category-display', 'editor-q-category-display', 'filter-category-display', 'q-category-filter-display', 'folder-category-display', 'randomGenCategoryDisplay'];
            
            let targetIdEl = null;
            let targetDispEl = null;
            
            // 1. Try finding by currentTarget name (hyphenated and camelCase forms)
            targetIdEl = document.getElementById(currentTarget + '-category') || 
                         document.getElementById('category-' + currentTarget) ||
                         document.getElementById(currentTarget + 'CategoryId') ||
                         document.getElementById(currentTarget + 'Id');
                         
            targetDispEl = document.getElementById(currentTarget + '-category-display') || 
                           document.getElementById('category-' + currentTarget + '-display') ||
                           document.getElementById(currentTarget + 'CategoryDisplay') ||
                           document.getElementById(currentTarget + 'Display');
            
            // 2. Fallback to common IDs if not found
            if (!targetIdEl) {
                for (let cid of ids) {
                    const el = document.getElementById(cid);
                    if (el) { targetIdEl = el; break; }
                }
            }
            if (!targetDispEl) {
                for (let cid of dispIds) {
                    const el = document.getElementById(cid);
                    if (el) { targetDispEl = el; break; }
                }
            }

            if (targetIdEl) {
                targetIdEl.value = (id === null) ? '' : id;
                if (targetDispEl) {
                    if (targetDispEl.tagName === 'INPUT') targetDispEl.value = name;
                    else targetDispEl.textContent = name;
                }
                
                // Trigger refresh if needed
                if (typeof triggerSearch === 'function') triggerSearch();
                if (typeof loadQuestions === 'function') loadQuestions();
                if (typeof refreshContent === 'function') refreshContent();
                
                // Toggle clear button if exists
                const clearBtn = document.getElementById('clear-cat-btn') || document.getElementById('clear-q-cat-btn');
                if (clearBtn) clearBtn.style.display = (id === -1 || id === null || !id) ? 'none' : 'inline-block';
            }
        }

        ['categoryExplorerPrivateModal', 'categoryExplorerPublicModal'].forEach(mId => {
            const el = document.getElementById(mId);
            if (el) {
                const inst = bootstrap.Modal.getInstance(el);
                if (inst) inst.hide();
            }
        });
    };

    // --- Modal Stacking/Switching Logic ---
    let modalReturnStack = [];

    window.showModalStacked = function(targetModalId) {
        const targetEl = document.getElementById(targetModalId);
        if (!targetEl || targetEl.classList.contains('show')) return;

        if (targetEl.parentElement !== document.body) {
            const existing = bootstrap.Modal.getInstance(targetEl);
            if (existing) {
                existing.dispose();
            }
            document.body.appendChild(targetEl);
        }

        const currentOpenModal = document.querySelector('.modal.show');
        if (currentOpenModal && currentOpenModal.id !== targetModalId) {
            if (!modalReturnStack.includes(currentOpenModal.id)) {
                modalReturnStack.push(currentOpenModal.id);
            }
            bootstrap.Modal.getOrCreateInstance(currentOpenModal).hide();
        }

        setTimeout(() => {
            bootstrap.Modal.getOrCreateInstance(targetEl).show();
        }, 150); // Increased delay to ensure DOM repaints before showing

        const hideHandler = function() {
            // Delay check for stack to let any other modals hide first
            setTimeout(() => {
                if (modalReturnStack.length > 0 && !document.querySelector('.modal.show')) {
                    const prevModalId = modalReturnStack.pop();
                    const prevEl = document.getElementById(prevModalId);
                    if (prevEl) {
                        bootstrap.Modal.getOrCreateInstance(prevEl).show();
                    }
                }
            }, 150); // Increased delay
            targetEl.removeEventListener('hidden.bs.modal', hideHandler);
        };
        targetEl.addEventListener('hidden.bs.modal', hideHandler);
    };

    // --- Unified Opening Logic ---
    window.openCategoryExplorer = async function(target = 'filter', source = 'private') {
        window.categorySelectTarget = target;
        window.categorySelectSource = source;
        
        const pvtBtnWrap = document.getElementById('explorer-create-btn-wrapper');
        const pubBtnWrap = document.getElementById('explorer-public-create-btn-wrapper');
        
        const isFilterMode = ['filter', 'search', 'moderation'].includes(target);
        
        if (pvtBtnWrap) {
            const showPvt = source === 'private' && target !== 'categoryCreateParent' && !isFilterMode;
            pvtBtnWrap.style.display = showPvt ? 'block' : 'none';
        }
        if (pubBtnWrap) {
            const showPub = source === 'public' && (!isFilterMode || target === 'moderation') && (USER_TYPE === 'admin' || USER_TYPE === 'public');
            pubBtnWrap.style.display = showPub ? 'block' : 'none';
        }

        const containerId = source === 'public' ? 'public-category-tree-container' : 'private-category-tree-container';
        const modalId = source === 'public' ? 'categoryExplorerPublicModal' : 'categoryExplorerPrivateModal';
        const container = document.getElementById(containerId);
        
        if (!container) return;

        container.innerHTML = '<div class="text-center my-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
        showModalStacked(modalId);

        try {
            let nodes = source === 'public' ? window.publicCategories : window.myCategories;
            if (!nodes || nodes.length === 0) {
                nodes = await fetchCategories(source);
                if (source === 'public') window.publicCategories = nodes;
                else window.myCategories = nodes;
            }

            let html = '';
            if (target === 'categoryCreateParent') {
                html = `<div class="mb-3">
                    <div class="d-flex align-items-center gap-2 category-node-row" onclick="selectCategoryFromTree(null, 'Là danh mục gốc', 'categoryCreateParent')">
                        <i class="bi bi-folder-x text-danger" style="font-size: 1.1rem;"></i>
                        <span class="text-danger fw-bold small flex-grow-1 category-selectable-name">Là danh mục gốc</span>
                    </div>
                </div>`;
            } else if (target === 'filter' || target === 'moderation') {
                 html = `<div class="mb-2">
                    <div class="d-flex align-items-center gap-2 category-node-row" onclick="selectCategoryFromTree(null, 'Tất cả danh mục', '${target}')">
                        <i class="bi bi-globe-americas text-primary" style="font-size: 1.1rem;"></i>
                        <span class="text-primary fw-bold small flex-grow-1 category-selectable-name">Tất cả danh mục</span>
                    </div>
                </div>`;
                
                if (source === 'private') {
                    html += `<div class="mb-3 border-bottom pb-2">
                        <div class="d-flex align-items-center gap-2 category-node-row" onclick="selectCategoryFromTree(-1, 'Chưa phân mục', '${target}')">
                            <i class="bi bi-folder-x text-danger" style="font-size: 1.1rem;"></i>
                            <span class="text-danger fw-bold small flex-grow-1 category-selectable-name">Chưa phân mục</span>
                        </div>
                    </div>`;
                } else {
                    html += `<div class="mb-3 border-bottom pb-1"></div>`;
                }
            }
            
            html += renderTreeNodes(nodes, target);
            container.innerHTML = html || '<div class="text-muted text-center my-4">Không có danh mục nào</div>';
        } catch (err) {
            container.innerHTML = '<div class="text-danger text-center my-4">Lỗi tải danh mục</div>';
        }
    };

    window.openParentCategoryPicker = function() { 
        if (typeof TREE_DATA !== 'undefined') window.myCategories = TREE_DATA;
        const source = window.categoryCreateSource || 'private';
        openCategoryExplorer('categoryCreateParent', source); 
    };
    
    window.openCategoryTreePicker = function(target) {
        let source = 'private';
        // Allow public tree browsing for filter and randomGen when q-source is public
        if (target === 'filter' || target === 'randomGen') {
            const sourceEl = document.getElementById('q-source');
            source = (sourceEl && sourceEl.value === 'public') ? 'public' : 'private';
        }
        openCategoryExplorer(target, source);
    };
    window.openCategoryModal = function(target) { openCategoryExplorer(target || 'filter'); };

    // --- Modal Actions ---
    window.openCreateCategoryModal = function(pId, pName, event) {
        if (event) event.stopPropagation();
        
        window.categoryCreateSource = window.categorySelectSource;
        window.categoryCreateTarget = window.categorySelectTarget;

        ['categoryCreateId', 'categoryCreateParentId', 'categoryCreateParentName', 'categoryCreateName', 'categoryCreateDesc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const idInput = document.getElementById('categoryCreateParentId');
        const nameInput = document.getElementById('categoryCreateParentName');
        const disp = document.getElementById('categoryCreateParentNameDisplay');

        if (pId && pName) {
            if (idInput) idInput.value = pId;
            if (nameInput) nameInput.value = pName;
            if (disp) {
                disp.textContent = pName;
                disp.classList.remove('text-muted');
                disp.classList.add('text-dark');
            }
        } else {
            if (disp) {
                disp.textContent = 'Mặc định: Danh mục gốc';
                disp.classList.add('text-muted');
                disp.classList.remove('text-dark');
            }
        }

        const titleEl = document.getElementById('categoryCreateTitle');
        if (titleEl) titleEl.innerHTML = '<i class="bi bi-folder-plus me-2"></i>Tạo danh mục mới';

        showModalStacked('categoryCreateModal');
        
        // Focus name input after modal is shown to prevent accidental button trigger
        const modalEl = document.getElementById('categoryCreateModal');
        const onShown = () => {
            const nameInput = document.getElementById('categoryCreateName');
            if (nameInput) nameInput.focus();
            modalEl.removeEventListener('shown.bs.modal', onShown);
        };
        modalEl.addEventListener('shown.bs.modal', onShown);
    };


    window.submitCategoryCreateForm = async function() {
        const id = document.getElementById('categoryCreateId').value;
        const name = document.getElementById('categoryCreateName').value.trim();
        const description = document.getElementById('categoryCreateDesc').value.trim();
        const parentId = document.getElementById('categoryCreateParentId').value || null;
        
        if (!name) {
            showPrivateToast('Vui lòng nhập tên danh mục', 'err');
            return;
        }
        
        const isPublicCat = (window.categoryCreateSource === 'public' || USER_TYPE === 'public' || USER_TYPE === 'admin');
        const payload = { 
            name, 
            description, 
            parentId: (parentId && parentId !== '-1') ? parseInt(parentId) : null,
            isPublic: isPublicCat
        };
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/${USER_TYPE}/categories/${id}` : `/api/${USER_TYPE}/categories`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                showPrivateToast(id ? 'Cập nhật thành công!' : 'Tạo danh mục thành công!');
                const modalEl = document.getElementById('categoryCreateModal');
                if (modalEl) {
                    const inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                }
                if (window.categoryCreateSource === 'public') {
                    window.publicCategories = null; // Clear cache
                    if (typeof openCategoryExplorer === 'function') openCategoryExplorer(window.categoryCreateTarget, 'public');
                } else if (typeof fetchCategories === 'function') {
                    await fetchCategories();
                    if (typeof renderTree === 'function') {
                        const nodes = window.myCategories;
                        renderTree(nodes);
                    }
                } else if (typeof loadData === 'function') { 
                    await loadData(); 
                    if (typeof renderSidebarTree === 'function') renderSidebarTree(); 
                } else {
                    location.reload();
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                showPrivateToast(errData.message || 'Lỗi khi lưu danh mục', 'err');
            }
        } catch (e) { 
            console.error(e);
            showPrivateToast('Lỗi kết nối máy chủ', 'err'); 
        }
    };

    // --- Helpers ---
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    }
    function escapeJS(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'");
    }

    function showPrivateToast(msg, type = 'ok') {
        let w = document.getElementById('toastWrap') || document.getElementById('toast-wrap');
        if (!w) {
            w = document.createElement('div');
            w.id = 'toastWrap';
            w.className = 'toast-wrap';
            w.style.position = 'fixed';
            w.style.top = '24px';
            w.style.right = '24px';
            w.style.zIndex = '99999';
            document.body.appendChild(w);
        }
        const t = document.createElement('div');
        const isSystem = w.id === 'toast-wrap';
        if (isSystem) {
            t.className = `toast-card ${type === 'ok' ? 'success' : 'error'}`;
            t.innerHTML = `<i class="bi bi-${type === 'ok' ? 'check-circle' : 'exclamation-triangle'}-fill"></i><span>${msg}</span>`;
        } else {
            t.className = `toast-msg show ${type}`;
            t.style.background = '#fff';
            t.style.padding = '14px 24px';
            t.style.borderRadius = '12px';
            t.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.12)';
            t.style.borderLeft = type === 'ok' ? '4px solid #10b981' : '4px solid #ef4444';
            t.style.fontWeight = '600';
            t.style.display = 'flex';
            t.style.alignItems = 'center';
            t.style.gap = '10px';
            t.style.marginBottom = '8px';
            t.innerHTML = `<i class="bi ${type==='ok'?'bi-check-circle-fill text-success':'bi-exclamation-triangle-fill text-danger'}"></i> ${msg}`;
        }
        w.appendChild(t);
        setTimeout(() => { t.classList.remove('show'); if(isSystem) t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, 3000);
    }
})();
