# WebRTC Signaling Server (Express + Socket.IO)

A minimal, production-ready signaling server for WebRTC built with Express and Socket.IO. It handles room joins and relays SDP offers/answers and ICE candidates between peers.

- **Tech stack**: Node.js, Express, Socket.IO
- **Use case**: Power peer-to-peer audio/video/data connections by exchanging signaling messages
- **Status endpoint**: `GET /` returns a simple health message

## Quick start

### Prerequisites
- Node.js and npm installed

### Install
```bash
npm install
```

### Run (development)
```bash
npm run start
```
Runs with `nodemon` for auto-reload.

### Run (production)
```bash
node server.js
```

### Configuration
- **PORT**: Port to listen on (default: `5000`)
- **CORS (HTTP)**: `server.js` allows `http://localhost:3000` for REST
- **CORS (Socket.IO)**: `server.js` allows `http://localhost:3000` and `https://video-chat-self.vercel.app` for the Socket.IO handshake

To change allowed origins, edit `server.js`:
```js
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000","https://your-app.example"],
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: ["http://localhost:3000"] }));
```

## API overview
- **HTTP**
  - `GET /` → Returns `WebRTC Signaling Server`
- **Socket.IO events**
  - Client → Server: `join-room(roomId)`, `offer(roomId, offer)`, `answer(roomId, answer)`, `ice-candidate(roomId, candidate)`
  - Server → Client: `user-connected(socketId)`, `receive-offer(offer)`, `receive-answer(answer)`, `new-ice-candidate(candidate)`

See the full, detailed reference in [`docs/API.md`](docs/API.md).

## Minimal client example
```bash
npm install socket.io-client
```

```js
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:5000";
const ROOM_ID = "demo-room-1";

const socket = io(SERVER_URL, {
  transports: ["websocket"],
  // withCredentials: true, // if you need cookies/creds
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("join-room", ROOM_ID);
});

socket.on("user-connected", (peerSocketId) => {
  console.log("Peer joined:", peerSocketId);
});

socket.on("receive-offer", async (offer) => {
  // Set remote description and create/send answer
});

socket.on("receive-answer", async (answer) => {
  // Set remote description for the offerer
});

socket.on("new-ice-candidate", async (candidate) => {
  // Add ICE candidate to your RTCPeerConnection
});
```

## Typical WebRTC signaling flow
1. Client A connects and `join-room(ROOM_ID)`
2. Client B connects and `join-room(ROOM_ID)` → A receives `user-connected(B)`
3. A creates SDP offer and emits `offer(ROOM_ID, offer)` → B receives `receive-offer(offer)`
4. B creates SDP answer and emits `answer(ROOM_ID, answer)` → A receives `receive-answer(answer)`
5. Both sides exchange ICE candidates via `ice-candidate(ROOM_ID, candidate)` → peer receives `new-ice-candidate(candidate)`

Notes:
- Broadcasts go to all peers in the room except the sender.
- There is no built-in room capacity limit or user-disconnect broadcast.

## Project structure
```
.
├── server.js          # Express + Socket.IO server and events
├── package.json       # Scripts and dependencies
└── docs/
    └── API.md         # Detailed API reference
```

## License
ISC