import React, { useState, useEffect, useRef } from 'react';

const ScreenCapture = () => {
  const [stream, setStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const initScreenCapture = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        initWebSocket(mediaStream);
      } catch (error) {
        console.error('Error accessing screen capture:', error);
      }
    };

    initScreenCapture();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const initWebSocket = (mediaStream) => {
    const ws = new WebSocket('ws://localhost:3000');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connection established');
      startStreaming(mediaStream);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket connection closed');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const startStreaming = (mediaStream) => {
    const videoTrack = mediaStream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);

    const sendFrame = async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const bitmap = await imageCapture.grabFrame();
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          const jpeg = canvas.toDataURL('image/jpeg', 0.7);
          wsRef.current.send(jpeg);
        } catch (error) {
          console.error('Error capturing or sending frame:', error);
        }
      }
      requestAnimationFrame(sendFrame);
    };

    sendFrame();
  };

  return (
    <div>
      <h2>Screen Capture</h2>
      <video ref={videoRef} autoPlay playsInline muted />
      <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
};

export default ScreenCapture;