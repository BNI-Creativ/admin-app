// Sync Service - Handles synchronization between local SQLite and remote server
import dbService from './DatabaseService';

const API_URL = process.env.REACT_APP_BACKEND_URL 
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : null;

class SyncService {
  isOnline = navigator.onLine;
  syncInProgress = false;
  listeners = [];
  autoSyncInterval = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnlineStatusChange(true));
    window.addEventListener('offline', () => this.handleOnlineStatusChange(false));
  }

  // Subscribe to sync status updates
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(listener => listener(status));
  }

  handleOnlineStatusChange(online) {
    this.isOnline = online;
    this.notifyListeners({ type: 'connection', online });
    
    if (online && API_URL) {
      // Auto-sync when coming back online
      this.sync();
    }
  }

  // Start automatic sync (every 5 minutes when online)
  startAutoSync(intervalMs = 300000) {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    this.autoSyncInterval = setInterval(() => {
      if (this.isOnline && API_URL && !this.syncInProgress) {
        this.sync();
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  // Check if we can sync (online and have API URL)
  canSync() {
    return this.isOnline && API_URL;
  }

  // Main sync function
  async sync() {
    if (!this.canSync()) {
      console.log('Cannot sync: offline or no API URL configured');
      return { success: false, reason: 'offline' };
    }

    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { success: false, reason: 'in_progress' };
    }

    this.syncInProgress = true;
    this.notifyListeners({ type: 'sync_start' });

    try {
      // Step 1: Get unsynced local data
      const unsyncedData = await dbService.getUnsyncedData();
      console.log('Unsynced data:', unsyncedData);

      // Step 2: Push local changes to server (local priority)
      if (this.hasUnsyncedData(unsyncedData)) {
        await this.pushToServer(unsyncedData);
      }

      // Step 3: Pull new data from server
      await this.pullFromServer();

      // Step 4: Log successful sync
      await dbService.logSync('success', `Synced ${this.countUnsyncedItems(unsyncedData)} items`);
      
      this.notifyListeners({ type: 'sync_complete', success: true });
      return { success: true };

    } catch (error) {
      console.error('Sync error:', error);
      await dbService.logSync('error', error.message);
      this.notifyListeners({ type: 'sync_complete', success: false, error: error.message });
      return { success: false, error: error.message };

    } finally {
      this.syncInProgress = false;
    }
  }

  hasUnsyncedData(data) {
    return data.members.length > 0 || 
           data.attendance.length > 0 || 
           data.guests.length > 0;
  }

  countUnsyncedItems(data) {
    return data.members.length + data.attendance.length + data.guests.length;
  }

  async pushToServer(data) {
    const response = await fetch(`${API_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        members: data.members.map(m => ({
          ...m,
          synced: undefined
        })),
        attendance: data.attendance.map(a => ({
          ...a,
          prezent: a.prezent === 1,
          synced: undefined
        })),
        guests: data.guests.map(g => ({
          ...g,
          is_inlocuitor: g.is_inlocuitor === 1,
          synced: undefined
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Mark items as synced
    if (data.members.length > 0) {
      await dbService.markAsSynced('members', data.members.map(m => m.id));
    }
    if (data.attendance.length > 0) {
      await dbService.markAsSynced('attendance', data.attendance.map(a => a.id));
    }
    if (data.guests.length > 0) {
      await dbService.markAsSynced('guests', data.guests.map(g => g.id));
    }

    return result;
  }

  async pullFromServer() {
    const lastSync = await dbService.getLastSyncTime();
    
    const url = lastSync 
      ? `${API_URL}/sync/pull?since=${encodeURIComponent(lastSync)}`
      : `${API_URL}/sync/pull`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const serverData = await response.json();
    
    // Import server data (respecting local priority for conflicts)
    await dbService.importFromServer(serverData);

    return serverData;
  }

  // Get sync status
  async getStatus() {
    const lastSync = await dbService.getLastSyncTime();
    const unsyncedData = await dbService.getUnsyncedData();
    
    return {
      isOnline: this.isOnline,
      canSync: this.canSync(),
      lastSync,
      pendingChanges: this.countUnsyncedItems(unsyncedData),
      syncInProgress: this.syncInProgress
    };
  }
}

// Singleton instance
const syncService = new SyncService();
export default syncService;
