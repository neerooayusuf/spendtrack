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
            <div class="card shadow-sm p-3 mb-4">
                <h5 class="mb-3">Reference Data</h5>
                <button class="btn btn-outline-primary w-100 mb-2 text-start" onclick="App.navigate('categories')">📁 Manage Categories</button>
                <button class="btn btn-outline-primary w-100 mb-2 text-start" onclick="App.navigate('locations')">📍 Manage Locations</button>
                <button class="btn btn-outline-primary w-100 mb-2 text-start" onclick="App.navigate('payment_modes')">💳 Manage Payment Modes</button>
                <hr>
                <button class="btn btn-outline-secondary w-100" onclick="SyncManager.performSync()">🔄 Force Cloud Sync</button>
            </div>
            <div class="card shadow-sm p-3 mb-4 text-center">
                <button class="btn btn-danger w-100" onclick="Auth.logout()">Log Out</button>
            </div>
        </div>
    `,
    categories: `
        <div class="container mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Categories</h2>
                <button class="btn btn-outline-secondary btn-sm" onclick="App.navigate('settings')">🔙 Back</button>
            </div>
            <div class="card shadow-sm p-3 mb-4">
                <form onsubmit="event.preventDefault(); CategoryManager.add();">
                    <div class="input-group">
                        <input type="text" id="newCategoryName" class="form-control" placeholder="New Category" required autocomplete="off">
                        <button type="submit" id="saveCatBtn" class="btn btn-success">Add</button>
                    </div>
                </form>
            </div>
            <div class="list-group shadow-sm" id="categoryList"><div class="text-center text-muted p-3">Loading...</div></div>
        </div>
    `,
    locations: `
        <div class="container mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Locations</h2>
                <button class="btn btn-outline-secondary btn-sm" onclick="App.navigate('settings')">🔙 Back</button>
            </div>
            <div class="card shadow-sm p-3 mb-4">
                <form onsubmit="event.preventDefault(); LocationManager.add();">
                    <div class="input-group">
                        <input type="text" id="newLocationName" class="form-control" placeholder="e.g. Super U, Triolet" required autocomplete="off">
                        <button type="submit" id="saveLocBtn" class="btn btn-success">Add</button>
                    </div>
                </form>
            </div>
            <div class="list-group shadow-sm" id="locationList"><div class="text-center text-muted p-3">Loading...</div></div>
        </div>
    `,
    payment_modes: `
        <div class="container mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Payment Modes</h2>
                <button class="btn btn-outline-secondary btn-sm" onclick="App.navigate('settings')">🔙 Back</button>
            </div>
            <div class="card shadow-sm p-3 mb-4">
                <form onsubmit="event.preventDefault(); PaymentModeManager.add();">
                    <div class="input-group">
                        <input type="text" id="newPaymentModeName" class="form-control" placeholder="e.g. MCB Juice, Cash" required autocomplete="off">
                        <button type="submit" id="savePayBtn" class="btn btn-success">Add</button>
                    </div>
                </form>
            </div>
            <div class="list-group shadow-sm" id="paymentModeList"><div class="text-center text-muted p-3">Loading...</div></div>
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

// --- DASHBOARD & LEDGER & ADD EXPENSE (Unchanged from previous update) ---
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
        } catch (error) { spentDisplay.innerText = "Error"; }
    }
};

