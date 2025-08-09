import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface LogEntry {
  time: string;
  level?: string | number;
  msg?: string;
  resource?: string;
  action?: string;
  error?: string;
  [key: string]: any;
}

interface LogsResponse {
  success: boolean;
  data: {
    logs: LogEntry[];
    total: number;
    file: string;
    message?: string;
  };
}

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logType, setLogType] = useState<'app' | 'error'>('app');
  const [lines, setLines] = useState(100);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await axios.get<LogsResponse>(`/admin/api/logs?type=${logType}&lines=${lines}`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setLogs(response.data.data.logs.reverse()); // Show newest first
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType, lines]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, logType, lines]);

  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleString();
    } catch {
      return timeStr;
    }
  };

  const getLevelColor = (level?: string | number) => {
    const lvl = level !== undefined ? String(level).toLowerCase() : '';
    switch (lvl) {
      case '50':
      case 'err':
      case 'error':
        return 'text-red-600';
      case '40':
      case 'war':
      case 'warn':
        return 'text-yellow-600';
      case '30':
      case 'inf':
      case 'info':
        return 'text-blue-600';
      case '20':
      case 'deb':
      case 'debug':
        return 'text-gray-600';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Logs</h1>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1">Log Type:</label>
          <select
            value={logType}
            onChange={(e) => setLogType(e.target.value as 'app' | 'error')}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="app">Application Logs</option>
            <option value="error">Error Logs</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lines:</label>
          <select
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>

        <div>
          <label className="flex items-center mt-6">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {loading && logs.length === 0 ? (
          <div className="text-center py-4">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-4 text-gray-400">No logs found</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-2 pb-2 border-b border-gray-800">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-gray-400">{formatTime(log.time)}</span>
                {log.level !== undefined && (
                  <span className={`font-bold ${getLevelColor(log.level)}`}>
                    [{String(log.level).toUpperCase()}]
                  </span>
                )}
                {log.resource && (
                  <span className="text-yellow-400">
                    {log.resource}
                  </span>
                )}
                {log.action && (
                  <span className="text-blue-400">
                    {log.action}
                  </span>
                )}
              </div>
              <div className="mt-1">
                {log.msg && <div className="text-white">{log.msg}</div>}
                {log.error && (
                  <div className="text-red-400 mt-1">
                    Error: {typeof log.error === 'object'
                      ? JSON.stringify(log.error)
                      : log.error}
                  </div>
                )}
                {Object.entries(log)
                  .filter(([key]) => !['time', 'level', 'msg', 'resource', 'action', 'error'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="text-gray-300 text-xs mt-1">
                      <span className="text-cyan-400">{key}:</span> {JSON.stringify(value)}
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Logs;