// --- CONFIGURATION ---
const API_URL = 'https://spentrack-api.onrender.com'; // Change to your Render URL

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
                <button class="btn btn-outline-secondary w-100" onclick="App.navigate('register')">Create Account</button>
            </div>
        </div>
    `,
    register: `
        <div class="container d-flex flex-column justify-content-center align-items-center vh-100">
            <div class="card shadow p-4 w-100" style="max-width: 400px;">
                <h2 class="text-center mb-4">Join SpenTrack</h2>
                
                <input type="text" id="regName" class="form-control mb-3" placeholder="Full Name" required>
                <input type="email" id="regEmail" class="form-control mb-3" placeholder="Email" required>
                <input type="password" id="regPassword" class="form-control mb-3" placeholder="Password" required>
                <input type="text" id="regInvite" class="form-control mb-3" placeholder="Invite Code (Required)" required>
                
                <button class="btn btn-success w-100 mb-2" onclick="Auth.register()">Register</button>
                <button class="btn btn-link w-100" onclick="App.navigate('login')">Back to Login</button>
            </div>
        </div>
    `,
    dashboard: `
        <div class="container mt-4">
            <h1 class="mb-4">Dashboard</h1>
            <div class="card shadow-sm p-3 mb-4 bg-primary text-white text-center">
                <h5>Remaining Budget</h5>
                <h2 id="budgetDisplay">Loading...</h2>
            </div>
            <p>Welcome to the offline-first reality.</p>
        </div>
    `
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
            
            // Save tokens to IndexedDB
            await Database.setState('access_token', data.access_token);
            await Database.setState('refresh_token', data.refresh_token);

            // Trigger the massive initial sync!
            await SyncManager.performSync();

            // Go to dashboard
            App.init();

        } catch (error) {
            errorBox.innerText = error.message;
            errorBox.classList.remove('d-none');
            btn.innerHTML = 'Login';
            btn.disabled = false;
        }
    }
    // Register function can be added here later
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
    },

    init: async () => {
        // Wait for IndexedDB to be ready
        await window.dbPromise; 
        
        const token = await Database.getState('access_token');
        
        if (token) {
            // Logged in! Show the nav bar and go to dashboard
            App.navBar.classList.remove('d-none');
            App.navigate('dashboard');
            // Try a background sync just in case
            SyncManager.performSync();
        } else {
            // Not logged in. Hide nav bar and show login
            App.navBar.classList.add('d-none');
            App.navigate('login');
        }
    }
};

// Boot up the app when the page loads
window.addEventListener('DOMContentLoaded', App.init);
