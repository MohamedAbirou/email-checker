import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketHook {
  socket: Socket | null;
  isConnected: boolean;
}

export const useSocket = (serverUrl: string = 'http://localhost:5000'): SocketHook => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to Flask server');
      isConnectedRef.current = true;
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Flask server');
      isConnectedRef.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      isConnectedRef.current = false;
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
  };
};