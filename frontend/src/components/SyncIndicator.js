// Sync Indicator Component - Shows sync status and provides manual sync button
import React from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { Button } from './ui/button';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertCircle 
} from 'lucide-react';

const SyncIndicator = () => {
  const { isOnline, syncStatus, sync } = useOffline();

  const handleSync = async () => {
    await sync();
  };

  const formatLastSync = (dateString) => {
    if (!dateString) return 'Niciodată';
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-zinc-200 text-sm">
      {/* Online/Offline indicator */}
      <div className={`flex items-center gap-1 ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
        {isOnline ? (
          <Cloud className="w-4 h-4" />
        ) : (
          <CloudOff className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-200" />

      {/* Pending changes */}
      {syncStatus.pendingChanges > 0 && (
        <>
          <div className="flex items-center gap-1 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span>{syncStatus.pendingChanges} nesincronizate</span>
          </div>
          <div className="w-px h-4 bg-zinc-200" />
        </>
      )}

      {/* Last sync time */}
      <div className="text-zinc-500 hidden md:flex items-center gap-1">
        <Check className="w-3 h-3" />
        <span>Ultima sincr.: {formatLastSync(syncStatus.lastSync)}</span>
      </div>

      {/* Sync button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        disabled={!isOnline || syncStatus.syncInProgress}
        className="ml-1"
        title={isOnline ? 'Sincronizează acum' : 'Offline - nu se poate sincroniza'}
      >
        <RefreshCw 
          className={`w-4 h-4 ${syncStatus.syncInProgress ? 'animate-spin' : ''}`} 
        />
        <span className="ml-1 hidden sm:inline">
          {syncStatus.syncInProgress ? 'Se sincronizează...' : 'Sincronizează'}
        </span>
      </Button>
    </div>
  );
};

export default SyncIndicator;
