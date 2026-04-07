// sync.js - The Bridge between Phone and Render API
const API_BASE_URL = 'https://spentrack-api.onrender.com';

const SyncManager = {
    isSyncing: false,

    performSync: async () => {
        if (SyncManager.isSyncing) return;
        SyncManager.isSyncing = true;
        console.log("Starting sync...");

        try {
            const db = await dbPromise;
            const lastSync = await Database.getState('last_sync_timestamp');
            const token = await Database.getState('access_token');
            if (!token) throw new Error("Not logged in");

            // 1. Gather all offline changes from the local queue
            const queueItems = await db.getAll('sync_queue');

            const payload = {
                last_sync_timestamp: lastSync || null,
                push_data: queueItems // Send our local changes to Render!
            };

            // 2. Talk to the server
            const response = await fetch(`${API_BASE_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Server sync failed: " + response.statusText);
            const data = await response.json();

            // 3. Save pulled data and CLEAR the queue on success
            await SyncManager.saveToLocal(data.payload);
            await Database.setState('last_sync_timestamp', data.server_time);
            
            if (queueItems.length > 0) {
                const tx = db.transaction('sync_queue', 'readwrite');
                for (let item of queueItems) await tx.objectStore('sync_queue').delete(item.QueueID);
                await tx.done;
                console.log(`Pushed and cleared ${queueItems.length} items.`);
            }

        } catch (error) {
            console.error("Sync Error:", error.message);
        } finally {
            SyncManager.isSyncing = false;
        }
    },

    saveToLocal: async (payload) => {
        const db = await dbPromise; 
        if (!db) return;
        const tx = db.transaction(Object.keys(payload), 'readwrite');
        for (const [tableName, rows] of Object.entries(payload)) {
            if (!rows || rows.length === 0) continue;
            const store = tx.objectStore(tableName);
            for (const row of rows) await store.put(row);
        }
        await tx.done;
    }
};
