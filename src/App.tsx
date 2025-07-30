import { AlertCircle, CheckCircle, Download, Mail, Moon, Pause, Play, Sun, Upload, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './hooks/useSocket';

interface EmailResult {
  email: string;
  status: 'valid' | 'bounced' | 'error';
  message: string;
  timestamp: Date;
}

interface ProgressData {
  current: number;
  total: number;
  currentEmail: string;
}

interface Stats {
  valid: number;
  bounced: number;
  error: number;
  total: number;
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressData>({ current: 0, total: 0, currentEmail: '' });
  const [results, setResults] = useState<EmailResult[]>([]);
  const [activeTab, setActiveTab] = useState<'valid' | 'bounced' | 'error'>('valid');
  const [stats, setStats] = useState<Stats>({ valid: 0, bounced: 0, error: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket, isConnected } = useSocket();

  // Update stats whenever results change
  useEffect(() => {
    const newStats = results.reduce(
      (acc, result) => {
        acc[result.status]++;
        acc.total++;
        return acc;
      },
      { valid: 0, bounced: 0, error: 0, total: 0 }
    );
    setStats(newStats);
  }, [results]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('progress', (data: ProgressData) => {
      setProgress(data);
    });

    socket.on('result', (result: EmailResult) => {
      setResults(prev => [...prev, result]);
    });

    socket.on('processing_complete', (data: any) => {
      setIsProcessing(false);
      setProgress(prev => ({ ...prev, currentEmail: 'Completed!' }));
      console.log('Processing completed:', data);
    });

    return () => {
      socket.off('progress');
      socket.off('result');
      socket.off('processing_complete');
    };
  }, [socket]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  };

  const startProcessing = async () => {
    if (!selectedFile || !socket) return;

    setIsProcessing(true);
    setIsPaused(false);
    setResults([]);
    setProgress({ current: 0, total: 0, currentEmail: '' });

    try {
      const formData = new FormData();
      formData.append('email_file', selectedFile);

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Error processing file:', error);
      setIsProcessing(false);
      alert('Error uploading file. Please try again.');
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const downloadResults = (category: 'valid' | 'bounced' | 'error') => {
    window.open(`http://localhost:5000/api/download/${category}`, '_blank');
  };

  const filteredResults = results.filter(result => result.status === activeTab);
  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const formatTimestamp = (ts: number | string | Date) => {
  const date = ts instanceof Date ? ts : new Date(Number(ts) * 1000);
  return date.toLocaleTimeString();
};


  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white' 
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gray-800/80 border-gray-700' 
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Gmail Email Checker
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Validate Gmail addresses with real-time results {isConnected ? '🟢' : '🔴'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${
          isDarkMode 
            ? 'bg-gray-800/50 border border-gray-700' 
            : 'bg-white/70 border border-white shadow-xl backdrop-blur-sm'
        }`}>
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <Upload className="w-5 h-5 mr-2 text-blue-500" />
            Upload Email List
          </h2>
          
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : isDarkMode
                ? 'border-gray-600 hover:border-gray-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            
            <div className="space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                selectedFile 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {selectedFile ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {selectedFile ? (
                <div>
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✅ {selectedFile.name}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    File selected successfully
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">
                    Drop your email list here or click to browse
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Supports .txt files with one email per line
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center mt-6 space-x-4">
            <button
              onClick={startProcessing}
              disabled={!selectedFile || isProcessing || !isConnected}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <Play className="w-4 h-4 mr-2" />
              {isConnected ? 'Start Checking' : 'Connecting...'}
            </button>
            
            {isProcessing && (
              <button
                onClick={togglePause}
                className={`flex items-center px-6 py-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg ${
                  isPaused
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {(isProcessing || progress.total > 0) && (
          <div className={`rounded-2xl p-6 mb-8 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-gray-800/50 border border-gray-700' 
              : 'bg-white/70 border border-white shadow-xl backdrop-blur-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Progress</h3>
              <span className="text-2xl font-bold text-blue-500">
                {progressPercentage.toFixed(1)}%
              </span>
            </div>
            
            <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden`}>
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`text-center p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className="text-2xl font-bold text-blue-500">{progress.current}</p>
                <p className="text-sm text-gray-500">Processed</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className="text-2xl font-bold text-gray-400">{progress.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className="text-2xl font-bold text-gray-400">{progress.total - progress.current}</p>
                <p className="text-sm text-gray-500">Remaining</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className={`text-sm font-medium truncate ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {progress.currentEmail || 'Ready to start'}
                </p>
                <p className="text-sm text-gray-500">Current</p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={`rounded-2xl p-6 transition-all duration-300 border ${
              isDarkMode 
                ? 'bg-green-900/20 border-green-800 hover:bg-green-900/30' 
                : 'bg-green-50 border-green-200 hover:bg-green-100'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 dark:text-green-400 text-sm font-medium">Valid Emails</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.valid}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {stats.total > 0 ? ((stats.valid / stats.total) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className={`rounded-2xl p-6 transition-all duration-300 border ${
              isDarkMode 
                ? 'bg-red-900/20 border-red-800 hover:bg-red-900/30' 
                : 'bg-red-50 border-red-200 hover:bg-red-100'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">Bounced Emails</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300">{stats.bounced}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {stats.total > 0 ? ((stats.bounced / stats.total) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
            </div>

            <div className={`rounded-2xl p-6 transition-all duration-300 border ${
              isDarkMode 
                ? 'bg-orange-900/20 border-orange-800 hover:bg-orange-900/30' 
                : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Error Emails</p>
                  <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{stats.error}</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    {stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <AlertCircle className="w-12 h-12 text-orange-500" />
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className={`rounded-2xl p-6 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-gray-800/50 border border-gray-700' 
              : 'bg-white/70 border border-white shadow-xl backdrop-blur-sm'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Results</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadResults(activeTab)}
                  disabled={filteredResults.length === 0}
                  className="flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              {[
                { key: 'valid', label: 'Valid', icon: CheckCircle, color: 'text-green-500' },
                { key: 'bounced', label: 'Bounced', icon: XCircle, color: 'text-red-500' },
                { key: 'error', label: 'Error', icon: AlertCircle, color: 'text-orange-500' }
              ].map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as 'valid' | 'bounced' | 'error')}
                  className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 flex-1 justify-center ${
                    activeTab === key
                      ? isDarkMode
                        ? 'bg-gray-600 text-white shadow-lg'
                        : 'bg-white text-gray-900 shadow-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2 ${activeTab === key ? color : ''}`} />
                  {label}
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    activeTab === key
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>
                    {stats[key as keyof Stats]}
                  </span>
                </button>
              ))}
            </div>

            {/* Results Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className={`sticky top-0 ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-gray-200 dark:divide-gray-700 ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                  }`}>
                    {filteredResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                          {result.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            result.status === 'valid'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : result.status === 'bounced'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            {result.message}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatTimestamp(result.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {filteredResults.length === 0 && (
              <div className="text-center py-12">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <Mail className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  No {activeTab} emails found yet
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;