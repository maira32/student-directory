const form = document.getElementById('recordForm');
const grid = document.getElementById('dataGrid');
const searchInput = document.getElementById('searchInput');
const toastContainer = document.getElementById('toastContainer');

// View Elements
const btnShowAdd = document.getElementById('btnShowAdd');
const btnShowList = document.getElementById('btnShowList');
const addView = document.getElementById('addView');
const listView = document.getElementById('listView');

let studentsData = [];

// --- View Navigation Logic ---
function switchView(view) {
    if (view === 'add') {
        addView.classList.remove('hidden');
        listView.classList.add('hidden');
        btnShowAdd.classList.add('active');
        btnShowList.classList.remove('active');
    } else {
        addView.classList.add('hidden');
        listView.classList.remove('hidden');
        btnShowAdd.classList.remove('active');
        btnShowList.classList.add('active');
    }
}

btnShowAdd.addEventListener('click', () => switchView('add'));
btnShowList.addEventListener('click', () => switchView('list'));

// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Render & Load Data ---
function renderGrid(data) {
    grid.innerHTML = '';
    if (data.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="icon">📂</span>
                <h3>No records found</h3>
            </div>
        `;
        return;
    }
    
    data.forEach(item => {
        const el = document.createElement('div');
        el.className = 'record-card';
        el.innerHTML = `
            <div class="record-info">
                <h3>${item.name} <span class="badge">${item.major}</span></h3>
                <p>✉️ ${item.email} &nbsp;|&nbsp; 📞 ${item.phone}</p>
                <p>📍 ${item.address}</p>
            </div>
            <button onclick="removeItem(${item.id})" class="btn-delete">Delete</button>
        `;
        grid.appendChild(el);
    });
}

async function loadData() {
    try {
        const res = await fetch('/api/students');
        studentsData = await res.json();
        renderGrid(studentsData);
    } catch (err) {
        showToast('Failed to load data', 'error');
    }
}

// --- Interactions ---
searchInput.addEventListener('input', (e) => {
    switchView('list'); // Automatically show list when searching
    const term = e.target.value.toLowerCase();
    const filtered = studentsData.filter(student => 
        student.name.toLowerCase().includes(term) || 
        student.major.toLowerCase().includes(term)
    );
    renderGrid(filtered);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        major: document.getElementById('major').value,
        address: document.getElementById('address').value
    };
    
    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(`❌ Error: ${data.error}`, 'error');
            return;
        }
        
        form.reset();
        showToast('✅ Student Added Successfully');
        loadData();
    } catch (err) {
        showToast('Server connection failed', 'error');
    }
});

async function removeItem(id) {
    try {
        const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('🗑️ Record Deleted');
            loadData();
        }
    } catch (err) {
        showToast('Failed to delete record', 'error');
    }
}

// Initialize
loadData();