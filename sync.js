// sync.js - The Bridge between Phone and Render API
const API_BASE_URL = 'https://spentrack-api.onrender.com';

const SyncManager = {
    isSyncing: false,

    performSync: async () => {
        // Prevent overlapping syncs
        if (SyncManager.isSyncing) return;
        SyncManager.isSyncing = true;
        console.log("Starting sync...");

        try {
            const lastSync = await Database.getState('last_sync_timestamp');
            const token = await Database.getState('access_token');
            
            if (!token) throw new Error("Not logged in - skipping sync");

            // If lastSync is null, it triggers a Cold Sync (downloads everything)
            const payload = {
                last_sync_timestamp: lastSync || null
            };

            const response = await fetch(`${API_BASE_URL}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Server sync failed: " + response.statusText);

            const data = await response.json();

            // Save incoming server data to local IndexedDB
            await SyncManager.saveToLocal(data.payload);

            // Update the local sync clock so next time it only fetches delta changes
            await Database.setState('last_sync_timestamp', data.server_time);
            
            console.log("Sync Complete! Server time:", data.server_time);

        } catch (error) {
            console.error("Sync Error:", error.message);
        } finally {
            SyncManager.isSyncing = false;
        }
    },

    saveToLocal: async (payload) => {
        const db = await dbPromise; 
        if (!db) return;

        // Open a massive transaction across all tables
        const tx = db.transaction(Object.keys(payload), 'readwrite');
        
        for (const [tableName, rows] of Object.entries(payload)) {
            if (!rows || rows.length === 0) continue;
            
            const store = tx.objectStore(tableName);
            for (const row of rows) {
                await store.put(row);
            }
        }
        await tx.done; // Wait for everything to save safely
    }
};
