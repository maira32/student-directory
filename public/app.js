// DOM Elements
const authView = document.getElementById('authView');
const appContainer = document.getElementById('appContainer');
const userProfile = document.getElementById('userProfile');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const recordForm = document.getElementById('recordForm');
const grid = document.getElementById('dataGrid');
const searchInput = document.getElementById('searchInput');
const toastContainer = document.getElementById('toastContainer');

const btnShowDashboard = document.getElementById('btnShowDashboard');
const btnShowAdd = document.getElementById('btnShowAdd');
const btnShowList = document.getElementById('btnShowList');
const dashboardView = document.getElementById('dashboardView');
const addView = document.getElementById('addView');
const listView = document.getElementById('listView');

let studentsData = [];

// ==========================================
//          AUTHENTICATION & STATE
// ==========================================

function getToken() {
    return localStorage.getItem('hostel_jwt_token');
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

// Check session on page load
function checkAuth() {
    const token = getToken();
    const ownerName = localStorage.getItem('hostel_owner_name');
    const hostelName = localStorage.getItem('hostel_name');

    if (!token) {
        authView.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userProfile.classList.add('hidden');
    } else {
        authView.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userProfile.classList.remove('hidden');

        document.getElementById('ownerNameLabel').textContent = ownerName || 'Admin';
        document.getElementById('ownerHostelLabel').textContent = `${hostelName || 'Hostel Dashboard'}`;

        loadData(); 
    }
}

function toggleAuthMode(mode) {
    if (mode === 'register') {
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    } else {
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    }
}

// Toggle password visibility helper
function togglePassword(inputId, buttonEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        buttonEl.textContent = 'Hide';
    } else {
        input.type = 'password';
        buttonEl.textContent = 'Show';
    }
}

// LOGIN
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) return showToast(data.error, 'error');

        localStorage.setItem('hostel_jwt_token', data.token);
        localStorage.setItem('hostel_owner_name', data.owner.ownerName);
        localStorage.setItem('hostel_name', data.owner.hostelName);

        showToast(`Welcome back, ${data.owner.ownerName}!`);
        loginForm.reset();
        checkAuth();
    } catch (err) {
        showToast('Connection failed', 'error');
    }
});

// REGISTER
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hostelName = document.getElementById('regHostelName').value;
    const ownerName = document.getElementById('regOwnerName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostelName, ownerName, email, password })
        });
        const data = await res.json();

        if (!res.ok) return showToast(data.error, 'error');

        localStorage.setItem('hostel_jwt_token', data.token);
        localStorage.setItem('hostel_owner_name', data.owner.ownerName);
        localStorage.setItem('hostel_name', data.owner.hostelName);

        showToast(`Hostel Registered Successfully!`);
        registerForm.reset();
        checkAuth();
    } catch (err) {
        showToast('Registration failed', 'error');
    }
});

function logout() {
    localStorage.removeItem('hostel_jwt_token');
    localStorage.removeItem('hostel_owner_name');
    localStorage.removeItem('hostel_name');
    showToast('Logged out');
    checkAuth();
}

// ==========================================
//        SAAS ISOLATED DATA FETCHING
// ==========================================

async function loadData() {
    try {
        const res = await fetch('/api/students', {
            headers: getAuthHeaders()
        });
        
        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        studentsData = await res.json();
        renderGrid(studentsData);
        renderDashboard(); // <-- Triggers our giant math engine!
    } catch (err) {
        showToast('Failed to load records', 'error');
    }
}

// SAVE RESIDENT
recordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        major: document.getElementById('major').value,
        room: document.getElementById('room').value,
        status: document.getElementById('status').value,
        messPlan: document.getElementById('messPlan').value,
        duesAmount: document.getElementById('duesAmount').value,
        address: document.getElementById('address').value
    };

    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) return showToast(data.error, 'error');

        recordForm.reset();
        showToast('Resident saved successfully!');
        loadData();
    } catch (err) {
        showToast('Failed to save', 'error');
    }
});

// TOGGLE DUES
async function toggleDues(id) {
    try {
        const res = await fetch(`/api/students/${id}/dues`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            showToast('Dues status updated');
            loadData();
        }
    } catch (err) {
        showToast('Error updating dues', 'error');
    }
}

