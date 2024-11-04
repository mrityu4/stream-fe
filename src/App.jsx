import React, { useState } from 'react';

const ScreenCapture = () => {
  const [stream, setStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);
  const wsRef = useRef(null);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        bitsPerSecond: 1000_000,
        video: {
          contentHint: "text", // Hint for display media content
          displaySurface: "browser",
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }, // Request fixed frame rate
        },
        // audio: false,
        // systemAudio: "include",
      });
      // Capture the microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100, // Set sample rate (e.g., 44.1 kHz)
          channelCount: 2, // Stereo audio
          bitrate: 128000, // Suggested bitrate for quality
        },
      });

      // Set content hint on each video and audio track
      stream.getVideoTracks().forEach(track => {
        track.applyConstraints({
          frameRate: 30
        })
        track.contentHint = "text"; // Setting content hint for screen share
      });
      micStream.getAudioTracks().forEach(track => {
        track.contentHint = "speech"; // Setting content hint for microphone
      });

      // Combine screen and microphone streams
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...micStream.getAudioTracks()
      ]);

      const recorder = new MediaRecorder(combinedStream, {
        // mimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 and AAC for audio
        // mimeType: 'video/x-matroska;codecs=h264', // H.264 and AAC for audio, gives constant bitrate but no frames
        // mimeType: 'video/webm;codecs=h264',//also gives constant bitrate but no frames
        video: { mimeType: 'video/h264' }, // Ensure H.264
        // mimeType: 'video/webm; codecs=vp8', // Use WebM format for better Chrome support
        bitsPerSecond: 1200_000, // 1.2 Mbps overall bitrate
        audioBitsPerSecond: 128000, // Fixed audio bitrate suggestion (128 kbps)
        videoBitsPerSecond: 1000_000, // Fixed video bitrate suggestion (1 Mbps)
        keyFrameInterval: 10, // Attempt to force keyframe every 30 frames (~1 second at 30 FPS)
      });


      const webSocket = new WebSocket('ws://localhost:8080');
      webSocket.onopen = () => {
        console.log('WebSocket connection established');
        setInterval(() => {
          recorder.requestData();
        }, 200);

        recorder.ondataavailable = (event) => {
          console.log('ondataavailable', event.data.size);
          webSocket.send(event.data);
        };

        recorder.start(500); // Send media chunks every second
        setMediaRecorder(recorder);
        setWs(webSocket);
      };

      webSocket.onclose = () => {
        console.log('WebSocket connection closed');
        recorder.stop();
      };
    } catch (err) {
      console.error('Error capturing screen: ', err);
    }
  };

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
      <h1>Screen Capture Streaming</h1>
      <button onClick={startCapture}>Start Streaming</button>
      <button onClick={stopCapture}>Stop Streaming</button>
      <p>Screen is being streamed...</p>
    </div>
  );
};

export default ScreenCapture;