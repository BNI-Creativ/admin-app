// Offline Context - Manages offline state and sync across the app
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import dbService from '../services/DatabaseService';
import syncService from '../services/SyncService';

const OfflineContext = createContext(null);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null,
    pendingChanges: 0,
    syncInProgress: false
  });
  const [error, setError] = useState(null);

  // Initialize database
  useEffect(() => {
    const init = async () => {
      try {
        await dbService.initialize();
        setIsInitialized(true);
        
        // Get initial sync status
        const status = await syncService.getStatus();
        setSyncStatus(status);
        setIsOnline(status.isOnline);

        // Start auto-sync (every 5 minutes)
        syncService.startAutoSync();

      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err.message);
      }
    };

    init();

    // Subscribe to sync updates
    const unsubscribe = syncService.subscribe((update) => {
      if (update.type === 'connection') {
        setIsOnline(update.online);
      } else if (update.type === 'sync_start') {
        setSyncStatus(prev => ({ ...prev, syncInProgress: true }));
      } else if (update.type === 'sync_complete') {
        updateSyncStatus();
      }
    });

    return () => {
      unsubscribe();
      syncService.stopAutoSync();
    };
  }, []);

  const updateSyncStatus = useCallback(async () => {
    const status = await syncService.getStatus();
    setSyncStatus(status);
  }, []);

  // Manual sync trigger
  const sync = useCallback(async () => {
    const result = await syncService.sync();
    await updateSyncStatus();
    return result;
  }, [updateSyncStatus]);

  // Database operations wrapper
  const db = {
    // Members
    getMembers: async () => {
      return await dbService.getMembers();
    },
    addMember: async (member) => {
      const result = await dbService.addMember(member);
      await updateSyncStatus();
      return result;
    },
    updateMember: async (id, member) => {
      const result = await dbService.updateMember(id, member);
      await updateSyncStatus();
      return result;
    },
    deleteMember: async (id) => {
      await dbService.deleteMember(id);
      await updateSyncStatus();
    },

    // Attendance
    getAttendanceByDate: async (date) => {
      return await dbService.getAttendanceByDate(date);
    },
    saveAttendance: async (date, memberId, prezent, taxa, numeInlocuitor) => {
      const result = await dbService.saveAttendance(date, memberId, prezent, taxa, numeInlocuitor);
      await updateSyncStatus();
      return result;
    },

    // Guests
    addGuest: async (guest) => {
      const result = await dbService.addGuest(guest);
      await updateSyncStatus();
      return result;
    },
    updateGuest: async (id, guest) => {
      const result = await dbService.updateGuest(id, guest);
      await updateSyncStatus();
      return result;
    },
    deleteGuest: async (id) => {
      await dbService.deleteGuest(id);
      await updateSyncStatus();
    },
    getGuestByMemberId: async (memberId, date) => {
      return await dbService.getGuestByMemberId(memberId, date);
    },

    // Dates
    getDatesWithData: async () => {
      return await dbService.getDatesWithData();
    }
  };

  const value = {
    isInitialized,
    isOnline,
    syncStatus,
    error,
    sync,
    db
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export default OfflineContext;
