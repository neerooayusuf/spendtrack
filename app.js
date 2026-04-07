const API_URL = 'https://spentrack-api.onrender.com';

const generateUUID = () => {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const queueLocalChange = async (tx, tableName, operation, payload) => {
    await tx.objectStore('sync_queue').put({ QueueID: generateUUID(), tableName, operation, payload });
};

const Screens = {
    login: `... (unchanged) ... <div class="container d-flex flex-column justify-content-center align-items-center vh-100"><div class="card shadow p-4 w-100" style="max-width: 400px;"><h2 class="text-center mb-4">SpenTrack</h2><input type="email" id="email" class="form-control mb-3" placeholder="Email"><input type="password" id="password" class="form-control mb-3" placeholder="Password"><button class="btn btn-primary w-100" onclick="Auth.login()">Login</button><div id="loginError" class="alert alert-danger d-none mt-3"></div></div></div>`,
    dashboard: `<div class="container mt-4"><h2 class="mb-4">Dashboard</h2><div class="card shadow-sm p-4 mb-4 bg-primary text-white text-center"><h6 class="text-uppercase text-white-50">Spent This Month</h6><h1 id="spentDisplay" class="display-4 fw-bold">...</h1></div><h5 class="mb-3">Recent Receipts</h5><ul class="list-group shadow-sm" id="recentActivityList"></ul></div>`,
    add_expense: `
        <div class="container mt-4 mb-5 pb-5">
            <h2 class="mb-3">New Receipt</h2>
            
            <div class="card shadow-sm p-3 mb-3">
                <h6 class="text-muted mb-3 border-bottom pb-2">1. Receipt Details</h6>
                <div class="mb-2"><input type="date" id="expDate" class="form-control fw-bold text-primary"></div>
                <div class="row"><div class="col-6"><select id="expLocation" class="form-select"></select></div><div class="col-6"><select id="expPayment" class="form-select"></select></div></div>
            </div>

            <div class="card shadow-sm p-3 mb-3 border-primary border-2">
                <h6 class="text-primary mb-3 border-bottom pb-2">2. Add Items</h6>
                <input type="text" id="expDesc" list="historyList" class="form-control mb-2" placeholder="What did you buy?">
                <datalist id="historyList"></datalist>
                <div class="row mb-2"><div class="col-6"><input type="number" step="0.01" id="expAmount" class="form-control" placeholder="Rs 0.00"></div><div class="col-6"><select id="expCategory" class="form-select"></select></div></div>
                <button class="btn btn-outline-primary w-100" onclick="AddExpense.stageItem()">+ Add to Receipt</button>
            </div>

            <ul class="list-group mb-3 shadow-sm" id="stagedItemsList"></ul>
            <button id="saveReceiptBtn" class="btn btn-success w-100 btn-lg shadow-sm" onclick="AddExpense.saveReceipt()">Save Complete Receipt</button>
        </div>
    `,
    lists: `
        <div class="container mt-4">
            <h2 class="mb-4">Shopping List</h2>
            <div class="input-group shadow-sm mb-4">
                <input type="text" id="newShoppingItem" class="form-control" placeholder="Need to buy...">
                <button class="btn btn-primary" onclick="ShoppingList.add()">Add</button>
            </div>
            <ul class="list-group shadow-sm mb-3" id="shoppingListItems"></ul>
            <button class="btn btn-outline-danger w-100" onclick="ShoppingList.clearCompleted()">Clear Checked Items</button>
        </div>
    `,
    ledger: `<div class="container mt-4"><h2 class="mb-4">Ledger</h2><div id="ledgerList" class="list-group shadow-sm"></div></div>`,
    settings: `
        <div class="container mt-4">
            <h2 class="mb-4">Settings</h2>
            <div id="masterControls" class="card shadow-sm p-3 mb-4 border-warning d-none">
                <h6 class="text-warning mb-3">👑 Root Master Controls</h6>
                <button class="btn btn-outline-warning w-100" onclick="App.navigate('explorer')">View Raw Data Explorer</button>
            </div>
            <div class="card shadow-sm p-3 mb-4"><h5 class="mb-3">System</h5><button class="btn btn-outline-secondary w-100 mb-2" onclick="SyncManager.performSync()">🔄 Force Cloud Sync</button><button class="btn btn-danger w-100" onclick="Auth.logout()">Log Out</button></div>
        </div>
    `,
    explorer: `<div class="container mt-4"><h2>Raw Data Explorer</h2><button class="btn btn-sm btn-secondary mb-3" onclick="App.navigate('settings')">Back</button><pre id="explorerData" class="bg-dark text-success p-3 rounded overflow-auto" style="font-size: 0.75rem; max-height: 70vh;"></pre></div>`
};

// --- AUTH ---
const Auth = {
    login: async () => { /* ... Same logic ... */ 
        const e = document.getElementById('email').value, p = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:e, password:p}) });
            if(!res.ok) throw new Error("Invalid Auth");
            const data = await res.json();
            await Database.setState('access_token', data.access_token);
            await SyncManager.performSync();
            App.init();
        } catch(err) { alert(err.message); }
    },
    logout: async () => { await indexedDB.deleteDatabase('SpenTrackDB'); window.location.reload(); }
};

