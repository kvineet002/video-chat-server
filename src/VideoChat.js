import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://video-chat-server-jiiq.onrender.com'); // Change to your server address

const VideoChat = () => {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const localStreamRef = useRef(null); // Store local stream here
  const peerConnectionRef = useRef(null); // Store peer connection here
  const [roomId, setRoomId] = useState(''); // Dynamic room ID
  const [isJoined, setIsJoined] = useState(false);
  const [anotherpartyJoined, setAnotherpartyJoined] = useState(false);
  const configuration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302', // Google's public STUN server
      },
    ],
  };

  useEffect(() => {
    // Get the local stream (video/audio)
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

  return (
    <div className='  '>
    <h1 className=' text-center py-3 text-3xl font-bold text-green-600 bg-green-600 bg-opacity-20 '>Video Chat</h1>
     
    {(isJoined?<div>
      <h2 className='text-center text-xl font-bold py-3  text-green-600'>Your Room ID: {roomId}</h2>
    </div>:  <div className={` flex gap-10 items-center justify-center py-3  bg-emeral ${isJoined&&'hidden'} `}>
        <input
          type="text"
          placeholder="Enter Room ID or Create"
          value={roomId}
          className='border-2 border-green-600 rounded-md p-1 bg-green-600 bg-opacity-15 placeholder:text-black outline-none px-4 py-2'
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom} className=" bg-green-600 text-white   font-bold px-4 p-2 rounded-lg">Join Room</button>
      </div>)}
   
      <div className={` ${!isJoined&&'hidden'} flex flex-wrap justify-center md:m-10 m-2 gap-3`}>
        <video ref={localVideoRef} autoPlay playsInline muted  className="non-mirrored-video border-4 border-green-600 border-opacity-20 rounded-lg "/>
       
        <video ref={remoteVideoRef} autoPlay    className="non-mirrored-video border-4 border-green-600 border-opacity-20 rounded-lg "/>
       
      </div>
    
  </div>
  );
};

export default VideoChat;
