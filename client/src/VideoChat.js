import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-chat-server-jiiq.onrender.com'); // Change to your server address
// const socket = io('http://localhost:5000'); // Change to your server address

const VideoChat = () => {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const localStreamRef = useRef(null); // Store local stream here
  const peerConnectionRef = useRef(null); // Store peer connection here
  const [roomId, setRoomId] = useState(''); // Dynamic room ID
  const [isJoined, setIsJoined] = useState(false);
  const [anotherpartyJoined, setAnotherpartyJoined] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [peerIsStreaming, setPeerIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [musicUrl, setMusicUrl] = useState('');
  const [currentMusicUrl, setCurrentMusicUrl] = useState('');
  const [showMusicInput, setShowMusicInput] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMusicActive, setIsMusicActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [currentSongTitle, setCurrentSongTitle] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [showFileList, setShowFileList] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const audioRef = useRef(null);
  const lastSyncTime = useRef(0);
  
  // Initialize audio element on mount
  useEffect(() => {
    // Create audio element optimized for music playback
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1.0;
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    
    // Event listeners for progress tracking
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      if (audio) {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  const configuration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302', // Google's public STUN server
      },
    ],
  };
  useEffect(() => {
    // Get the local stream (video/audio for WebRTC call)
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream; // Display local video
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
        alert('Could not access your camera and microphone. Please allow access and try again.');
      });

    // Configure music audio element for native device playback (separate from WebRTC)
    const audio = audioRef.current;
    if (audio && audio.setSinkId) {
      // Route music to device's default speakers (not through WebRTC call)
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioOutput = devices.find(device => device.kind === 'audiooutput');
        if (audioOutput) {
          audio.setSinkId(audioOutput.deviceId)
            .then(() => console.log('Music routed to device speakers'))
            .catch(e => console.log('setSinkId error:', e));
        }
      });
    }

    // Listen for new ICE candidate
    socket.on('new-ice-candidate', handleNewIceCandidate);

    return () => {
      socket.off('new-ice-candidate');
    };
  }, []);

  const joinRoom = () => {
    if (roomId) {
      socket.emit('join-room', roomId);
      setIsJoined(true);
      
      // When a new user connects
      socket.on('user-connected', handleNewUserConnected);

      // Listen for incoming offer
      socket.on('receive-offer', handleReceiveOffer);

      // Listen for incoming answer
      socket.on('receive-answer', handleReceiveAnswer);
      
      // Listen for music streaming events (URL sharing only, not audio stream)
      socket.on('peer-streaming-status', (data) => {
        console.log('Received peer-streaming-status:', data);
        if (data.isStreaming && data.musicUrl) {
          console.log('Loading music URL locally:', data.musicUrl);
          setCurrentMusicUrl(data.musicUrl);
          setCurrentSongTitle(data.title || data.musicUrl.split('/').pop().split('?')[0]);
          setIsMusicActive(true);
          
          // Load audio file directly on this device (not through WebRTC)
          const audio = audioRef.current;
          if (audio) {
            audio.src = data.musicUrl;
            audio.volume = 1.0; // Full volume for device playback
            audio.load();
            console.log('Audio loaded locally on device');
          }
        } else {
          console.log('Clearing music');
          setCurrentMusicUrl('');
          setIsMusicActive(false);
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
          }
        }
      });
      
      socket.on('music-control', handleMusicControl);
      
      setAnotherpartyJoined(true);
    }
  };

  const handleNewUserConnected = (userId) => {
    console.log('New user connected:', userId);
    createOffer();
  };

  const createOffer = () => {
    if (!localStreamRef.current) {
      console.error('Local stream not available');
      return;
    }

    peerConnectionRef.current = new RTCPeerConnection(configuration);
    localStreamRef.current.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current);
    });

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', roomId, event.candidate);
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setIsPeerConnected(true);
    };

    peerConnectionRef.current.createOffer().then((offer) => {
      peerConnectionRef.current.setLocalDescription(offer);
      socket.emit('offer', roomId, offer);
    });
  };

  const handleReceiveOffer = (offer) => {
    if (!localStreamRef.current) {
      console.error('Local stream not available');
      return;
    }

    peerConnectionRef.current = new RTCPeerConnection(configuration);
    localStreamRef.current.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current);
    });

    peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

    peerConnectionRef.current.createAnswer().then((answer) => {
      peerConnectionRef.current.setLocalDescription(answer);
      socket.emit('answer', roomId, answer);
    });

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', roomId, event.candidate);
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setIsPeerConnected(true);
    };
  };

  const handleReceiveAnswer = (answer) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleNewIceCandidate = (candidate) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const startMusicStream = () => {
    setShowMusicInput(true);
  };
  
  const stopMusicStream = () => {
    console.log('Stopping music stream');
    setIsStreaming(false);
    setIsMusicActive(false);
    setCurrentMusicUrl('');
    setMusicUrl('');
    setIsPlaying(false);
    setShowMusicInput(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    socket.emit('streaming-status', roomId, { isStreaming: false, musicUrl: '' });
    console.log('Stop streaming emitted to peer');
  };
  
  const shareMusic = async () => {
    if (!musicUrl.trim()) {
      alert('Please enter a YouTube URL or direct audio file URL');
      return;
    }
    
    let processedUrl = musicUrl.trim();
    let songTitle = '';
    
    try {
      new URL(processedUrl);
    } catch (e) {
      alert('Please enter a valid URL');
      return;
    }
    
    // Check if it's a YouTube URL
    if (processedUrl.includes('youtube.com') || processedUrl.includes('youtu.be')) {
      try {
        const result = await convertYouTubeUrl(processedUrl);
        processedUrl = result.mp3Url;
        songTitle = result.title;
        console.log('Converted YouTube URL to MP3:', processedUrl);
      } catch (error) {
        alert('Failed to convert YouTube URL. Please try another link.');
        return;
      }
    }
    // Convert GitHub URLs to raw content URLs
    else if (processedUrl.includes('github.com') && processedUrl.includes('/blob/')) {
      processedUrl = processedUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      console.log('Converted GitHub URL to:', processedUrl);
    }
    
    const musicData = { 
      isStreaming: true, 
      musicUrl: processedUrl,
      title: songTitle || processedUrl.split('/').pop().split('?')[0]
    };
    console.log('Sharing music:', musicData);
    
    setIsStreaming(true);
    setIsMusicActive(true);
    setCurrentMusicUrl(processedUrl);
    setCurrentSongTitle(songTitle || processedUrl.split('/').pop().split('?')[0]);
    setShowMusicInput(false);
    
    // Load and configure audio for native playback
    const audio = audioRef.current;
    audio.src = processedUrl;
    audio.load();
    
    // Ensure audio plays through device speakers, not call
    audio.onloadedmetadata = () => {
      console.log('Audio loaded, duration:', audio.duration);
      // Force audio to play through default output device
      audio.play().then(() => {
        console.log('Auto-play started');
        setIsPlaying(true);
        // Sync with peer
        socket.emit('music-control', roomId, {
          action: 'play',
          timestamp: 0,
          serverTime: Date.now()
        });
      }).catch(e => console.log('Auto-play prevented:', e));
    };
    
    socket.emit('streaming-status', roomId, musicData);
  };
  
  const togglePlayPause = () => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    
    const audio = audioRef.current;
    const currentTime = audio.currentTime;
    const action = newPlayState ? 'play' : 'pause';
    
    // Play/pause locally with proper audio routing
    if (newPlayState) {
      // Ensure volume is at maximum for device playback
      audio.volume = 1.0;
      audio.play().catch(e => console.error('Play failed:', e));
    } else {
      audio.pause();
    }
    
    // Emit to peer for sync (only control commands, not audio stream)
    socket.emit('music-control', roomId, {
      action: action,
      timestamp: currentTime,
      serverTime: Date.now()
    });
    
    console.log(`${action} music at ${currentTime}s`);
  };
  
  const handleSeek = (newTime) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      
      // Sync seek with peer
      socket.emit('music-control', roomId, {
        action: 'seek',
        timestamp: newTime,
        serverTime: Date.now()
      });
    }
  };
  
  const handleVolumeChange = (newVolume) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
      setVolume(newVolume);
    }
  };
  
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const fetchAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const response = await fetch('https://swc.iitg.ac.in/yt-convert/files');
      const data = await response.json();
      console.log('Fetched available files:', data.files);
      setAvailableFiles(data.files);
      
    } catch (error) {
      console.error('Error fetching files:', error);
      setAvailableFiles([]);
      alert('Failed to load available files');
    } finally {
      setLoadingFiles(false);
    }
  };
  
  const convertYouTubeUrl = async (ytUrl) => {
    setIsConverting(true);
    try {
      const response = await fetch(`https://swc.iitg.ac.in/yt-convert/api?v=${encodeURIComponent(ytUrl)}`);
      const data = await response.json();
      
      if (data.success && data.mp3Url) {
        return {
          mp3Url: data.mp3Url,
          title: data.title,
          duration: data.duration
        };
      } else {
        throw new Error(data.message || 'Conversion failed');
      }
    } catch (error) {
      console.error('Error converting YouTube URL:', error);
      throw error;
    } finally {
      setIsConverting(false);
    }
  };

  const playFromList = (file) => {
    console.log('Playing from list:', file);
    
    const mp3Url = file.mp3Url || file.url;
    const songTitle = file.title || file.filename;
    
    const musicData = { 
      isStreaming: true, 
      musicUrl: mp3Url,
      title: songTitle
    };
    
    setIsStreaming(true);
    setIsMusicActive(true);
    setCurrentMusicUrl(mp3Url);
    setCurrentSongTitle(songTitle);
    setShowFileList(false);
    setShowMusicInput(false);
    
    // Stop current audio and load new one
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    audio.src = mp3Url;
    audio.load();
    
    audio.onloadedmetadata = () => {
      console.log('Audio loaded from list:', songTitle, 'duration:', audio.duration);
      audio.play().then(() => {
        console.log('Playing:', songTitle);
        setIsPlaying(true);
        socket.emit('music-control', roomId, {
          action: 'play',
          timestamp: 0,
          serverTime: Date.now()
        });
      }).catch(e => console.log('Auto-play prevented:', e));
    };
    
    socket.emit('streaming-status', roomId, musicData);
  };

  const handleMusicControl = (data) => {
    console.log('Received music control:', data);
    
    const now = Date.now();
    const latency = now - data.serverTime;
    const adjustedTime = data.timestamp + (latency / 1000);
    
    // Prevent feedback loops
    if (now - lastSyncTime.current < 500) {
      console.log('Ignoring sync - too soon after last sync');
      return;
    }
    lastSyncTime.current = now;
    
    const audio = audioRef.current;
    if (audio && audio.src) {
      // Ensure full volume for native device playback
      audio.volume = 1.0;
      
      // Sync time with latency compensation
      const timeDiff = Math.abs(audio.currentTime - adjustedTime);
      if (timeDiff > 0.5) { // Only sync if difference > 0.5s
        audio.currentTime = adjustedTime;
        console.log(`Synced to ${adjustedTime}s (latency: ${latency}ms)`);
      }
      
      if (data.action === 'play') {
        // Play through device speakers, not WebRTC
        audio.play().catch(e => console.error('Play failed:', e));
        setIsPlaying(true);
      } else if (data.action === 'pause') {
        audio.pause();
        setIsPlaying(false);
      } else if (data.action === 'seek') {
        audio.currentTime = adjustedTime;
        setCurrentTime(adjustedTime);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  return (
    <div>
    <h1 className='text-center py-3 text-3xl font-bold text-purple-600 bg-purple-600 bg-opacity-20'>2PEER</h1>
     
    {isJoined ? (
      <div>
        <h2 className='text-center text-xl font-bold py-3 text-green-600'>Your Room ID: {roomId}</h2>
      </div>
    ) : (
      <div className='flex gap-4 md:gap-10 items-center justify-center py-3 px-4'>
        <input
          type="text"
          placeholder="Enter Room ID or Create"
          value={roomId}
          className='border-2 border-green-600 rounded-md bg-green-600 bg-opacity-15 placeholder:text-gray-600 outline-none px-4 py-2 text-black focus:ring-2 focus:ring-green-500'
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg transition-all whitespace-nowrap">
          Join Room
        </button>
      </div>
    )}
   
      <div className={` ${!isJoined&&'hidden'} flex flex-wrap justify-center md:m-10 m-2 gap-3`}>
        <div className="relative">
          <video ref={localVideoRef} autoPlay playsInline muted  className="non-mirrored-video border-4 border-green-600 border-opacity-20 rounded-lg "/>
          {!isCameraOn && isJoined && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg">
              <svg className="w-16 h-16 md:w-20 md:h-20 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
              </svg>
              <p className="text-gray-300 text-lg md:text-xl font-semibold">Camera Off</p>
            </div>
          )}
        </div>
       
        <div className="relative">
          <video ref={remoteVideoRef} autoPlay    className="non-mirrored-video border-4 border-green-600 border-opacity-20 rounded-lg "/>
          {!isPeerConnected && isJoined && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-opacity-95 rounded-lg backdrop-blur-sm p-4  h-[250px] ">
              <div className="animate-pulse mb-3 md:mb-4">
                <svg className="w-12 h-12 md:w-20 md:h-20 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-white text-lg md:text-2xl font-bold mb-1 md:mb-2 text-center">Waiting for peer...</p>
              <p className="text-gray-400 text-xs md:text-sm text-center px-2">Share your Room ID to connect</p>
              <div className="flex gap-1.5 md:gap-2 mt-3 md:mt-4">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
            </div>
          )}
        </div>
       
      </div>

      {/* Music URL Input Modal - For custom URLs */}
      {showMusicInput && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-2xl p-6 md:p-8 max-w-md w-full">
            <h3 className="text-white text-xl md:text-2xl font-bold mb-4">Share Custom URL</h3>
            <p className="text-gray-300 text-sm mb-2">
              Paste a YouTube URL or direct audio file URL
            </p>
            <p className="text-gray-400 text-xs mb-4">
              🎵 YouTube • 🎧 MP3/Audio files • 📁 GitHub links
            </p>
            
            {isConverting && (
              <div className="bg-purple-600 bg-opacity-20 border border-purple-500 rounded-lg p-3 mb-4">
                <p className="text-purple-300 text-sm flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Converting YouTube video to MP3...
                </p>
              </div>
            )}
            
            <input
              type="text"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or .mp3 URL"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && !isConverting && shareMusic()}
              disabled={isConverting}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowMusicInput(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={shareMusic}
                disabled={isConverting}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? 'Converting...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* File List Modal */}
      {showFileList && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl md:text-2xl font-bold">
                Available Songs ({availableFiles.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMusicInput(true)}
                  className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-semibold px-3 py-1 rounded-lg hover:bg-purple-600 hover:bg-opacity-20 flex items-center gap-1"
                  title="Add Custom URL"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Custom URL
                </button>
                <button
                  onClick={() => setShowFileList(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {loadingFiles ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-purple-500 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-400">Loading files...</p>
              </div>
            ) : availableFiles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No files available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableFiles.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => playFromList(file)}
                    className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-600 rounded-full p-2 group-hover:bg-purple-500 transition-colors">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{file.filename}</p>
            
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Synchronized Music Player */}
      {isMusicActive && (
        <div className={`fixed ${isPlayerExpanded ? 'top-20 left-1/2 transform -translate-x-1/2 w-11/12 md:w-2/3 lg:w-1/2' : 'bottom-24 md:bottom-28 right-4 w-80'} bg-gradient-to-br from-purple-900 to-gray-900 rounded-2xl shadow-2xl overflow-hidden z-40 transition-all duration-300`}>
          <div className="bg-purple-600 px-4 md:px-6 py-3 flex justify-between items-center cursor-pointer" onClick={() => setIsPlayerExpanded(!isPlayerExpanded)}>
            <span className="text-white font-bold text-sm md:text-base flex items-center gap-2">
              <svg className={`w-5 h-5 md:w-6 md:h-6 ${isPlaying ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
              {isStreaming ? 'Your Music' : 'Listening Together'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowFileList(true);
                  fetchAvailableFiles();
                }}
                className="text-white hover:text-gray-300 transition-colors p-1"
                title="View All Songs"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsPlayerExpanded(!isPlayerExpanded); }}
                className="text-white hover:text-gray-300 transition-colors p-1"
                title={isPlayerExpanded ? 'Minimize' : 'Expand'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {isPlayerExpanded ? (
                    <path strokeLinecap="round" d="M19 9l-7 7-7-7"/>
                  ) : (
                    <path strokeLinecap="round" d="M5 15l7-7 7 7"/>
                  )}
                </svg>
              </button>
              {isStreaming && (
                <button
                  onClick={(e) => { e.stopPropagation(); stopMusicStream(); }}
                  className="text-white hover:text-red-300 transition-colors p-1"
                  title="Stop streaming"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {isPlayerExpanded && (
            <div className="p-6 md:p-8">
              <div className="flex flex-col items-center">
                {/* Album Art Placeholder */}
                <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6 flex items-center justify-center shadow-lg">
                  <svg className="w-16 h-16 md:w-20 md:h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                
                {/* Song Info */}
              <p className="text-white text-sm md:text-base mb-4 text-center px-4 break-all font-semibold">
                {currentMusicUrl.split('/').pop().split('?')[0].substring(0, 40) || 'Music Track'}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full mb-6">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Play/Pause Controls */}
              <div className="flex items-center gap-6 mb-4">
                <button
                  onClick={() => handleSeek(Math.max(0, currentTime - 10))}
                  className="text-white hover:text-purple-300 transition-colors"
                  title="Rewind 10s"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                  </svg>
                </button>
                
                <button
                  onClick={togglePlayPause}
                  className="bg-white hover:bg-gray-100 text-purple-600 rounded-full p-4 shadow-lg transition-all active:scale-95"
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                <button
                  onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                  className="text-white hover:text-purple-300 transition-colors"
                  title="Forward 10s"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
                  </svg>
                </button>
              </div>
              
              {/* Volume Control */}
              <div className="w-full flex items-center gap-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
                  }}
                />
                <span className="text-white text-xs w-10">{Math.round(volume * 100)}%</span>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Music Streaming Button */}
      {isJoined && isPeerConnected && !isMusicActive && (
        <div className="fixed bottom-20 md:bottom-24 left-1/2 transform -translate-x-1/2 bg-purple-900 bg-opacity-90 rounded-full px-4 md:px-6 py-2 md:py-3 shadow-lg z-50">
          <button
            onClick={() => {
              setShowFileList(true);
              fetchAvailableFiles();
            }}
            className="px-4 py-2 md:px-5 md:py-2.5 rounded-full transition-all font-semibold text-sm md:text-base bg-purple-600 hover:bg-purple-700 active:scale-95 text-white"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.952 1.651a.75.75 0 01.298.599V21.75a.75.75 0 01-1.202.588L12 17.162l-7.048 5.176A.75.75 0 013.75 21.75V2.25a.75.75 0 011.202-.588L12 6.838l7.048-5.176a.75.75 0 01.904-.011z"/>
              </svg>
              Stream Music
            </span>
          </button>
        </div>
      )}

      {/* Floating Navigation Bar */}
      {isJoined && (
        <div className="fixed bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 rounded-full px-4 md:px-6 py-2 md:py-3 flex gap-3 md:gap-4 shadow-lg z-50">
          <button
            onClick={toggleCamera}
            className={`p-2.5 md:p-3 rounded-full transition-all ${
              isCameraOn 
                ? 'bg-green-600 hover:bg-green-700 active:scale-95' 
                : 'bg-red-600 hover:bg-red-700 active:scale-95'
            } text-white font-bold`}
          >
            {isCameraOn ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
          
          <button
            onClick={toggleMic}
            className={`p-2.5 md:p-3 rounded-full transition-all ${
              isMicOn 
                ? 'bg-green-600 hover:bg-green-700 active:scale-95' 
                : 'bg-red-600 hover:bg-red-700 active:scale-95'
            } text-white font-bold`}
          >
            {isMicOn ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
        </div>
      )}
    
  </div>
  );
};

export default VideoChat;