// DELETE RESIDENT
async function removeItem(id) {
    if (!confirm('Are you sure you want to checkout this resident?')) return;
    try {
        const res = await fetch(`/api/students/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            showToast('Resident checked out');
            loadData();
        }
    } catch (err) {
        showToast('Error deleting', 'error');
    }
}

// ==========================================
//             UI & NAVIGATION
// ==========================================

function switchView(view) {
    dashboardView.classList.add('hidden');
    addView.classList.add('hidden');
    listView.classList.add('hidden');
    btnShowDashboard.classList.remove('active');
    btnShowAdd.classList.remove('active');
    btnShowList.classList.remove('active');

    if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        btnShowDashboard.classList.add('active');
        renderDashboard();
    } else if (view === 'add') {
        addView.classList.remove('hidden');
        btnShowAdd.classList.add('active');
    } else {
        listView.classList.remove('hidden');
        btnShowList.classList.add('active');
    }
}

btnShowDashboard.addEventListener('click', () => switchView('dashboard'));
btnShowAdd.addEventListener('click', () => switchView('add'));
btnShowList.addEventListener('click', () => switchView('list'));

// THE MASTER DASHBOARD CALCULATOR
function renderDashboard() {
    const total = studentsData.length;
    let allocatedCount = 0;
    let pendingArrivalCount = 0;
    let messCount = 0;
    let humanDebtorsCount = 0;
    let totalMoneyOwed = 0;

    studentsData.forEach(s => {
        // Status checks
        if (s.status === 'Allocated') allocatedCount++;
        if (s.status === 'Pending') pendingArrivalCount++;

        // Mess Plan check
        if (s.messPlan && s.messPlan !== 'No Mess') messCount++;

        // Dues check
        const dues = Number(s.duesAmount) || 0;
        if (s.duesStatus === 'Pending' && dues > 0) {
            humanDebtorsCount++;
            totalMoneyOwed += dues;
        }
    });

    // Populate Top 4 Grid
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAllocated').textContent = allocatedCount;
    document.getElementById('statMessCount').textContent = messCount;
    document.getElementById('statDuesCount').textContent = humanDebtorsCount;

    // Populate Center Big Money Banner
    document.getElementById('statDuesTotal').textContent = `Rs. ${totalMoneyOwed.toLocaleString()}`;

    // Populate Bottom Occupancy List
    document.getElementById('statActiveCount').textContent = allocatedCount;
    document.getElementById('statPendingCount').textContent = pendingArrivalCount;
}

function renderGrid(data) {
    grid.innerHTML = '';
    if (data.length === 0) {
        grid.innerHTML = `<p style="text-align:center; padding: 3rem; color: #64748b;">No residents recorded in your facility yet.</p>`;
        return;
    }
    data.forEach(item => {
        const isPaid = item.duesStatus === 'Paid';
        const el = document.createElement('div');
        el.className = 'record-card';
        el.innerHTML = `
            <div class="record-info">
                <h3>${item.name} (${item.room})</h3>
                <p>📞 ${item.phone} | ✉️ ${item.email}</p>
                <p><strong>Major:</strong> ${item.major} | <strong>Mess Plan:</strong> ${item.messPlan}</p>
                <p><strong>Monthly Dues:</strong> Rs. ${item.duesAmount} - <span style="color:${isPaid ? '#10b981' : '#ef4444'}; font-weight:bold;">${item.duesStatus}</span></p>
            </div>
            <div class="card-actions">
                <button onclick="toggleDues('${item.id}')" class="btn-secondary">${isPaid ? 'Mark Unpaid' : 'Mark Paid'}</button>
                <button onclick="removeItem('${item.id}')" class="btn-delete">Checkout</button>
            </div>
        `;
        grid.appendChild(el);
    });
}

searchInput.addEventListener('input', (e) => {
    switchView('list');
    const term = e.target.value.toLowerCase();
    const filtered = studentsData.filter(s => 
        s.name.toLowerCase().includes(term) || 
        (s.room || '').toLowerCase().includes(term) ||
        (s.major || '').toLowerCase().includes(term)
    );
    renderGrid(filtered);
});

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// INITIALIZE
checkAuth();