const AddExpense = {
    loadForm: async () => {
        const db = await dbPromise;
        const tx = db.transaction(['categories', 'locations', 'payment_modes', 'trans_d'], 'readonly');
        
        const popSelect = async (storeName, selectId, textKey, valKey) => {
            let items = await tx.objectStore(storeName).getAll();
            items = items.filter(i => i.IsActive).sort((a, b) => a[textKey].localeCompare(b[textKey]));
            const select = document.getElementById(selectId);
            if(!select) return;
            select.innerHTML = '<option value="">Select...</option>';
            items.forEach(i => { select.innerHTML += `<option value="${i[valKey]}">${i[textKey]}</option>`; });
        };

        await popSelect('categories', 'expCategory', 'Name', 'CategoryID');
        await popSelect('locations', 'expLocation', 'Name', 'LocationID');
        await popSelect('payment_modes', 'expPayment', 'Name', 'PaymentModeID');

        const allDetails = await tx.objectStore('trans_d').getAll();
        const uniqueDescs = [...new Set(allDetails.map(d => d.Description))].filter(Boolean);
        const dataList = document.getElementById('historyList');
        if(dataList) {
            dataList.innerHTML = '';
            uniqueDescs.forEach(desc => { dataList.innerHTML += `<option value="${desc}">`; });
        }
    },
    save: async () => {
        const btn = document.getElementById('saveExpenseBtn');
        btn.innerText = "Saving..."; btn.disabled = true;

        try {
            const db = await dbPromise;
            const tx = db.transaction(['trans_h', 'trans_d'], 'readwrite');
            const transHID = generateUUID(), transDID = generateUUID();
            const amount = parseFloat(document.getElementById('expAmount').value);
            const nowISO = new Date().toISOString();

            await tx.objectStore('trans_h').put({
                TransHID: transHID, Date: nowISO, LocationID: document.getElementById('expLocation').value,
                PaymentModeID: document.getElementById('expPayment').value, TotalAmount: amount,
                Status: "Completed", CreatedAt: nowISO, UpdatedAt: nowISO
            });

            await tx.objectStore('trans_d').put({
                TransDID: transDID, TransHID: transHID, CategoryID: document.getElementById('expCategory').value,
                Description: document.getElementById('expDesc').value, Amount: amount,
                CreatedAt: nowISO, UpdatedAt: nowISO
            });

            await tx.done;
            SyncManager.performSync();
            App.navigate('dashboard');
        } catch (error) {
            alert("Failed to save."); btn.innerText = "Save Expense"; btn.disabled = false;
        }
    }
};

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
            
            const locMap = {}; locations.forEach(l => locMap[l.LocationID] = l.Name);
            allHeaders.sort((a, b) => b.Date.localeCompare(a.Date));
            listUI.innerHTML = '';

            if(allHeaders.length === 0) { listUI.innerHTML = `<div class="text-center text-muted p-4">Ledger is empty.</div>`; return; }

            allHeaders.forEach(h => {
                const details = allDetails.filter(d => d.TransHID === h.TransHID);
                const descStr = details.map(d => d.Description).join(', ');
                const locName = locMap[h.LocationID] || 'Unknown';
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
        } catch(err) { listUI.innerHTML = `<div class="text-center text-danger p-4">Error loading ledger.</div>`; }
    }
};

// --- REFERENCE DATA MANAGERS ---
const createManager = (storeName, uiListId, inputId, btnId, keyName) => ({
    load: async () => {
        const listUI = document.getElementById(uiListId);
        if (!listUI) return;
        try {
            const db = await dbPromise;
            let items = await db.getAll(storeName);
            items = items.filter(i => i.IsActive).sort((a, b) => a.Name.localeCompare(b.Name));
            listUI.innerHTML = items.length === 0 ? `<div class="text-center text-muted p-3">No entries yet.</div>` : '';
            items.forEach(i => { listUI.innerHTML += `<div class="list-group-item fw-bold">${i.Name}</div>`; });
        } catch (err) { listUI.innerHTML = `<div class="text-danger p-3">Error loading.</div>`; }
    },
    add: async () => {
        const input = document.getElementById(inputId), btn = document.getElementById(btnId);
        const name = input.value.trim();
        if (!name) return;
        btn.innerText = "..."; btn.disabled = true;
        try {
            const db = await dbPromise;
            const tx = db.transaction(storeName, 'readwrite');
            const nowISO = new Date().toISOString();
            
            const newItem = { Name: name, IsActive: true, CreatedAt: nowISO, UpdatedAt: nowISO };
            newItem[keyName] = generateUUID();

            await tx.objectStore(storeName).put(newItem);
            await tx.done;

            input.value = '';
            await ReferenceManagers[storeName].load();
            SyncManager.performSync();
        } catch (err) { alert("Save failed."); } 
        finally { btn.innerText = "Add"; btn.disabled = false; }
    }
});

const ReferenceManagers = {
    categories: createManager('categories', 'categoryList', 'newCategoryName', 'saveCatBtn', 'CategoryID'),
    locations: createManager('locations', 'locationList', 'newLocationName', 'saveLocBtn', 'LocationID'),
    payment_modes: createManager('payment_modes', 'paymentModeList', 'newPaymentModeName', 'savePayBtn', 'PaymentModeID')
};
const CategoryManager = ReferenceManagers.categories;
const LocationManager = ReferenceManagers.locations;
const PaymentModeManager = ReferenceManagers.payment_modes;

// --- APP ROUTER ---
const App = {
    container: document.getElementById('app-container'),
    navBar: document.getElementById('bottom-nav'),
    navigate: (screenName) => {
        if (!Screens[screenName]) return;
        
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('text-primary', 'fw-bold'));
        const activeLink = document.querySelector(`.nav-link[onclick="App.navigate('${screenName}')"]`);
        if (activeLink && screenName !== 'add_expense') activeLink.classList.add('text-primary', 'fw-bold');

        App.container.innerHTML = Screens[screenName];
        window.scrollTo(0, 0);

        if (screenName === 'dashboard') Dashboard.loadStats();
        if (screenName === 'add_expense') AddExpense.loadForm();
        if (screenName === 'ledger') Ledger.load();
        if (screenName === 'categories') CategoryManager.load();
        if (screenName === 'locations') LocationManager.load();
        if (screenName === 'payment_modes') PaymentModeManager.load();
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
