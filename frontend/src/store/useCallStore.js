import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useCallStore = create((set, get) => ({
  incomingCall: null,
  callAccepted: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  ringtone: null,
  callId: null,            // ✅ TRACK CALL ID
  callStatus: "idle",      // ✅ idle | calling | incoming | inCall

  // ================= 🔔 RINGTONE =================
  playRingtone: () => {
    const audio = new Audio("/ringtone.mp3");
    audio.loop = true;
    audio.play().catch(() => {});
    set({ ringtone: audio });
  },

  stopRingtone: () => {
    const { ringtone } = get();
    ringtone?.pause();
    if (ringtone) ringtone.currentTime = 0;
    set({ ringtone: null });
  },

  // ================= 📞 START CALL =================
  startCall: async (receiverId, type = "audio") => {
    const socket = useAuthStore.getState().socket;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });

    const peer = new RTCPeerConnection(ICE_SERVERS);
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (e) => set({ remoteStream: e.streams[0] });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("iceCandidate", { to: receiverId, candidate: e.candidate });
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("callUser", { to: receiverId, offer, type });

    set({
      peerConnection: peer,
      localStream: stream,
      callAccepted: false,
      callStatus: "calling",    // ✅ CALLING MODE
    });
  },

  // ================= ☎️ RECEIVE CALL =================
  receiveCall: async (from, offer, type, callId) => {
    const socket = useAuthStore.getState().socket;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });

    const peer = new RTCPeerConnection(ICE_SERVERS);
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (e) => set({ remoteStream: e.streams[0] });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("iceCandidate", { to: from, candidate: e.candidate });
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));

    get().playRingtone();

    set({
      incomingCall: { from, type },
      callId,
      localStream: stream,
      peerConnection: peer,
      callAccepted: false,
      callStatus: "incoming",   // ✅ INCOMING MODE
    });
  },

  // ================= ✅ ACCEPT CALL =================
  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const { peerConnection, incomingCall, callId } = get();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answerCall", {
      to: incomingCall.from,
      answer,
      callId,            // ✅ SEND CALL ID
    });

    get().stopRingtone();

    set({
      callAccepted: true,
      incomingCall: null,
      callStatus: "inCall",     // ✅ SWITCH TO IN CALL
    });
  },

  // ================= ✅ ANSWER RECEIVED (CALLER SIDE FIX) =================
  handleAnswer: async (answer, callId) => {
    const { peerConnection } = get();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    set({
      callAccepted: true,
      callId,
      callStatus: "inCall",     // ✅ FIXED ✅
    });
  },

  // ================= ICE =================
  addIceCandidate: async (candidate) => {
    const { peerConnection } = get();
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  },

  // ================= ❌ END CALL =================
  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { peerConnection, localStream, ringtone, incomingCall, callId } = get();

    ringtone?.pause();
    if (ringtone) ringtone.currentTime = 0;

    localStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();

    if (incomingCall?.from || callId) {
      socket.emit("endCall", {
        to: incomingCall?.from,
        callId,                  // ✅ SAVE HISTORY
      });
    }

    set({
      incomingCall: null,
      callAccepted: false,
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      ringtone: null,
      callId: null,
      callStatus: "idle",       // ✅ RESET
    });
  },
}));
