// db.js - Offline Storage Engine
const dbPromise = window.idb ? idb.openDB('SpenTrackDB', 3, {
    upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('app_state')) db.createObjectStore('app_state');
        
        const tables = [
            { name: 'categories', keyPath: 'CategoryID' },
            { name: 'locations', keyPath: 'LocationID' },
            { name: 'payment_modes', keyPath: 'PaymentModeID' },
            { name: 'tags', keyPath: 'TagID' },
            { name: 'trans_h', keyPath: 'TransHID' },
            { name: 'trans_d', keyPath: 'TransDID' },
            { name: 'users', keyPath: 'UserID' },
            { name: 'shopping_list', keyPath: 'ItemID' },
            // THE NEW QUEUE ENGINE
            { name: 'sync_queue', keyPath: 'QueueID' } 
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
        return await db.put('app_state', value, key);
    },
    getState: async (key) => {
        const db = await dbPromise;
        return await db.get('app_state', key);
    }
};
