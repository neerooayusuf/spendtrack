// --- CONFIGURATION ---
const API_URL = 'https://spentrack-api.onrender.com';

// --- HELPER: Generate Offline IDs ---
const generateUUID = () => {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- HTML TEMPLATES ---
const Screens = {
    login: `
        <div class="container d-flex flex-column justify-content-center align-items-center vh-100">
            <div class="card shadow p-4 w-100" style="max-width: 400px;">
                <h2 class="text-center mb-4">SpenTrack</h2>
                <div id="loginError" class="alert alert-danger d-none" role="alert"></div>
                <input type="email" id="email" class="form-control mb-3" placeholder="Email" required>
                <input type="password" id="password" class="form-control mb-3" placeholder="Password" required>
                <button id="loginBtn" class="btn btn-primary w-100 mb-2" onclick="Auth.login()">Login</button>
            </div>
        </div>
    `,
    dashboard: `
        <div class="container mt-4">
            <h2 class="mb-4">Dashboard</h2>
            <div class="card shadow-sm p-4 mb-4 bg-primary text-white text-center">
                <h6 class="text-uppercase text-white-50">Total Spent This Month</h6>
                <h1 id="spentDisplay" class="display-4 fw-bold">Loading...</h1>
            </div>
            <h5 class="mb-3">Recent Activity</h5>
            <ul class="list-group shadow-sm" id="recentActivityList">
                <li class="list-group-item text-center text-muted">Loading...</li>
            </ul>
        </div>
    `,
    add_expense: `
        <div class="container mt-4">
            <h2 class="mb-4">Add Expense</h2>
            <div class="card shadow-sm p-3">
                <form id="expenseForm" onsubmit="event.preventDefault(); AddExpense.save();">
                    <div class="mb-3">
                        <label class="form-label text-muted small mb-1">What did you buy?</label>
                        <input type="text" id="expDesc" list="historyList" class="form-control form-control-lg" placeholder="e.g. Bread" required autocomplete="off">
                        <datalist id="historyList"></datalist>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label text-muted small mb-1">Amount (Rs)</label>
                        <input type="number" step="0.01" id="expAmount" class="form-control form-control-lg fw-bold" placeholder="0.00" required>
                    </div>

                    <div class="row">
                        <div class="col-6 mb-3">
                            <label class="form-label text-muted small mb-1">Category</label>
                            <select id="expCategory" class="form-select" required><option value="">Select...</option></select>
                        </div>
                        <div class="col-6 mb-3">
                            <label class="form-label text-muted small mb-1">Location</label>
                            <select id="expLocation" class="form-select" required><option value="">Select...</option></select>
                        </div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted small mb-1">Payment Mode</label>
                        <select id="expPayment" class="form-select" required><option value="">Select...</option></select>
                    </div>

                    <button type="submit" id="saveExpenseBtn" class="btn btn-primary w-100 btn-lg shadow-sm">Save Expense</button>
                </form>
            </div>
        </div>
    `,
    ledger: `
        <div class="container mt-4">
            <h2 class="mb-4">Ledger</h2>
            <div id="ledgerList" class="list-group shadow-sm">
                <div class="text-center text-muted p-4">Loading transactions...</div>
            </div>
        </div>
    `,
    lists: `
        <div class="container mt-4">
            <h2 class="mb-4">Shopping List</h2>
            <p class="text-muted text-center mt-5">Intent-to-spend module coming soon.</p>
        </div>
    `,
    settings: `
        <div class="container mt-4">
            <h2 class="mb-4">Settings</h2>
            <div class="card shadow-sm p-3 mb-4 text-center">
                <button class="btn btn-outline-primary w-100 mb-3" onclick="SyncManager.performSync()">Force Cloud Sync</button>
                <button class="btn btn-danger w-100" onclick="Auth.logout()">Log Out</button>
            </div>
        </div>
    `
};

// --- AUTHENTICATION ---
const Auth = {
    login: async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');
        const errorBox = document.getElementById('loginError');
        if (!email || !password) return;

        btn.innerHTML = 'Loading...'; btn.disabled = true; errorBox.classList.add('d-none');

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, device_info: 'SpenTrack PWA' })
            });
            if (!response.ok) throw new Error("Invalid credentials");
            const data = await response.json();
            
            await Database.setState('access_token', data.access_token);
            await Database.setState('refresh_token', data.refresh_token);
            await SyncManager.performSync();
            App.init();
        } catch (error) {
            errorBox.innerText = error.message; errorBox.classList.remove('d-none');
            btn.innerHTML = 'Login'; btn.disabled = false;
        }
    },
    logout: async () => {
        const db = await dbPromise; if(db) db.close();
        await indexedDB.deleteDatabase('SpenTrackDB');
        window.location.reload();
    }
};