// --- ADD EXPENSE (Multi-Item Engine) ---
const AddExpense = {
    stagedItems: [],
    
    loadForm: async () => {
        AddExpense.stagedItems = [];
        document.getElementById('stagedItemsList').innerHTML = '';
        
        // Auto-set Date to Today for Backdating feature
        document.getElementById('expDate').value = new Date().toISOString().split('T')[0];

        const db = await dbPromise;
        const tx = db.transaction(['categories', 'locations', 'payment_modes', 'trans_d'], 'readonly');
        
        const pop = async (store, id, txt, val) => {
            const items = (await tx.objectStore(store).getAll()).filter(i=>i.IsActive);
            document.getElementById(id).innerHTML = items.map(i=>`<option value="${i[val]}">${i[txt]}</option>`).join('');
        };
        await pop('categories', 'expCategory', 'Name', 'CategoryID');
        await pop('locations', 'expLocation', 'Name', 'LocationID');
        await pop('payment_modes', 'expPayment', 'Name', 'PaymentModeID');
    },

    stageItem: () => {
        const desc = document.getElementById('expDesc').value;
        const amt = parseFloat(document.getElementById('expAmount').value);
        const catSelect = document.getElementById('expCategory');
        const catID = catSelect.value;
        const catName = catSelect.options[catSelect.selectedIndex].text;

        if (!desc || isNaN(amt) || !catID) return alert("Fill out item details!");

        AddExpense.stagedItems.push({ desc, amt, catID, catName });
        
        // Reset Item Form
        document.getElementById('expDesc').value = '';
        document.getElementById('expAmount').value = '';
        
        AddExpense.renderStaged();
    },

    renderStaged: () => {
        const list = document.getElementById('stagedItemsList');
        list.innerHTML = AddExpense.stagedItems.map((item, i) => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div><span class="fw-bold d-block">${item.desc}</span><small class="text-muted">${item.catName}</small></div>
                <span class="badge bg-secondary rounded-pill">Rs ${item.amt.toFixed(2)}</span>
            </li>
        `).join('');
    },

    saveReceipt: async () => {
        if (AddExpense.stagedItems.length === 0) return alert("Add at least one item!");
        
        const btn = document.getElementById('saveReceiptBtn');
        btn.innerText = "Saving..."; btn.disabled = true;

        try {
            const db = await dbPromise;
            const tx = db.transaction(['trans_h', 'trans_d', 'sync_queue'], 'readwrite');
            
            // Generate the one Master Receipt (Using the custom Backdated Date)
            const transHID = generateUUID();
            const selectedDate = new Date(document.getElementById('expDate').value).toISOString();
            const totalAmt = AddExpense.stagedItems.reduce((sum, item) => sum + item.amt, 0);

            const header = {
                TransHID: transHID, Date: selectedDate, 
                LocationID: document.getElementById('expLocation').value, PaymentModeID: document.getElementById('expPayment').value,
                TotalAmount: totalAmt, Status: "Completed", CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString()
            };
            
            await tx.objectStore('trans_h').put(header);
            await queueLocalChange(tx, 'trans_h', 'INSERT', header);

            // Loop and attach all Line Items to the Receipt
            for (let item of AddExpense.stagedItems) {
                const detail = {
                    TransDID: generateUUID(), TransHID: transHID, CategoryID: item.catID,
                    Description: item.desc, Amount: item.amt, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString()
                };
                await tx.objectStore('trans_d').put(detail);
                await queueLocalChange(tx, 'trans_d', 'INSERT', detail);
            }

            await tx.done;
            SyncManager.performSync();
            App.navigate('dashboard');
        } catch (error) { alert("Save failed."); }
    }
};

// --- SHOPPING LIST ---
const ShoppingList = {
    load: async () => {
        const db = await dbPromise;
        const items = await db.getAll('shopping_list');
        const list = document.getElementById('shoppingListItems');
        if(!list) return;
        
        list.innerHTML = items.length === 0 ? '<li class="list-group-item text-center text-muted">Cart is empty</li>' : '';
        items.forEach(i => {
            const checked = i.IsChecked ? 'checked' : '';
            const strike = i.IsChecked ? 'text-decoration-line-through text-muted' : 'fw-bold';
            list.innerHTML += `
                <li class="list-group-item d-flex align-items-center">
                    <input class="form-check-input me-3" type="checkbox" ${checked} onchange="ShoppingList.toggle('${i.ItemID}', this.checked)">
                    <span class="${strike}">${i.Name}</span>
                </li>
            `;
        });
    },
    add: async () => {
        const input = document.getElementById('newShoppingItem');
        const name = input.value.trim();
        if(!name) return;
        
        const db = await dbPromise;
        const tx = db.transaction(['shopping_list', 'sync_queue'], 'readwrite');
        const item = { ItemID: generateUUID(), Name: name, IsChecked: false, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString() };
        
        await tx.objectStore('shopping_list').put(item);
        await queueLocalChange(tx, 'shopping_list', 'INSERT', item);
        await tx.done;
        
        input.value = '';
        ShoppingList.load();
        SyncManager.performSync();
    },
    toggle: async (id, isChecked) => {
        const db = await dbPromise;
        const tx = db.transaction(['shopping_list', 'sync_queue'], 'readwrite');
        const item = await tx.objectStore('shopping_list').get(id);
        item.IsChecked = isChecked;
        item.UpdatedAt = new Date().toISOString();
        
        await tx.objectStore('shopping_list').put(item);
        await queueLocalChange(tx, 'shopping_list', 'UPDATE', item);
        await tx.done;
        ShoppingList.load();
    },
    clearCompleted: async () => {
        const db = await dbPromise;
        const tx = db.transaction(['shopping_list', 'sync_queue'], 'readwrite');
        const items = await tx.objectStore('shopping_list').getAll();
        
        for(let i of items) {
            if(i.IsChecked) {
                await tx.objectStore('shopping_list').delete(i.ItemID);
                await queueLocalChange(tx, 'shopping_list', 'DELETE', { ItemID: i.ItemID });
            }
        }
        await tx.done;
        ShoppingList.load();
        SyncManager.performSync();
    }
};

// --- DATA EXPLORER & SETTINGS ---
const SettingsScreen = {
    load: async () => {
        const db = await dbPromise;
        const users = await db.getAll('users');
        // Check if any loaded user is a Root Master
        if (users.some(u => u.InvitedBy === null)) {
            document.getElementById('masterControls').classList.remove('d-none');
        }
    }
};

const DataExplorer = {
    load: async () => {
        const db = await dbPromise;
        const data = {};
        const tables = ['users', 'sync_queue', 'trans_h', 'trans_d', 'shopping_list'];
        for(let t of tables) data[t] = await db.getAll(t);
        
        document.getElementById('explorerData').innerText = JSON.stringify(data, null, 2);
    }
};

// --- ROUTER (Simplified for brevity, assuming standard layout from before) ---
const App = {
    container: document.getElementById('app-container'),
    navBar: document.getElementById('bottom-nav'),
    navigate: (screenName) => {
        if (!Screens[screenName]) return;
        App.container.innerHTML = Screens[screenName];
        if (screenName === 'add_expense') AddExpense.loadForm();
        if (screenName === 'lists') ShoppingList.load();
        if (screenName === 'settings') SettingsScreen.load();
        if (screenName === 'explorer') DataExplorer.load();
        // Assume Ledger and Dashboard logic from previous updates are here
    },
    init: async () => {
        await window.dbPromise; 
        const token = await Database.getState('access_token');
        if (token) {
            App.navBar.classList.remove('d-none');
            App.navigate('dashboard');
            SyncManager.performSync();
        } else {
            App.navigate('login');
        }
    }
};
window.addEventListener('DOMContentLoaded', App.init);
