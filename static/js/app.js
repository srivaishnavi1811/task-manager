class SmartTaskApp {
    constructor() {
        this.tasks = [];
        this.currentTab = 'all';
        this.editingTaskId = null;  // 👈 NEW: Track editing task
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadTasks();
        await this.loadStats();
        this.updateTheme();
    }

    bindEvents() {
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('addBtn').addEventListener('click', () => this.showQuickAdd());
        document.getElementById('addQuickTask').addEventListener('click', () => this.addQuickTask());
        document.getElementById('quickInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addQuickTask();
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        document.getElementById('closeModal').addEventListener('click', () => this.hideModal());
        document.getElementById('deleteTask').addEventListener('click', () => this.deleteTask());  // 👈 FIXED
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') this.hideModal();
        });
    }

    async api(endpoint, options = {}) {
        const config = {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            ...(options.body && { body: JSON.stringify(options.body) })
        };
        const response = await fetch(`/api${endpoint}`, config);
        if (!response.ok) throw new Error('API Error');
        return response.json();
    }

    async loadTasks() {
        this.tasks = await this.api('/tasks');
        this.renderTasks();
        this.updateEmptyState();
    }

    async loadStats() {
        const stats = await this.api('/stats');
        document.getElementById('total-tasks').textContent = stats.total;
        document.getElementById('completed-tasks').textContent = stats.completed;
        document.getElementById('pending-tasks').textContent = stats.pending;
    }

    renderTasks() {
        const container = document.getElementById('tasksList');
        const filteredTasks = this.filterTasks();
        
        container.innerHTML = filteredTasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="app.toggleTask(${task.id})"></div>
                <div class="task-content" onclick="app.editTask(${task.id})">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-meta">${this.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        ${task.priority ? `<span class="priority-${task.priority}">• ${task.priority}</span>` : ''}
                        ${task.category ? `<span>• ${task.category}</span>` : ''}
                        ${task.due_date ? `<span>• ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action edit-btn" onclick="app.editTask(${task.id}); event.stopPropagation();">✏️</button>
                    <button class="task-action delete-btn" onclick="app.deleteTask(${task.id}); event.stopPropagation();">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    // 👈 FIXED: Direct delete from task list (no modal needed)
    async deleteTask(id) {
        if (!confirm('Delete this task?')) return;
        
        try {
            await this.api(`/tasks/${id}`, { method: 'DELETE' });
            await this.loadTasks();
            await this.loadStats();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Delete failed. Please try again.');
        }
    }

    filterTasks() {
        return this.tasks.filter(task => {
            switch(this.currentTab) {
                case 'pending': return !task.completed;
                case 'completed': return task.completed;
                case 'high': return task.priority === 'high';
                default: return true;
            }
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        this.renderTasks();
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        await this.api(`/tasks/${id}`, { method: 'PUT', body: task });
        await this.loadStats();
        this.renderTasks();
    }

    editTask(id) {
        this.editingTaskId = id;  // 👈 FIXED: Store task ID
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDesc').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority || 'medium';
        document.getElementById('taskDueDate').value = task.due_date || '';
        document.getElementById('taskCategory').value = task.category || '';
        document.getElementById('taskModal').classList.add('show');
    }

    async saveTask() {
        const task = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDesc').value,
            priority: document.getElementById('taskPriority').value,
            due_date: document.getElementById('taskDueDate').value,
            category: document.getElementById('taskCategory').value,
            completed: this.tasks.find(t => t.id === this.editingTaskId)?.completed || false
        };

        if (this.editingTaskId) {
            await this.api(`/tasks/${this.editingTaskId}`, { method: 'PUT', body: task });
        } else {
            await this.api('/tasks', { method: 'POST', body: task });
        }

        this.hideModal();
        await this.loadTasks();
        await this.loadStats();
    }

    showQuickAdd() {
        this.editingTaskId = null;  // 👈 Reset for new task
        document.getElementById('modalTitle').textContent = 'New Task';
        document.getElementById('taskForm').reset();
        document.getElementById('quickAddOverlay').classList.add('show');
        document.getElementById('quickInput').focus();
    }

    hideQuickAdd() {
        document.getElementById('quickAddOverlay').classList.remove('show');
        document.getElementById('quickInput').value = '';
    }

    async addQuickTask() {
        const title = document.getElementById('quickInput').value.trim();
        const priority = document.getElementById('prioritySelect').value;
        if (!title) return;
        
        await this.api('/tasks', { method: 'POST', body: { title, priority } });
        this.hideQuickAdd();
        await this.loadTasks();
        await this.loadStats();
    }

    hideModal() {
        document.getElementById('taskModal').classList.remove('show');
        document.getElementById('taskForm').reset();
        this.editingTaskId = null;
    }

    updateEmptyState() {
        document.getElementById('emptyState').style.display = this.tasks.length ? 'none' : 'block';
    }

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    }

    updateTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const app = new SmartTaskApp();
