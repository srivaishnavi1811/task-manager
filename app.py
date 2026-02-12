from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

# Create data directory and init DB
os.makedirs('data', exist_ok=True)

def init_db():
    conn = sqlite3.connect('data/tasks.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS tasks
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  description TEXT,
                  completed INTEGER DEFAULT 0,
                  priority TEXT DEFAULT 'medium',
                  due_date TEXT,
                  created_at TEXT,
                  category TEXT)''')
    conn.commit()
    conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect('data/tasks.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    conn = get_db_connection()
    
    if request.method == 'POST':
        data = request.get_json()
        c = conn.cursor()
        c.execute('''INSERT INTO tasks (title, description, priority, due_date, category, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (data['title'], data.get('description', ''),
                   data.get('priority', 'medium'), data.get('due_date', ''),
                   data.get('category', ''), datetime.now().isoformat()))
        conn.commit()
        task_id = c.lastrowid
        conn.close()
        return jsonify({'id': task_id, 'success': True})
    
    # GET all tasks
    tasks = conn.execute('SELECT * FROM tasks ORDER BY created_at DESC').fetchall()
    tasks_list = []
    for task in tasks:
        tasks_list.append(dict(task))
    conn.close()
    return jsonify(tasks_list)

@app.route('/api/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
def task_detail(task_id):
    conn = get_db_connection()
    
    if request.method == 'PUT':
        data = request.get_json()
        c = conn.cursor()
        c.execute('''UPDATE tasks SET title=?, description=?, completed=?, priority=?, due_date=?, category=?
                     WHERE id=?''',
                  (data['title'], data.get('description', ''), data['completed'],
                   data.get('priority', 'medium'), data.get('due_date', ''),
                   data.get('category', ''), task_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    
    if request.method == 'DELETE':
        c = conn.cursor()
        c.execute('DELETE FROM tasks WHERE id=?', (task_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/stats')
def stats():
    conn = get_db_connection()
    total = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed=1').fetchone()[0]
    pending = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed=0').fetchone()[0]
    conn.close()
    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