// --- DASHBOARD ---
const Dashboard = {
    loadStats: async () => {
        const spentDisplay = document.getElementById('spentDisplay');
        const recentList = document.getElementById('recentActivityList');
        if (!spentDisplay) return;

        try {
            const db = await dbPromise;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const tx = db.transaction(['trans_h', 'trans_d', 'categories'], 'readonly');
            const allHeaders = await tx.objectStore('trans_h').getAll();
            const allDetails = await tx.objectStore('trans_d').getAll();
            const categories = await tx.objectStore('categories').getAll();
            
            // Map categories for quick lookup
            const catMap = {};
            categories.forEach(c => catMap[c.CategoryID] = c.Name);

            const thisMonthHeaders = allHeaders.filter(h => h.Date >= startOfMonth).sort((a, b) => b.Date.localeCompare(a.Date));
            const thisMonthHeaderIDs = new Set(thisMonthHeaders.map(h => h.TransHID));

            let totalSpent = 0;
            const detailsByHeader = {};
            
            allDetails.forEach(item => {
                if (thisMonthHeaderIDs.has(item.TransHID)) {
                    totalSpent += parseFloat(item.Amount || 0);
                    if(!detailsByHeader[item.TransHID]) detailsByHeader[item.TransHID] = [];
                    detailsByHeader[item.TransHID].push(item);
                }
            });

            spentDisplay.innerText = `Rs ${totalSpent.toFixed(2)}`;

            // Render top 5 recent transactions
            recentList.innerHTML = '';
            const top5 = thisMonthHeaders.slice(0, 5);
            if(top5.length === 0) {
                recentList.innerHTML = `<li class="list-group-item text-center text-muted">No expenses yet. Add one!</li>`;
                return;
            }

            top5.forEach(h => {
                const details = detailsByHeader[h.TransHID] || [];
                const mainDesc = details.length > 0 ? details[0].Description : 'Unknown';
                const mainCat = details.length > 0 ? catMap[details[0].CategoryID] : 'Misc';
                
                recentList.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold d-block">${mainDesc}</span>
                            <small class="text-muted">${mainCat}</small>
                        </div>
                        <span class="badge bg-danger rounded-pill fs-6">Rs ${parseFloat(h.TotalAmount).toFixed(2)}</span>
                    </li>
                `;
            });
        } catch (error) {
            console.error(error);
            spentDisplay.innerText = "Error";
        }
    }
};

// --- ADD EXPENSE (The Core Engine) ---
const AddExpense = {
    loadForm: async () => {
        const db = await dbPromise;
        const tx = db.transaction(['categories', 'locations', 'payment_modes', 'trans_d'], 'readonly');
        
        // Populate Dropdowns
        const popSelect = async (storeName, selectId, textKey, valKey) => {
            const items = await tx.objectStore(storeName).getAll();
            const select = document.getElementById(selectId);
            if(!select) return;
            items.forEach(i => {
                if(i.IsActive) select.innerHTML += `<option value="${i[valKey]}">${i[textKey]}</option>`;
            });
        };

        await popSelect('categories', 'expCategory', 'Name', 'CategoryID');
        await popSelect('locations', 'expLocation', 'Name', 'LocationID');
        await popSelect('payment_modes', 'expPayment', 'Name', 'PaymentModeID');

        // Path A: The "Smart History" Autocomplete
        const allDetails = await tx.objectStore('trans_d').getAll();
        const uniqueDescs = [...new Set(allDetails.map(d => d.Description))].filter(Boolean);
        const dataList = document.getElementById('historyList');
        if(dataList) {
            uniqueDescs.forEach(desc => {
                dataList.innerHTML += `<option value="${desc}">`;
            });
        }
    },

    save: async () => {
        const btn = document.getElementById('saveExpenseBtn');
        btn.innerText = "Saving..."; btn.disabled = true;

        try {
            const db = await dbPromise;
            const tx = db.transaction(['trans_h', 'trans_d'], 'readwrite');
            
            const transHID = generateUUID();
            const transDID = generateUUID();
            const amount = parseFloat(document.getElementById('expAmount').value);
            const nowISO = new Date().toISOString();

            // 1. Create the Header (The Receipt)
            const header = {
                TransHID: transHID,
                Date: nowISO,
                LocationID: document.getElementById('expLocation').value,
                PaymentModeID: document.getElementById('expPayment').value,
                TotalAmount: amount,
                Status: "Completed",
                CreatedAt: nowISO,
                UpdatedAt: nowISO
            };

            // 2. Create the Detail (The Item)
            const detail = {
                TransDID: transDID,
                TransHID: transHID,
                CategoryID: document.getElementById('expCategory').value,
                Description: document.getElementById('expDesc').value,
                Amount: amount,
                CreatedAt: nowISO,
                UpdatedAt: nowISO
            };

            await tx.objectStore('trans_h').put(header);
            await tx.objectStore('trans_d').put(detail);
            await tx.done;

            // Trigger background sync to send to Render
            SyncManager.performSync();
            
            // Go back to home
            App.navigate('dashboard');

        } catch (error) {
            console.error(error);
            alert("Failed to save. Check inputs.");
            btn.innerText = "Save Expense"; btn.disabled = false;
        }
    }
};

// --- LEDGER ---
const Ledger = {
    load: async () => {
        const listUI = document.getElementById('ledgerList');
        if(!listUI) return;

        try {
            const db = await dbPromise;
            const tx = db.transaction(['trans_h', 'trans_d', 'locations'], 'readonly');
            
            const allHeaders = await tx.objectStore('trans_h').getAll();
            const allDetails = await tx.objectStore('trans_d').getAll();
            const locations = await tx.objectStore('locations').getAll();
            
            const locMap = {};
            locations.forEach(l => locMap[l.LocationID] = l.Name);

            // Sort newest first
            allHeaders.sort((a, b) => b.Date.localeCompare(a.Date));
            listUI.innerHTML = '';

            if(allHeaders.length === 0) {
                listUI.innerHTML = `<div class="text-center text-muted p-4">Ledger is empty.</div>`;
                return;
            }

            allHeaders.forEach(h => {
                const details = allDetails.filter(d => d.TransHID === h.TransHID);
                const descStr = details.map(d => d.Description).join(', ');
                const locName = locMap[h.LocationID] || 'Unknown Location';
                const dateStr = new Date(h.Date).toLocaleDateString();

                listUI.innerHTML += `
                    <div class="list-group-item flex-column align-items-start">
                        <div class="d-flex w-100 justify-content-between mb-1">
                            <h6 class="mb-0 fw-bold">${descStr}</h6>
                            <span class="text-danger fw-bold">Rs ${parseFloat(h.TotalAmount).toFixed(2)}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">📍 ${locName}</small>
                            <small class="text-muted">${dateStr}</small>
                        </div>
                    </div>
                `;
            });

        } catch(err) {
            listUI.innerHTML = `<div class="text-center text-danger p-4">Error loading ledger.</div>`;
        }
    }
};

// --- APP ROUTER ---
const App = {
    container: document.getElementById('app-container'),
    navBar: document.getElementById('bottom-nav'),
    navigate: (screenName) => {
        if (!Screens[screenName]) return;
        
        // Update Active Tab Styling
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('text-primary', 'fw-bold'));
        const activeLink = document.querySelector(`.nav-link[onclick="App.navigate('${screenName}')"]`);
        if (activeLink && screenName !== 'add_expense') activeLink.classList.add('text-primary', 'fw-bold');

        App.container.innerHTML = Screens[screenName];
        window.scrollTo(0, 0);

        if (screenName === 'dashboard') Dashboard.loadStats();
        if (screenName === 'add_expense') AddExpense.loadForm();
        if (screenName === 'ledger') Ledger.load();
    },
    init: async () => {
        await window.dbPromise; 
        const token = await Database.getState('access_token');
        if (token) {
            App.navBar.classList.remove('d-none');
            App.navigate('dashboard');
            SyncManager.performSync().then(() => {
                if (App.container.innerHTML.includes('Dashboard')) Dashboard.loadStats();
            });
        } else {
            App.navBar.classList.add('d-none');
            App.navigate('login');
        }
    }
};

window.addEventListener('DOMContentLoaded', App.init);
