# @opensky/skymeet

WebRTC video conferencing library for OpenSky Suite.

## Features

- **WebRTC Core**: Full-featured WebRTC implementation for video/audio calling
- **Media Stream Management**: Camera, microphone, and screen sharing
- **Peer Connection Management**: Multi-peer connections with signaling
- **Data Channels**: Real-time data communication between peers
- **Connection Statistics**: Monitor bandwidth, latency, packet loss
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Well-Tested**: 95%+ test coverage with Vitest

## Installation

```bash
npm install @opensky/skymeet
```

## Quick Start

### Basic Video Call

```typescript
import { MediaStreamManager, PeerConnectionManager } from "@opensky/skymeet";

// Initialize managers
const mediaManager = new MediaStreamManager();
const peerManager = new PeerConnectionManager({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

// Get local media (camera + microphone)
const localStream = await mediaManager.getUserMedia({
  audio: true,
  video: true,
});

// Create peer connection
const connection = peerManager.createPeerConnection("peer-id", localStream);

// Listen for remote tracks
peerManager.on("track", (peerId, track, stream) => {
  // Attach remote stream to video element
  const videoElement = document.getElementById("remote-video");
  videoElement.srcObject = stream;
});

// Create and send offer
const offer = await peerManager.createOffer("peer-id");
// Send offer to remote peer via your signaling server...

// Receive answer from remote peer
await peerManager.setRemoteDescription("peer-id", answer);

// Add ICE candidates as they arrive
await peerManager.addIceCandidate("peer-id", candidate);
```

### Screen Sharing

#### Simple Approach (Manual Track Replacement)

```typescript
// Start screen sharing
const screenStream = await mediaManager.getDisplayMedia({
  video: true,
  audio: false,
});

// Replace video track in peer connection
const videoSender = connection
  .getSenders()
  .find((sender) => sender.track?.kind === "video");

if (videoSender) {
  await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
}

// Stop screen sharing
mediaManager.stopScreenShare();
```

#### Advanced Approach (ScreenShareManager - Recommended)

```typescript
import { ScreenShareManager } from "@opensky/skymeet";

// Create screen share manager
const screenShareManager = new ScreenShareManager(mediaManager, peerManager);

// Start screen sharing (automatically replaces tracks in all peer connections)
await screenShareManager.startScreenShare();

// Stop screen sharing (automatically restores original video)
await screenShareManager.stopScreenShare();

// Toggle screen sharing
const isSharing = await screenShareManager.toggleScreenShare();

// Check state
console.log("Is sharing:", screenShareManager.isScreenSharing());
console.log("Screen stream:", screenShareManager.getScreenStream());
```

#### Replace Video Track in All Peers

```typescript
// Get screen share stream
const screenStream = await mediaManager.getDisplayMedia();
const screenTrack = screenStream.getVideoTracks()[0];

// Replace video track in all active peer connections
await peerManager.replaceVideoTrackForAll(screenTrack);

// Later, restore camera
const cameraStream = mediaManager.getLocalStream();
const cameraTrack = cameraStream.getVideoTracks()[0];
await peerManager.replaceVideoTrackForAll(cameraTrack);
```

### Audio/Video Controls

```typescript
// Mute/unmute microphone
mediaManager.setAudioEnabled(false); // Mute
mediaManager.setAudioEnabled(true); // Unmute

// Enable/disable camera
mediaManager.setVideoEnabled(false); // Camera off
mediaManager.setVideoEnabled(true); // Camera on

// Check current state
const isAudioOn = mediaManager.isAudioEnabled();
const isVideoOn = mediaManager.isVideoEnabled();
```

### Data Channels

```typescript
// Send data to peer
peerManager.sendData("peer-id", {
  type: "chat",
  message: "Hello!",
});

// Receive data from peer
peerManager.on("data-channel-message", (peerId, data) => {
  console.log(`Message from ${peerId}:`, data);
});
```

### Connection Statistics

```typescript
// Get real-time connection stats
const stats = await peerManager.getStats("peer-id");

console.log("Bytes sent:", stats.bytesSent);
console.log("Bytes received:", stats.bytesReceived);
console.log("Packets lost:", stats.packetsLost);
console.log("Round trip time:", stats.roundTripTime);
console.log("Available bandwidth:", stats.availableBandwidth);
```

### Event Handling

```typescript
// ICE candidate generated
peerManager.on("ice-candidate", (peerId, candidate) => {
  // Send candidate to remote peer via signaling
});

// Connection state changed
peerManager.on("connection-state-change", (peerId, state) => {
  console.log(`Peer ${peerId} connection state:`, state);
});

// ICE connection state changed
peerManager.on("ice-connection-state-change", (peerId, state) => {
  console.log(`Peer ${peerId} ICE state:`, state);
});

// Remote track received
peerManager.on("track", (peerId, track, stream) => {
  console.log(`Received ${track.kind} track from ${peerId}`);
});

// Data channel opened
peerManager.on("data-channel-open", (peerId) => {
  console.log(`Data channel opened with ${peerId}`);
});

// Data channel closed
peerManager.on("data-channel-close", (peerId) => {
  console.log(`Data channel closed with ${peerId}`);
});
```

