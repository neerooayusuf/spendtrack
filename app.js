// --- CONFIGURATION ---
const API_URL = 'https://spentrack-api.onrender.com';

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
            <div class="card shadow-sm p-3 mb-4 bg-primary text-white text-center">
                <h6 class="text-uppercase text-white-50">Remaining Budget</h6>
                <h1 id="budgetDisplay" class="display-5 fw-bold">Loading...</h1>
                <small id="spentDisplay">Spent: Rs 0.00</small>
            </div>
            
            <h5 class="mb-3">Recent Activity</h5>
            <ul class="list-group" id="recentActivityList">
                <li class="list-group-item text-center text-muted">Loading transactions...</li>
            </ul>
        </div>
    `,
    settings: `
        <div class="container mt-4">
            <h2 class="mb-4">Settings</h2>
            
            <div class="card shadow-sm p-3 mb-4">
                <h5 class="mb-3">Financial Setup</h5>
                <label class="form-label text-muted">Monthly Budget (Rs)</label>
                <div class="input-group mb-3">
                    <input type="number" id="budgetInput" class="form-control" placeholder="e.g. 20000">
                    <button class="btn btn-outline-primary" onclick="Settings.saveBudget()">Save</button>
                </div>
                <div id="settingsAlert" class="text-success small d-none">Saved successfully!</div>
            </div>

            <div class="card shadow-sm p-3 mb-4">
                <h5 class="mb-3">System</h5>
                <button class="btn btn-outline-secondary w-100 mb-2" onclick="SyncManager.performSync()">Force Sync Now</button>
                <button class="btn btn-danger w-100" onclick="Auth.logout()">Log Out</button>
            </div>
        </div>
    `,
    lists: `<div class="container mt-4"><h2>Shopping Lists</h2><p class="text-muted">Coming soon...</p></div>`,
    add_expense: `<div class="container mt-4"><h2>Add Expense</h2><p class="text-muted">Form coming soon...</p></div>`,
    ledger: `<div class="container mt-4"><h2>Ledger</h2><p class="text-muted">Coming soon...</p></div>`
};

// --- AUTHENTICATION LOGIC ---
const Auth = {
    login: async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');
        const errorBox = document.getElementById('loginError');
        
        if (!email || !password) return;

        btn.innerHTML = '<div class="loader" style="width: 20px; height: 20px; border-width: 3px;"></div>';
        btn.disabled = true;
        errorBox.classList.add('d-none');

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, device_info: 'SpenTrack PWA' })
            });

            if (!response.ok) throw new Error("Invalid credentials");

            const data = await response.json();
            
            await Database.setState('access_token', data.access_token);
            await Database.setState('refresh_token', data.refresh_token);

            await SyncManager.performSync();
            App.init();

        } catch (error) {
            errorBox.innerText = error.message;
            errorBox.classList.remove('d-none');
            btn.innerHTML = 'Login';
            btn.disabled = false;
        }
    },
    logout: async () => {
        // Nuke the database and reload the page
        const db = await dbPromise;
        if(db) db.close();
        await indexedDB.deleteDatabase('SpenTrackDB');
        window.location.reload();
    }
};

// --- SETTINGS LOGIC ---
const Settings = {
    loadBudget: async () => {
        const input = document.getElementById('budgetInput');
        if (!input) return;
        const savedBudget = await Database.getState('monthly_budget');
        if (savedBudget) {
            input.value = savedBudget;
        }
    },
    saveBudget: async () => {
        const input = document.getElementById('budgetInput').value;
        const alertBox = document.getElementById('settingsAlert');
        
        await Database.setState('monthly_budget', parseFloat(input) || 0);
        
        alertBox.classList.remove('d-none');
        setTimeout(() => alertBox.classList.add('d-none'), 2000);
    }
};

// --- DASHBOARD LOGIC ---
const Dashboard = {
    loadStats: async () => {
        const budgetDisplay = document.getElementById('budgetDisplay');
        const spentDisplay = document.getElementById('spentDisplay');
        if (!budgetDisplay) return;

        try {
            const db = await dbPromise;
            if (!db) throw new Error("DB not ready");

            // 1. Get user's custom budget from IndexedDB (Default to 0)
            const savedBudget = await Database.getState('monthly_budget');
            const monthlyBudget = savedBudget ? parseFloat(savedBudget) : 0;

            // 2. Filter this month's data
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const tx = db.transaction(['trans_h', 'trans_d'], 'readonly');
            const allHeaders = await tx.objectStore('trans_h').getAll();
            const allDetails = await tx.objectStore('trans_d').getAll();

            const thisMonthHeaders = allHeaders.filter(h => h.Date >= startOfMonth);
            const thisMonthHeaderIDs = new Set(thisMonthHeaders.map(h => h.TransHID));

            // 3. Calculate dynamic spent total
            let totalSpent = 0;
            for (const item of allDetails) {
                if (thisMonthHeaderIDs.has(item.TransHID)) {
                    totalSpent += parseFloat(item.Amount || 0);
                }
            }

            // 4. Update UI
            const remaining = monthlyBudget - totalSpent;
            
            if (monthlyBudget === 0) {
                budgetDisplay.innerText = "Setup Budget ⚙️";
                budgetDisplay.style.fontSize = "1.5rem";
            } else {
                budgetDisplay.innerText = `Rs ${remaining.toFixed(2)}`;
            }
            
            spentDisplay.innerText = `Spent: Rs ${totalSpent.toFixed(2)}`;

            // 5. Update Recent Activity UI (Mock text until we build the real list renderer)
            const recentList = document.getElementById('recentActivityList');
            if (thisMonthHeaders.length === 0) {
                recentList.innerHTML = `<li class="list-group-item text-center text-muted">No expenses this month!</li>`;
            } else {
                recentList.innerHTML = `<li class="list-group-item text-center text-primary">Found ${thisMonthHeaders.length} receipts. List view coming soon!</li>`;
            }

        } catch (error) {
            console.error("Dashboard calculation failed:", error);
            budgetDisplay.innerText = "Data Error";
        }
    }
};

// --- APP ROUTER ---
const App = {
    container: document.getElementById('app-container'),
    navBar: document.getElementById('bottom-nav'),

    navigate: (screenName) => {
        if (!Screens[screenName]) {
            App.container.innerHTML = `<h2>404 - Screen not found</h2>`;
            return;
        }
        
        App.container.innerHTML = Screens[screenName];

        // Trigger dynamic data loading based on the active screen
        if (screenName === 'dashboard') Dashboard.loadStats();
        if (screenName === 'settings') Settings.loadBudget();
    },

    init: async () => {
        await window.dbPromise; 
        const token = await Database.getState('access_token');
        
        if (token) {
            App.navBar.classList.remove('d-none');
            App.navigate('dashboard');
            
            SyncManager.performSync().then(() => {
                if (App.container.innerHTML.includes('Dashboard')) {
                    Dashboard.loadStats();
                }
            });
        } else {
            App.navBar.classList.add('d-none');
            App.navigate('login');
        }
    }
};

window.addEventListener('DOMContentLoaded', App.init);
