// db.js - Offline Storage Engine
const dbPromise = window.idb ? idb.openDB('SpenTrackDB', 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
        // App State (Tokens, Sync Timestamps)
        if (!db.objectStoreNames.contains('app_state')) {
            db.createObjectStore('app_state');
        }
        
        // Ledger & Sync Tables mapping perfectly to the FastAPI models
        const tables = [
            { name: 'categories', keyPath: 'CategoryID' },
            { name: 'locations', keyPath: 'LocationID' },
            { name: 'payment_modes', keyPath: 'PaymentModeID' },
            { name: 'tags', keyPath: 'TagID' },
            { name: 'trans_h', keyPath: 'TransHID' },
            { name: 'trans_d', keyPath: 'TransDID' },
            { name: 'shopping_list', keyPath: 'ItemID' },
            { name: 'users', keyPath: 'UserID' } // The new hierarchy table!
        ];

        tables.forEach(table => {
            if (!db.objectStoreNames.contains(table.name)) {
                db.createObjectStore(table.name, { keyPath: table.keyPath });
            }
        });
    }
}) : Promise.resolve(null);

const Database = {
    setState: async (key, value) => {
        const db = await dbPromise;
        if (!db) throw new Error("Database failed to load.");
        return await db.put('app_state', value, key);
    },
    getState: async (key) => {
        const db = await dbPromise;
        if (!db) throw new Error("Database failed to load.");
        return await db.get('app_state', key);
    }
};