### Multi-Peer Connections

```typescript
// Create connections to multiple peers
const peer1 = peerManager.createPeerConnection("peer-1", localStream);
const peer2 = peerManager.createPeerConnection("peer-2", localStream);
const peer3 = peerManager.createPeerConnection("peer-3", localStream);

// Get all connected peer IDs
const peerIds = peerManager.getPeerIds();
console.log("Connected peers:", peerIds);

// Close specific peer connection
peerManager.closePeerConnection("peer-1");

// Close all connections
peerManager.closeAll();
```

### Cleanup

```typescript
// Stop all media streams
mediaManager.stopAll();

// Close all peer connections
peerManager.closeAll();
```

## API Documentation

### MediaStreamManager

#### Methods

- `getUserMedia(options)` - Get user media (camera/microphone)
- `getDisplayMedia(options)` - Get display media (screen share)
- `getDevices()` - List available media devices
- `setAudioEnabled(enabled)` - Mute/unmute audio
- `setVideoEnabled(enabled)` - Enable/disable video
- `getLocalStream()` - Get current local stream
- `getScreenStream()` - Get current screen share stream
- `stopLocalStream()` - Stop local media
- `stopScreenShare()` - Stop screen sharing
- `stopAll()` - Stop all streams
- `isAudioEnabled()` - Check if audio is enabled
- `isVideoEnabled()` - Check if video is enabled
- `isScreenSharing()` - Check if screen sharing

### PeerConnectionManager

#### Constructor

```typescript
new PeerConnectionManager(config: PeerConnectionConfig)
```

#### Methods

- `createPeerConnection(peerId, localStream?, createDataChannel?)` - Create new peer connection
- `createOffer(peerId, options?)` - Create SDP offer
- `createAnswer(peerId, options?)` - Create SDP answer
- `setRemoteDescription(peerId, description)` - Set remote SDP
- `addIceCandidate(peerId, candidate)` - Add ICE candidate
- `sendData(peerId, data)` - Send data via data channel
- `getStats(peerId)` - Get connection statistics
- `replaceTrack(peerId, oldTrack, newTrack)` - Replace track in peer connection
- `replaceVideoTrackForAll(newTrack)` - Replace video track in all connections
- `getSenders(peerId)` - Get RTP senders
- `getReceivers(peerId)` - Get RTP receivers
- `closePeerConnection(peerId)` - Close specific connection
- `closeAll()` - Close all connections
- `getPeerConnection(peerId)` - Get RTCPeerConnection instance
- `getPeerIds()` - Get all peer IDs
- `hasPeer(peerId)` - Check if peer exists

#### Events

- `ice-candidate` - ICE candidate generated
- `connection-state-change` - Connection state changed
- `ice-connection-state-change` - ICE connection state changed
- `track` - Remote track received
- `data-channel-message` - Data received
- `data-channel-open` - Data channel opened
- `data-channel-close` - Data channel closed

### ScreenShareManager

High-level screen sharing coordinator that simplifies screen sharing across all peer connections.

#### Constructor

```typescript
new ScreenShareManager(mediaManager: MediaStreamManager, peerManager: PeerConnectionManager)
```

#### Methods

- `startScreenShare(options?)` - Start screen sharing and replace tracks in all peers
- `stopScreenShare()` - Stop screen sharing and restore original tracks
- `toggleScreenShare(options?)` - Toggle screen sharing on/off
- `isScreenSharing()` - Check if currently screen sharing
- `getScreenStream()` - Get current screen share stream
- `getState()` - Get complete screen share state

## Error Handling

The library uses specific error types for different failure scenarios:

- `MediaDeviceError` - Media device access failures
- `PeerConnectionError` - Peer connection failures
- `SignalingError` - Signaling failures
- `StreamError` - Stream handling failures
- `NotImplementedError` - Features not yet implemented

```typescript
try {
  const stream = await mediaManager.getUserMedia();
} catch (error) {
  if (error instanceof MediaDeviceError) {
    console.error("Media device error:", error.code, error.message);
  }
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  MediaStreamOptions,
  PeerConnectionConfig,
  CallState,
  ConnectionStats,
  IceCandidate,
  SessionDescription,
} from "@opensky/skymeet";
```

## Testing

The package includes comprehensive tests with 95%+ coverage:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Performance

- **Lightweight**: Small bundle size with no unnecessary dependencies
- **Efficient**: Optimized for performance and low latency
- **Scalable**: Supports multiple simultaneous peer connections

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Any browser with WebRTC support

## License

AGPL-3.0 - See LICENSE file for details

## Contributing

Part of the OpenSky Suite monorepo. See main repository for contribution guidelines.

## Links

- [OpenSky Suite](https://github.com/opensky-suite/monorepo)
- [Issue Tracker](https://github.com/opensky-suite/monorepo/issues)
- [Documentation](https://docs.opensky.dev)
