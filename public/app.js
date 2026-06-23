const form = document.getElementById('recordForm');
const grid = document.getElementById('dataGrid');
const searchInput = document.getElementById('searchInput');
const toastContainer = document.getElementById('toastContainer');

// View Elements
const btnShowDashboard = document.getElementById('btnShowDashboard');
const btnShowAdd = document.getElementById('btnShowAdd');
const btnShowList = document.getElementById('btnShowList');
const dashboardView = document.getElementById('dashboardView');
const addView = document.getElementById('addView');
const listView = document.getElementById('listView');

let studentsData = [];

// --- View Navigation Logic ---
// just hiding/showing the 3 main sections + toggling the active nav button
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
        renderDashboard(); // refresh numbers every time we open it
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

// --- Dashboard ---
// counts everything up from the data we already have, no need to hit the server again
function renderDashboard() {
    const total = studentsData.length;
    let allocated = 0, pending = 0, vacating = 0;
    let messCount = 0;
    let duesPendingCount = 0, duesPendingTotal = 0;

    studentsData.forEach(s => {
        if (s.status === 'Allocated') allocated++;
        if (s.status === 'Pending') pending++;
        if (s.status === 'Vacating') vacating++;

        if (s.messPlan && s.messPlan !== 'No Mess') messCount++;

        if (s.duesStatus === 'Pending') {
            duesPendingCount++;
            duesPendingTotal += Number(s.duesAmount) || 0;
        }
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAllocated').textContent = allocated;
    document.getElementById('statMess').textContent = messCount;
    document.getElementById('statDuesCount').textContent = duesPendingCount;
    document.getElementById('statDuesTotal').textContent = `Rs. ${duesPendingTotal.toLocaleString()}`;

    document.getElementById('bdAllocated').textContent = allocated;
    document.getElementById('bdPending').textContent = pending;
    document.getElementById('bdVacating').textContent = vacating;
}

// --- Render & Load Data ---
function renderGrid(data) {
    grid.innerHTML = '';
    if (data.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="icon">🛏️</span>
                <h3>No records found</h3>
            </div>
        `;
        return;
    }
    
    data.forEach(item => {
        // some old records might not have a status, just show "Unknown" instead of crashing
        const status = item.status || 'Unknown';
        let badgeColor = status.includes('Allocated') ? '#dcfce7' : '#fef08a';
        let textColor = status.includes('Allocated') ? '#166534' : '#854d0e';

        // dues badge - green if paid, red if still pending
        const isPaid = item.duesStatus === 'Paid';
        const duesColor = isPaid ? '#dcfce7' : '#fee2e2';
        const duesText = isPaid ? '#166534' : '#991b1b';

        const el = document.createElement('div');
        el.className = 'record-card';
        // We now display Major and Status as badges side-by-side, and include the address!
        el.innerHTML = `
            <div class="record-info">
                <h3>${item.name} 
                    <span class="badge">${item.major}</span>
                    <span class="badge" style="background:${badgeColor}; color:${textColor};">${status}</span>
                </h3>
                <p><strong>Room: ${item.room || 'Not Assigned'}</strong></p>
                <p>✉️ ${item.email} &nbsp;|&nbsp; 📞 ${item.phone}</p>
                <p>📍 ${item.address}</p>
                <p>🍽️ ${item.messPlan || 'No Mess'} &nbsp;|&nbsp;
                   <span class="badge" style="background:${duesColor}; color:${duesText};">
                        Dues: Rs. ${item.duesAmount || 0} - ${item.duesStatus || 'Pending'}
                   </span>
                </p>
            </div>
            <div class="card-actions">
                <button onclick="toggleDues(${item.id})" class="btn-secondary">
                    ${isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
                <button onclick="removeItem(${item.id})" class="btn-delete">Checkout / Delete</button>
            </div>
        `;
        grid.appendChild(el);
    });
}

async function loadData() {
    try {
        const res = await fetch('/api/students');
        studentsData = await res.json();
        renderGrid(studentsData);
        renderDashboard();
    } catch (err) {
        showToast('Failed to load data', 'error');
    }
}

// --- Interactions ---
searchInput.addEventListener('input', (e) => {
    switchView('list');
    const term = e.target.value.toLowerCase();
    
    // Now searches by Name, Room, OR Major
    const filtered = studentsData.filter(student => 
        student.name.toLowerCase().includes(term) || 
        (student.room || '').toLowerCase().includes(term) ||
        student.major.toLowerCase().includes(term)
    );
    renderGrid(filtered);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Grabbing ALL the fields from the form, including the new mess + dues ones
    const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        major: document.getElementById('major').value,
        address: document.getElementById('address').value,
        room: document.getElementById('room').value,
        status: document.getElementById('status').value,
        messPlan: document.getElementById('messPlan').value,
        duesAmount: document.getElementById('duesAmount').value
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
        showToast('✅ Record Saved Successfully');
        loadData();
    } catch (err) {
        showToast('Server connection failed', 'error');
    }
});

// flips a student's dues between Paid <-> Pending
async function toggleDues(id) {
    try {
        const res = await fetch(`/api/students/${id}/dues`, { method: 'PATCH' });
        if (res.ok) {
            showToast('💰 Dues status updated');
            loadData();
        }
    } catch (err) {
        showToast('Failed to update dues', 'error');
    }
}

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
loadData();git