# API Reference

This server exposes a minimal HTTP endpoint and a set of Socket.IO events used for WebRTC signaling. All events are namespaced at the default namespace `/`.

- Base URL: `http://<HOST>:<PORT>` (default port: `5000`)
- Transport: WebSockets (Socket.IO)

## HTTP

### GET /
- **Description**: Health/status endpoint to verify the server is running.
- **Response**: `200 OK` with body `WebRTC Signaling Server`
- **Example**:
```bash
curl http://localhost:5000/
```

## Socket.IO Events

The server relays messages to all peers in a given room except the sender. Rooms are identified by a string `roomId` chosen by the client.

### Client → Server

#### join-room
- **Name**: `join-room`
- **Payload**:
  - `roomId` (string) — The target room identifier
- **Behavior**: Joins the Socket.IO room. Broadcasts `user-connected` to other participants.
- **Acknowledgement**: None
- **Example**:
```js
socket.emit('join-room', 'room-123');
```

#### offer
- **Name**: `offer`
- **Payload**:
  - `roomId` (string) — The room to broadcast to
  - `offer` (RTCSessionDescriptionInit) — The SDP offer created by `RTCPeerConnection.createOffer()`
- **Behavior**: Broadcasts `receive-offer` with the `offer` to all other peers in `roomId`.
- **Acknowledgement**: None
- **Example**:
```js
socket.emit('offer', 'room-123', offer);
```

#### answer
- **Name**: `answer`
- **Payload**:
  - `roomId` (string) — The room to broadcast to
  - `answer` (RTCSessionDescriptionInit) — The SDP answer created by `RTCPeerConnection.createAnswer()`
- **Behavior**: Broadcasts `receive-answer` with the `answer` to all other peers in `roomId`.
- **Acknowledgement**: None
- **Example**:
```js
socket.emit('answer', 'room-123', answer);
```

#### ice-candidate
- **Name**: `ice-candidate`
- **Payload**:
  - `roomId` (string) — The room to broadcast to
  - `candidate` (RTCIceCandidateInit) — The ICE candidate from `RTCPeerConnection.onicecandidate`
- **Behavior**: Broadcasts `new-ice-candidate` with the `candidate` to all other peers in `roomId`.
- **Acknowledgement**: None
- **Example**:
```js
socket.emit('ice-candidate', 'room-123', candidate);
```

### Server → Client

#### user-connected
- **Name**: `user-connected`
- **Payload**:
  - `socketId` (string) — The Socket.IO `id` of the user that just joined the room
- **Emitted When**: Another client successfully joins the same `roomId` via `join-room`.
- **Example**:
```js
socket.on('user-connected', (socketId) => {
  console.log('Peer joined:', socketId);
});
```

#### receive-offer
- **Name**: `receive-offer`
- **Payload**:
  - `offer` (RTCSessionDescriptionInit)
- **Emitted When**: Some client in the room emits `offer`.
- **Example**:
```js
socket.on('receive-offer', async (offer) => {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', ROOM_ID, answer);
});
```

#### receive-answer
- **Name**: `receive-answer`
- **Payload**:
  - `answer` (RTCSessionDescriptionInit)
- **Emitted When**: Some client in the room emits `answer`.
- **Example**:
```js
socket.on('receive-answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});
```

#### new-ice-candidate
- **Name**: `new-ice-candidate`
- **Payload**:
  - `candidate` (RTCIceCandidateInit)
- **Emitted When**: Some client in the room emits `ice-candidate`.
- **Example**:
```js
socket.on('new-ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error('Failed to add ICE candidate', err);
  }
});
```

## End-to-end usage example
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');
const ROOM_ID = 'room-123';

const peerConnection = new RTCPeerConnection();

// Relay local ICE candidates via server
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('ice-candidate', ROOM_ID, event.candidate.toJSON());
  }
};

// Join signaling room
socket.on('connect', async () => {
  socket.emit('join-room', ROOM_ID);
});

// Offerer flow
async function startOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', ROOM_ID, offer);
}

socket.on('receive-answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

// Answerer flow
socket.on('receive-offer', async (offer) => {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', ROOM_ID, answer);
});

// Receive ICE candidates from peers
socket.on('new-ice-candidate', async (candidate) => {
  await peerConnection.addIceCandidate(candidate);
});
```

## Notes and limitations
- This server does not manage authentication or authorization.
- Rooms are not capped and no server-side validation on `roomId` is performed.
- No persistence of signaling messages.
- Disconnection events only log to server stdout; no room-wide notifications.

## Versioning
- Express: ^4.19.2
- Socket.IO: ^4.7.5
- Node runtime: any version compatible with the above