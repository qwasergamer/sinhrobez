// Основной JavaScript файл для Синхро-Безопасность

// ===== ДЕБАГ ИНФОРМАЦИЯ =====
console.log('Скрипт Синхро-Безопасность загружен');

// ===== INDEXEDDB ДЛЯ ХРАНЕНИЯ ЗАЯВОК =====

// Инициализация базы данных
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SyncSecurityDB', 1);
        
        request.onerror = function(event) {
            console.error('Ошибка IndexedDB:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log('База данных IndexedDB открыта');
            resolve(db);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Создаём хранилище для демо-заявок
            const demoStore = db.createObjectStore('demo_requests', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            
            // Индексы для быстрого поиска
            demoStore.createIndex('created_at', 'created_at');
            demoStore.createIndex('email', 'email');
            demoStore.createIndex('type', 'type');
            demoStore.createIndex('status', 'status');
            
            // Создаём хранилище для обращений в поддержку
            const supportStore = db.createObjectStore('support_requests', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            
            supportStore.createIndex('created_at', 'created_at');
            supportStore.createIndex('email', 'email');
            supportStore.createIndex('type', 'type');
            supportStore.createIndex('status', 'status');
            
            console.log('База данных IndexedDB создана');
        };
    });
}

// Сохранение демо-заявки в IndexedDB
async function saveDemoToDB(formData) {
    try {
        const db = await initDB();
        
        const transaction = db.transaction(['demo_requests'], 'readwrite');
        const store = transaction.objectStore('demo_requests');
        
        const requestData = {
            ...formData,
            type: 'demo',
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const request = store.add(requestData);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = function(event) {
                console.log('Демо-заявка сохранена в IndexedDB, ID:', event.target.result);
                resolve({ 
                    success: true, 
                    id: event.target.result,
                    ticket_number: 'D' + event.target.result.toString().padStart(6, '0')
                });
            };
            
            request.onerror = function(event) {
                console.error('Ошибка сохранения демо-заявки:', event.target.error);
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при сохранении в IndexedDB:', error);
        throw error;
    }
}

// Сохранение обращения в поддержку в IndexedDB
async function saveSupportToDB(formData) {
    try {
        const db = await initDB();
        
        const transaction = db.transaction(['support_requests'], 'readwrite');
        const store = transaction.objectStore('support_requests');
        
        const requestData = {
            ...formData,
            type: 'support',
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const request = store.add(requestData);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = function(event) {
                console.log('Обращение сохранено в IndexedDB, ID:', event.target.result);
                resolve({ 
                    success: true, 
                    id: event.target.result,
                    ticket_number: 'S' + event.target.result.toString().padStart(6, '0')
                });
            };
            
            request.onerror = function(event) {
                console.error('Ошибка сохранения обращения:', event.target.error);
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при сохранении в IndexedDB:', error);
        throw error;
    }
}

// Получение всех заявок из IndexedDB
async function getAllRequests() {
    try {
        const db = await initDB();
        
        return new Promise(async (resolve, reject) => {
            const requests = [];
            
            // Получаем демо-заявки
            const demoTransaction = db.transaction(['demo_requests'], 'readonly');
            const demoStore = demoTransaction.objectStore('demo_requests');
            const demoRequest = demoStore.getAll();
            
            demoRequest.onsuccess = function(event) {
                requests.push(...event.target.result.map(item => ({
                    ...item,
                    request_type: 'Демонстрация',
                    request_type_class: 'demo'
                })));
                
                // Получаем обращения в поддержку
                const supportTransaction = db.transaction(['support_requests'], 'readonly');
                const supportStore = supportTransaction.objectStore('support_requests');
                const supportRequest = supportStore.getAll();
                
                supportRequest.onsuccess = function(event) {
                    requests.push(...event.target.result.map(item => ({
                        ...item,
                        request_type: 'Техподдержка',
                        request_type_class: 'support'
                    })));
                    
                    // Сортируем по дате создания (новые сверху)
                    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    
                    console.log('Всего заявок из IndexedDB:', requests.length);
                    resolve(requests);
                };
                
                supportRequest.onerror = function(event) {
                    reject(event.target.error);
                };
            };
            
            demoRequest.onerror = function(event) {
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при получении заявок:', error);
        throw error;
    }
}

// Обновление статуса заявки
async function updateRequestStatus(requestId, type, newStatus) {
    try {
        const db = await initDB();
        
        const storeName = type === 'demo' ? 'demo_requests' : 'support_requests';
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const getRequest = store.get(requestId);
        
        return new Promise((resolve, reject) => {
            getRequest.onsuccess = function(event) {
                const request = event.target.result;
                if (!request) {
                    reject(new Error('Заявка не найдена'));
                    return;
                }
                
                request.status = newStatus;
                request.updated_at = new Date().toISOString();
                
                // Добавляем в историю статусов
                if (!request.status_history) {
                    request.status_history = [];
                }
                request.status_history.push({
                    status: newStatus,
                    date: new Date().toISOString(),
                    previous_status: request.status
                });
                
                const updateRequest = store.put(request);
                
                updateRequest.onsuccess = function() {
                    console.log(`Статус заявки ${requestId} обновлен на ${newStatus}`);
                    resolve({ success: true });
                };
                
                updateRequest.onerror = function(event) {
                    reject(event.target.error);
                };
            };
            
            getRequest.onerror = function(event) {
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при обновлении статуса:', error);
        throw error;
    }
}

// Удаление заявки
async function deleteRequest(requestId, type) {
    try {
        const db = await initDB();
        
        const storeName = type === 'demo' ? 'demo_requests' : 'support_requests';
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.delete(requestId);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = function() {
                console.log(`Заявка ${requestId} удалена`);
                resolve({ success: true });
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при удалении заявки:', error);
        throw error;
    }
}

// Получение статистики из IndexedDB
async function getDBStatistics() {
    try {
        const db = await initDB();
        
        return new Promise(async (resolve, reject) => {
            let total = 0;
            let demoCount = 0;
            let supportCount = 0;
            let todayCount = 0;
            let demoNew = 0;
            let supportNew = 0;
            
            const today = new Date().toDateString();
            
            // Считаем демо-заявки
            const demoTransaction = db.transaction(['demo_requests'], 'readonly');
            const demoStore = demoTransaction.objectStore('demo_requests');
            const demoRequest = demoStore.getAll();
            
            demoRequest.onsuccess = function(event) {
                const demoRequests = event.target.result;
                demoCount = demoRequests.length;
                demoNew = demoRequests.filter(r => r.status === 'new').length;
                
                // Считаем обращения в поддержку
                const supportTransaction = db.transaction(['support_requests'], 'readonly');
                const supportStore = supportTransaction.objectStore('support_requests');
                const supportRequest = supportStore.getAll();
                
                supportRequest.onsuccess = function(event) {
                    const supportRequests = event.target.result;
                    supportCount = supportRequests.length;
                    supportNew = supportRequests.filter(r => r.status === 'new').length;
                    
                    total = demoCount + supportCount;
                    
                    // Считаем сегодняшние заявки
                    const allRequests = [...demoRequests, ...supportRequests];
                    todayCount = allRequests.filter(request => {
                        const requestDate = new Date(request.created_at).toDateString();
                        return requestDate === today;
                    }).length;
                    
                    resolve({
                        total,
                        demo: demoCount,
                        support: supportCount,
                        today: todayCount,
                        demo_new: demoNew,
                        support_new: supportNew
                    });
                };
                
                supportRequest.onerror = function(event) {
                    reject(event.target.error);
                };
            };
            
            demoRequest.onerror = function(event) {
                reject(event.target.error);
            };
        });
        
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        throw error;
    }
}

// Очистка всех заявок
async function clearAllRequests() {
    try {
        const db = await initDB();
        
        // Очищаем демо-заявки
        const demoTransaction = db.transaction(['demo_requests'], 'readwrite');
        const demoStore = demoTransaction.objectStore('demo_requests');
        demoStore.clear();
        
        // Очищаем обращения в поддержку
        const supportTransaction = db.transaction(['support_requests'], 'readwrite');
        const supportStore = supportTransaction.objectStore('support_requests');
        supportStore.clear();
        
        console.log('Все заявки очищены из IndexedDB');
        return { success: true };
        
    } catch (error) {
        console.error('Ошибка при очистке заявок:', error);
        throw error;
    }
}

// Экспорт заявок в CSV
async function exportRequestsToCSV() {
    try {
        const requests = await getAllRequests();
        
        if (requests.length === 0) {
            return { success: false, message: 'Нет заявок для экспорта' };
        }
        
        // Заголовки CSV
        let csv = 'ID;Тип заявки;Статус;Компания;Имя;Должность;Телефон;Email;Система;Пользователи;Сообщение;Дата создания\n';
        
        // Данные
        requests.forEach(request => {
            const row = [
                request.id,
                request.request_type,
                request.status || 'new',
                `"${(request.company || '').replace(/"/g, '""')}"`,
                `"${(request.name || '').replace(/"/g, '""')}"`,
                `"${(request.position || '').replace(/"/g, '""')}"`,
                `"${(request.phone || '').replace(/"/g, '""')}"`,
                `"${(request.email || '').replace(/"/g, '""')}"`,
                `"${(request.system || request.system_type || '').replace(/"/g, '""')}"`,
                `"${(request.users || request.users_count || '').replace(/"/g, '""')}"`,
                `"${((request.problem || request.message || '').replace(/"/g, '""')).replace(/\n/g, ' ')}"`,
                new Date(request.created_at).toLocaleString('ru-RU')
            ];
            
            csv += row.join(';') + '\n';
        });
        
        return { success: true, csv: csv };
        
    } catch (error) {
        console.error('Ошибка при экспорте:', error);
        throw error;
    }
}

// ===== ОБНОВЛЁННЫЕ ФУНКЦИИ ДЛЯ ФОРМ =====

// Сохранение демо-заявки (обновлённая)
async function saveDemoRequest(formData) {
    try {
        // Сохраняем в IndexedDB
        const dbResult = await saveDemoToDB(formData);
        
        // Также сохраняем в localStorage для совместимости
        let requests = JSON.parse(localStorage.getItem('sync_demo_requests') || '[]');
        requests.push({
            ...formData,
            id: dbResult.id,
            ticket_number: dbResult.ticket_number,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            type: 'demo',
            status: 'new'
        });
        
        if (requests.length > 100) {
            requests = requests.slice(-50);
        }
        
        localStorage.setItem('sync_demo_requests', JSON.stringify(requests));
        
        console.log('✅ Демо-заявка сохранена в IndexedDB и localStorage');
        
        return { 
            success: true, 
            id: dbResult.id,
            ticket_number: dbResult.ticket_number,
            count: requests.length 
        };
        
    } catch (error) {
        console.error('Ошибка сохранения демо-заявки:', error);
        
        // Резервный вариант - только localStorage
        try {
            let requests = JSON.parse(localStorage.getItem('sync_demo_requests') || '[]');
            
            formData.timestamp = new Date().toISOString();
            formData.created_at = formData.timestamp;
            formData.type = 'demo';
            formData.status = 'new';
            formData.id = Date.now();
            formData.ticket_number = 'D' + formData.id.toString().slice(-6);
            
            requests.push(formData);
            
            if (requests.length > 100) {
                requests = requests.slice(-50);
            }
            
            localStorage.setItem('sync_demo_requests', JSON.stringify(requests));
            
            console.log('⚠️ Демо-заявка сохранена только в localStorage (резервный режим)');
            
            return { 
                success: true, 
                id: formData.id,
                ticket_number: formData.ticket_number,
                count: requests.length,
                backup: true 
            };
        } catch (localError) {
            return { success: false, error: error.message };
        }
    }
}

// Сохранение обращения в поддержку (обновлённая)
async function saveSupportRequest(formData) {
    try {
        // Сохраняем в IndexedDB
        const dbResult = await saveSupportToDB(formData);
        
        // Также сохраняем в localStorage для совместимости
        let requests = JSON.parse(localStorage.getItem('sync_support_requests') || '[]');
        requests.push({
            ...formData,
            id: dbResult.id,
            ticket_number: dbResult.ticket_number,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            type: 'support',
            status: 'new'
        });
        
        if (requests.length > 100) {
            requests = requests.slice(-50);
        }
        
        localStorage.setItem('sync_support_requests', JSON.stringify(requests));
        
        console.log('✅ Обращение сохранено в IndexedDB и localStorage');
        
        return { 
            success: true, 
            id: dbResult.id,
            ticket_number: dbResult.ticket_number,
            count: requests.length 
        };
        
    } catch (error) {
        console.error('Ошибка сохранения обращения:', error);
        
        // Резервный вариант - только localStorage
        try {
            let requests = JSON.parse(localStorage.getItem('sync_support_requests') || '[]');
            
            formData.timestamp = new Date().toISOString();
            formData.created_at = formData.timestamp;
            formData.type = 'support';
            formData.status = 'new';
            formData.id = Date.now();
            formData.ticket_number = 'S' + formData.id.toString().slice(-6);
            
            requests.push(formData);
            
            if (requests.length > 100) {
                requests = requests.slice(-50);
            }
            
            localStorage.setItem('sync_support_requests', JSON.stringify(requests));
            
            console.log('⚠️ Обращение сохранено только в localStorage (резервный режим)');
            
            return { 
                success: true, 
                id: formData.id,
                ticket_number: formData.ticket_number,
                count: requests.length,
                backup: true 
            };
        } catch (localError) {
            return { success: false, error: error.message };
        }
    }
}

// Получение всех заявок (обновлённая, совместимая)
async function getRequestsStatistics() {
    try {
        const dbStats = await getDBStatistics();
        return dbStats;
    } catch (error) {
        console.error('Ошибка получения статистики из DB:', error);
        
        // Резервный вариант - из localStorage
        const demoRequests = JSON.parse(localStorage.getItem('sync_demo_requests') || '[]');
        const supportRequests = JSON.parse(localStorage.getItem('sync_support_requests') || '[]');
        
        const today = new Date().toDateString();
        let todayCount = 0;
        
        [...demoRequests, ...supportRequests].forEach(request => {
            const requestDate = new Date(request.timestamp || request.created_at).toDateString();
            if (requestDate === today) {
                todayCount++;
            }
        });
        
        return {
            total: demoRequests.length + supportRequests.length,
            demo: demoRequests.length,
            support: supportRequests.length,
            today: todayCount,
            demo_new: demoRequests.filter(r => r.status === 'new').length,
            support_new: supportRequests.filter(r => r.status === 'new').length
        };
    }
}

// ===== СТАРЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ =====

// Функция для совместимости со старым кодом
function saveDemoRequestOld(formData) {
    try {
        let requests = JSON.parse(localStorage.getItem('sync_demo_requests') || '[]');
        
        formData.timestamp = new Date().toISOString();
        formData.created_at = formData.timestamp;
        formData.type = 'demo';
        
        requests.push(formData);
        
        if (requests.length > 100) {
            requests = requests.slice(-50);
        }
        
        localStorage.setItem('sync_demo_requests', JSON.stringify(requests));
        
        console.log('Демо-заявка сохранена (старый метод):', formData);
        console.log('Всего демо-заявок:', requests.length);
        
        return { success: true, count: requests.length };
    } catch (error) {
        console.error('Ошибка сохранения демо-заявки (старый метод):', error);
        return { success: false, error: error.message };
    }
}

// Функция для совместимости со старым кодом
function saveSupportRequestOld(formData) {
    try {
        let requests = JSON.parse(localStorage.getItem('sync_support_requests') || '[]');
        
        formData.timestamp = new Date().toISOString();
        formData.created_at = formData.timestamp;
        formData.type = 'support';
        
        requests.push(formData);
        
        if (requests.length > 100) {
            requests = requests.slice(-50);
        }
        
        localStorage.setItem('sync_support_requests', JSON.stringify(requests));
        
        console.log('Обращение в поддержку сохранено (старый метод):', formData);
        console.log('Всего обращений:', requests.length);
        
        return { success: true, count: requests.length };
    } catch (error) {
        console.error('Ошибка сохранения обращения (старый метод):', error);
        return { success: false, error: error.message };
    }
}

// Проверка, есть ли сохраненные заявки
function hasSavedRequests() {
    const demoRequests = JSON.parse(localStorage.getItem('sync_demo_requests') || '[]');
    const supportRequests = JSON.parse(localStorage.getItem('sync_support_requests') || '[]');
    
    return demoRequests.length > 0 || supportRequests.length > 0;
}

// ===== УНИВЕРСАЛЬНЫЕ ФУНКЦИИ =====

// Функция экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Функция показа уведомления
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Стили уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Кнопка закрытия
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 1.2rem;
        margin-left: 15px;
        opacity: 0.8;
    `;
    
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Автоматическое скрытие
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== ОСНОВНОЙ КОД =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM полностью загружен');
    
    // ===== ПРОВЕРКА ЭЛЕМЕНТОВ =====
    console.log('Кнопка бокового меню:', document.getElementById('sideMenuBtn'));
    console.log('Боковое меню:', document.getElementById('sideMenu'));
    console.log('Основная навигация:', document.getElementById('mainNav'));
    
    // ===== БОКОВОЕ МЕНЮ =====
    const sideMenuBtn = document.getElementById('sideMenuBtn');
    const sideMenu = document.getElementById('sideMenu');
    const closeSideMenu = document.getElementById('closeSideMenu');
    
    if (sideMenuBtn && sideMenu) {
        console.log('Элементы бокового меню найдены');
        
        // Создаём перекрытие фона
        const menuOverlay = document.createElement('div');
        menuOverlay.className = 'menu-overlay';
        document.body.appendChild(menuOverlay);
        
        // Открытие бокового меню
        sideMenuBtn.addEventListener('click', function() {
            console.log('Открытие бокового меню');
            sideMenu.classList.add('active');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        // Закрытие бокового меню
        const closeMenu = function() {
            console.log('Закрытие бокового меню');
            sideMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        };
        
        if (closeSideMenu) {
            closeSideMenu.addEventListener('click', closeMenu);
        }
        
        menuOverlay.addEventListener('click', closeMenu);
        
        // Закрытие при клике на ссылку в меню
        document.querySelectorAll('.side-menu-nav a').forEach(function(link) {
            link.addEventListener('click', closeMenu);
        });
    } else {
        console.error('Элементы бокового меню не найдены!');
    }
    
    // ===== ФОРМА ДЕМОНСТРАЦИИ (contacts.html) =====
    const demoForm = document.getElementById('demoForm');
    if (demoForm) {
        console.log('Форма демонстрации найдена');
        
        demoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Отправка формы демо');
            
            // Собираем данные формы
            const formData = {
                name: document.getElementById('full_name')?.value || document.getElementById('name')?.value || '',
                company: document.getElementById('company')?.value || '',
                position: document.getElementById('position')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                email: document.getElementById('email')?.value || '',
                users_count: document.getElementById('users_count')?.value || document.getElementById('users')?.value || '',
                system_type: document.getElementById('system_type')?.value || document.getElementById('system')?.value || '',
                message: document.getElementById('message')?.value || ''
            };
            
            // Валидация
            const phoneRegex = /^(\+7|8)[\s(]?\d{3}[)\s]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!formData.name.trim()) {
                showNotification('Пожалуйста, введите ваше имя', 'error');
                return;
            }
            
            if (!formData.company.trim()) {
                showNotification('Пожалуйста, введите название компании', 'error');
                return;
            }
            
            if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
                showNotification('Пожалуйста, введите корректный номер телефона', 'error');
                return;
            }
            
            if (!emailRegex.test(formData.email)) {
                showNotification('Пожалуйста, введите корректный email адрес', 'error');
                return;
            }
            
            // Показываем загрузку
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
                submitBtn.disabled = true;
                
                try {
                    // Сохраняем заявку в IndexedDB
                    const result = await saveDemoRequest(formData);
                    
                    if (result.success) {
                        showNotification(`Заявка на демонстрацию сохранена! Номер: ${result.ticket_number}`, 'success');
                        demoForm.reset();
                        
                        // Показываем модальное окно успеха если есть
                        const successModal = document.getElementById('successModal');
                        if (successModal) {
                            // Обновляем номер заявки в модальном окне
                            const ticketSpan = document.getElementById('ticketNumber');
                            if (ticketSpan && result.ticket_number) {
                                ticketSpan.textContent = result.ticket_number;
                            }
                            successModal.style.display = 'flex';
                        }
                    } else {
                        showNotification(`Ошибка сохранения: ${result.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Ошибка:', error);
                    showNotification('Ошибка при сохранении заявки', 'error');
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            } else {
                // Старый метод для совместимости
                const result = saveDemoRequestOld(formData);
                
                if (result.success) {
                    showNotification(`Заявка на демонстрацию сохранена! Всего заявок: ${result.count}`, 'success');
                    demoForm.reset();
                    
                    const successModal = document.getElementById('successModal');
                    if (successModal) {
                        successModal.style.display = 'flex';
                    }
                } else {
                    showNotification(`Ошибка сохранения: ${result.error}`, 'error');
                }
            }
        });
    }
    
    // ===== ФОРМА ПОДДЕРЖКИ (support.html) =====
    const supportForm = document.getElementById('supportForm');
    if (supportForm) {
        console.log('Форма поддержки найдена');
        
        supportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Отправка формы поддержки');
            
            // Собираем данные формы
            const formData = {
                name: document.getElementById('supportName')?.value || document.getElementById('name')?.value || '',
                company: document.getElementById('supportCompany')?.value || document.getElementById('company')?.value || '',
                phone: document.getElementById('supportPhone')?.value || document.getElementById('phone')?.value || '',
                email: document.getElementById('supportEmail')?.value || document.getElementById('email')?.value || '',
                system_type: document.getElementById('supportSystem')?.value || document.getElementById('system_type')?.value || '',
                problem: document.getElementById('supportProblem')?.value || document.getElementById('problem_description')?.value || ''
            };
            
            // Валидация
            const phoneRegex = /^(\+7|8)[\s(]?\d{3}[)\s]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!formData.name.trim()) {
                showNotification('Пожалуйста, введите ваше имя', 'error');
                return;
            }
            
            if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
                showNotification('Пожалуйста, введите корректный номер телефона', 'error');
                return;
            }
            
            if (!emailRegex.test(formData.email)) {
                showNotification('Пожалуйста, введите корректный email адрес', 'error');
                return;
            }
            
            if (!formData.problem.trim()) {
                showNotification('Пожалуйста, опишите проблему', 'error');
                return;
            }
            
            // Показываем загрузку
            const supportSubmitBtn = document.getElementById('supportSubmitBtn');
            if (supportSubmitBtn) {
                const originalText = supportSubmitBtn.innerHTML;
                supportSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
                supportSubmitBtn.disabled = true;
                
                try {
                    // Сохраняем обращение в IndexedDB
                    const result = await saveSupportRequest(formData);
                    
                    if (result.success) {
                        // Показываем модальное окно с номером тикета
                        const ticketNumberSpan = document.getElementById('ticketNumber');
                        if (ticketNumberSpan && result.ticket_number) {
                            ticketNumberSpan.textContent = result.ticket_number;
                        }
                        
                        const successModal = document.getElementById('successModal');
                        if (successModal) {
                            successModal.style.display = 'flex';
                        }
                        
                        showNotification(`Обращение в поддержку сохранено! Номер: ${result.ticket_number}`, 'success');
                        supportForm.reset();
                        
                    } else {
                        showNotification(`Ошибка сохранения: ${result.error}`, 'error');
                    }
                } catch (error) {
                    console.error('Ошибка:', error);
                    showNotification('Ошибка при сохранении обращения', 'error');
                } finally {
                    supportSubmitBtn.innerHTML = originalText;
                    supportSubmitBtn.disabled = false;
                }
            } else {
                // Старый метод для совместимости
                const result = saveSupportRequestOld(formData);
                
                if (result.success) {
                    showNotification(`Обращение в поддержку сохранено! Всего обращений: ${result.count}`, 'success');
                    supportForm.reset();
                    
                    const successModal = document.getElementById('successModal');
                    if (successModal) {
                        successModal.style.display = 'flex';
                    }
                } else {
                    showNotification(`Ошибка сохранения: ${result.error}`, 'error');
                }
            }
        });
    }
    
    // ===== СТАРАЯ ФОРМА ОБРАТНОЙ СВЯЗИ (для совместимости) =====
    const contactForm = document.getElementById('contactForm');
    if (contactForm && !demoForm && !supportForm) {
        console.log('Старая форма обратной связи найдена');
        
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Отправка старой формы');
            
            // Собираем данные
            const formData = {
                name: document.getElementById('name')?.value || '',
                company: document.getElementById('company')?.value || '',
                position: document.getElementById('position')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                email: document.getElementById('email')?.value || '',
                users: document.getElementById('users')?.value || '',
                system: document.getElementById('system')?.value || '',
                message: document.getElementById('message')?.value || ''
            };
            
            // Валидация
            const phoneRegex = /^(\+7|8)[\s(]?\d{3}[)\s]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
                showNotification('Пожалуйста, введите корректный номер телефона', 'error');
                return;
            }
            
            if (!emailRegex.test(formData.email)) {
                showNotification('Пожалуйста, введите корректный email адрес', 'error');
                return;
            }
            
            if (!formData.name.trim() || !formData.company.trim()) {
                showNotification('Пожалуйста, заполните все обязательные поля', 'error');
                return;
            }
            
            // Показываем загрузку
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
                submitBtn.disabled = true;
                
                try {
                    // Пробуем сохранить как демо-заявку
                    const result = await saveDemoRequest(formData);
                    
                    if (result.success) {
                        showNotification(`Заявка сохранена! Номер: ${result.ticket_number}`, 'success');
                        contactForm.reset();
                        
                        // Показываем модальное окно успеха
                        const successModal = document.getElementById('successModal');
                        if (successModal) {
                            successModal.style.display = 'flex';
                        }
                    } else {
                        // Резервный вариант
                        let submissions = JSON.parse(localStorage.getItem('syncsecurity_submissions') || '[]');
                        formData.timestamp = new Date().toISOString();
                        submissions.push(formData);
                        localStorage.setItem('syncsecurity_submissions', JSON.stringify(submissions));
                        
                        showNotification('Спасибо за заявку! Мы свяжемся с вами в ближайшее время.', 'success');
                        contactForm.reset();
                        
                        const successModal = document.getElementById('successModal');
                        if (successModal) {
                            successModal.style.display = 'flex';
                        }
                    }
                } catch (error) {
                    console.error('Ошибка:', error);
                    showNotification('Ошибка при сохранении заявки', 'error');
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }
        });
    }
    
    // Закрытие модального окна успеха
    const closeSuccessModal = document.getElementById('closeSuccessModal');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    const successModal = document.getElementById('successModal');
    
    if (closeSuccessModal) {
        closeSuccessModal.addEventListener('click', function() {
            if (successModal) {
                successModal.style.display = 'none';
                console.log('Модальное окно закрыто');
            }
        });
    }
    
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', function() {
            if (successModal) {
                successModal.style.display = 'none';
                console.log('Модальное окно закрыто (кнопкой)');
            }
        });
    }
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(e) {
        if (successModal && e.target === successModal) {
            successModal.style.display = 'none';
            console.log('Модальное окно закрыто (клик вне окна)');
        }
    });
    
    // ===== ПЛАВНАЯ ПРОКРУТКА ДЛЯ ЯКОРЕЙ =====
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Пропускаем якорь "#" без имени
            if (href === '#') return;
            
            const targetElement = document.querySelector(href);
            if (targetElement) {
                e.preventDefault();
                console.log('Прокрутка к якорю:', href);
                
                // Закрываем боковое меню если открыто
                if (sideMenu && sideMenu.classList.contains('active')) {
                    sideMenu.classList.remove('active');
                    const overlay = document.querySelector('.menu-overlay');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
                
                const headerHeight = document.querySelector('.main-header')?.offsetHeight || 80;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ===== АНИМАЦИЯ ПРИ СКРОЛЛЕ =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                console.log('Анимация добавлена для:', entry.target);
            }
        });
    }, observerOptions);
    
    // Наблюдаем за всеми карточками
    document.querySelectorAll('.feature-card, .stat-item, .client-logo').forEach(function(element) {
        observer.observe(element);
    });
    
    // ===== ТАБЛИЦА ТРЕБОВАНИЙ (для requirements.html) =====
    const requirementsTable = document.querySelector('.requirements-table');
    if (requirementsTable) {
        console.log('Таблица требований найдена');
        
        // Добавляем эффект при наведении
        requirementsTable.addEventListener('mouseover', function(e) {
            if (e.target.tagName === 'TD') {
                e.target.parentNode.style.backgroundColor = 'rgba(243, 156, 18, 0.1)';
            }
        });
        
        requirementsTable.addEventListener('mouseout', function(e) {
            if (e.target.tagName === 'TD') {
                const row = e.target.parentNode;
                if (row.rowIndex % 2 === 0) {
                    row.style.backgroundColor = 'var(--oil-light)';
                } else {
                    row.style.backgroundColor = 'transparent';
                }
            }
        });
    }
    
    // ===== ОБРАБОТКА ФОРМЫ КОНТАКТОВ =====
    function initContactForm() {
        const contactForm = document.getElementById('contactForm');
        if (!contactForm) return;
        
        // Обработка email с выбором домена
        const emailName = document.getElementById('emailName');
        const emailDomain = document.getElementById('emailDomain');
        const customDomain = document.getElementById('customDomain');
        const otherDomain = document.getElementById('otherDomain');
        const emailField = document.getElementById('email');
        
        if (emailName && emailDomain && emailField) {
            // Обновление скрытого поля email
            function updateEmail() {
                let domain = emailDomain.value;
                if (domain === 'other' && otherDomain) {
                    domain = otherDomain.value;
                }
                if (emailName.value && domain) {
                    emailField.value = emailName.value + '@' + domain;
                } else {
                    emailField.value = '';
                }
            }
            
            emailName.addEventListener('input', updateEmail);
            
            if (emailDomain) {
                emailDomain.addEventListener('change', function() {
                    if (this.value === 'other' && customDomain) {
                        customDomain.style.display = 'block';
                    } else {
                        if (customDomain) customDomain.style.display = 'none';
                        updateEmail();
                    }
                });
            }
            
            if (otherDomain) {
                otherDomain.addEventListener('input', updateEmail);
            }
        }
        
        // Обработка чекбокса согласия
        const privacyCheck = document.getElementById('privacyCheck');
        const privacyLink = document.getElementById('privacyLink');
        const privacyModal = document.getElementById('privacyModal');
        const closePrivacyModal = document.getElementById('closePrivacyModal');
        const acceptPrivacyBtn = document.getElementById('acceptPrivacyBtn');
        
        if (privacyLink && privacyModal) {
            // Открытие модального окна с политикой
            privacyLink.addEventListener('click', function(e) {
                e.preventDefault();
                privacyModal.style.display = 'flex';
            });
            
            if (closePrivacyModal) {
                closePrivacyModal.addEventListener('click', function() {
                    privacyModal.style.display = 'none';
                });
            }
            
            if (acceptPrivacyBtn) {
                acceptPrivacyBtn.addEventListener('click', function() {
                    if (privacyCheck) privacyCheck.checked = true;
                    privacyModal.style.display = 'none';
                });
            }
            
            // Закрытие при клике вне окна
            window.addEventListener('click', function(e) {
                if (e.target === privacyModal) {
                    privacyModal.style.display = 'none';
                }
            });
        }
    }
    
    // Вызов функции при загрузке
    if (document.getElementById('contactForm')) {
        initContactForm();
    }
    
    // ===== ОБРАБОТКА МОДАЛЬНЫХ ОКОН =====
    const contactModal = document.getElementById('contactModal');
    const closeModal = document.getElementById('closeModal');
    
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            if (contactModal) {
                contactModal.style.display = 'none';
                console.log('Контактное модальное окно закрыто');
            }
        });
    }
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(e) {
        if (contactModal && e.target === contactModal) {
            contactModal.style.display = 'none';
            console.log('Контактное модальное окно закрыто (клик вне окна)');
        }
    });
    
    // ===== ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ ГОДА В ПОДВАЛЕ =====
    const currentYear = new Date().getFullYear();
    const yearElements = document.querySelectorAll('.current-year');
    yearElements.forEach(function(el) {
        el.textContent = currentYear;
    });
    console.log('Год обновлен:', currentYear);
    
    // ===== ПОДСВЕТКА АКТИВНОЙ СТРАНИЦЫ В НАВИГАЦИИ =====
    function updateActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        console.log('Текущая страница:', currentPage);
        
        // Основная навигация
        document.querySelectorAll('.main-nav a').forEach(function(link) {
            const linkHref = link.getAttribute('href');
            if (linkHref === currentPage || 
                (currentPage === '' && linkHref === 'index.html') ||
                (linkHref === 'index.html' && currentPage === '')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Боковое меню
        document.querySelectorAll('.side-menu-nav a').forEach(function(link) {
            const linkHref = link.getAttribute('href');
            if (linkHref === currentPage || 
                (currentPage === '' && linkHref === 'index.html') ||
                (linkHref === 'index.html' && currentPage === '')) {
                link.style.color = 'var(--oil-gold)';
                link.style.fontWeight = 'bold';
            } else {
                link.style.color = '';
                link.style.fontWeight = '';
            }
        });
    }
    
    // Вызываем при загрузке
    updateActiveNav();
    
    // ===== КНОПКА "НАВЕРХ" =====
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.className = 'scroll-top-btn';
    scrollToTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    scrollToTopBtn.setAttribute('aria-label', 'Наверх');
    scrollToTopBtn.setAttribute('title', 'Наверх');
    document.body.appendChild(scrollToTopBtn);
    console.log('Кнопка "Наверх" создана');
    
    scrollToTopBtn.addEventListener('click', function() {
        console.log('Прокрутка наверх');
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.style.display = 'flex';
        } else {
            scrollToTopBtn.style.display = 'none';
        }
    });
    
    // ===== ЗАГРУЗКА ИЗОБРАЖЕНИЙ С ОШИБКОЙ =====
    document.querySelectorAll('img').forEach(function(img) {
        img.addEventListener('error', function() {
            console.warn('Ошибка загрузки изображения:', this.src);
            this.style.display = 'none';
        });
    });
    
    // ===== ИНИЦИАЛИЗАЦИЯ ВСЕХ ФОРМ =====
    document.querySelectorAll('form').forEach(function(form, index) {
        console.log('Форма #' + index + ' найдена:', form.id || 'без ID');
    });
    
    // ===== СБОР СТАТИСТИКИ ПОСЕЩЕНИЙ =====
    try {
        let visits = JSON.parse(localStorage.getItem('syncsecurity_visits') || '[]');
        const visitData = {
            page: window.location.pathname,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        visits.push(visitData);
        if (visits.length > 100) {
            visits = visits.slice(-50); // Храним только последние 50 посещений
        }
        localStorage.setItem('syncsecurity_visits', JSON.stringify(visits));
        console.log('Статистика посещений сохранена');
    } catch (error) {
        console.error('Ошибка сохранения статистики:', error);
    }
    
    // ===== ДОБАВЛЯЕМ CSS ДЛЯ УВЕДОМЛЕНИЙ =====
    const notificationStyles = document.createElement('style');
    notificationStyles.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .scroll-top-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            background: var(--oil-blue);
            color: white;
            border: none;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s;
        }
        
        .scroll-top-btn:hover {
            background: var(--oil-dark);
            transform: translateY(-3px);
        }
        
        .menu-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
            display: none;
        }
        
        .menu-overlay.active {
            display: block;
        }
    `;
    document.head.appendChild(notificationStyles);
    
    console.log('Все скрипты инициализированы успешно');
    
    // ===== ПОКАЗЫВАЕМ СТАТИСТИКУ В КОНСОЛИ =====
    setTimeout(async () => {
        try {
            const stats = await getRequestsStatistics();
            console.log('📊 Статистика заявок:', stats);
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
        }
    }, 1000);
});

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ =====
function openContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('Контактное модальное окно открыто');
    }
}

function closeContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.style.display = 'none';
        console.log('Контактное модальное окно закрыто');
    }
}

// ===== ОБРАБОТЧИК ОШИБОК =====
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.message, 'в', e.filename, 'строка', e.lineno);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Необработанное обещание:', e.reason);
});

// ===== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
if (typeof window !== 'undefined') {
    window.saveDemoRequest = saveDemoRequest;
    window.saveSupportRequest = saveSupportRequest;
    window.getRequestsStatistics = getRequestsStatistics;
    window.getAllRequests = getAllRequests;
    window.updateRequestStatus = updateRequestStatus;
    window.deleteRequest = deleteRequest;
    window.clearAllRequests = clearAllRequests;
    window.exportRequestsToCSV = exportRequestsToCSV;
    window.showNotification = showNotification;
    window.initDB = initDB;
    window.getDBStatistics = getDBStatistics;
    
    // Старые функции для совместимости
    window.saveDemoRequestOld = saveDemoRequestOld;
    window.saveSupportRequestOld = saveSupportRequestOld;
    window.hasSavedRequests = hasSavedRequests;
}

console.log('Скрипт Синхро-Безопасность полностью загружен и готов к работе');
