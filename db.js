// db.js - The Local IndexedDB Engine

const DB_NAME = 'SpenTrackDB';
const DB_VERSION = 1;

let dbPromise;

const Database = {
    init: async () => {
        if (!window.indexedDB) {
            console.error("Your browser doesn't support IndexedDB. Offline mode disabled.");
            return;
        }

        // idb.openDB is provided by the CDN library we will add to index.html
        dbPromise = await idb.openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                console.log("Upgrading/Creating Local Database...");

                // 1. MIRRORED BACKEND TABLES (The Ledger & References)
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'CategoryID' });
                }
                if (!db.objectStoreNames.contains('locations')) {
                    db.createObjectStore('locations', { keyPath: 'LocationID' });
                }
                if (!db.objectStoreNames.contains('payment_modes')) {
                    db.createObjectStore('payment_modes', { keyPath: 'PaymentModeID' });
                }
                if (!db.objectStoreNames.contains('tags')) {
                    db.createObjectStore('tags', { keyPath: 'TagID' });
                }
                if (!db.objectStoreNames.contains('trans_h')) {
                    const thStore = db.createObjectStore('trans_h', { keyPath: 'TransHID' });
                    thStore.createIndex('by_date', 'TransactionDate'); // Index for chronological sorting
                }
                if (!db.objectStoreNames.contains('trans_d')) {
                    const tdStore = db.createObjectStore('trans_d', { keyPath: 'TransDID' });
                    tdStore.createIndex('by_header', 'TransHID'); // Index to link items to a specific receipt
                }
                if (!db.objectStoreNames.contains('shopping_list')) {
                    db.createObjectStore('shopping_list', { keyPath: 'ItemID' });
                }

                // 2. LOCAL-ONLY APP STATE TABLES (The UX Engines)
                
                // Stores the active user's UUID, JWT Access Token, and last_sync_timestamp
                if (!db.objectStoreNames.contains('app_state')) {
                    db.createObjectStore('app_state', { keyPath: 'key' });
                }
                
                // Stores the items you are currently putting in your physical cart before checkout
                if (!db.objectStoreNames.contains('active_cart')) {
                    db.createObjectStore('active_cart', { keyPath: 'temp_id', autoIncrement: true });
                }
                
                // Stores a log of offline actions (creates/updates/deletes) waiting to be pushed to FastAPI
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }
            }
        });
        
        console.log("SpenTrack Local Database Initialized!");
    },

    // --- HELPER FUNCTIONS FOR APP STATE ---

    getState: async (key) => {
        const db = await dbPromise;
        const result = await db.get('app_state', key);
        return result ? result.value : null;
    },

    setState: async (key, value) => {
        const db = await dbPromise;
        await db.put('app_state', { key: key, value: value });
    },

    deleteState: async (key) => {
        const db = await dbPromise;
        await db.delete('app_state', key);
    }
};
