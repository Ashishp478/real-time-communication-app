import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime } from "../lib/utils";
import {
  PhoneOff,
  PhoneIncoming,
  Video,
  Phone,
  Mic,
  MicOff,
  VideoOff,
  MonitorUp,
  Check, CheckCheck ,
} from "lucide-react";

/* ---------------- ICE SERVERS ---------------- */
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

/* ---------------- CHAT CONTAINER ---------------- */
const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();

  const { authUser, socket , onlineUsers} = useAuthStore();

  const [isTyping, setIsTyping] = useState(false);

  const messageEndRef = useRef(null);

  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const peerConnection = useRef(null);
  const ringtoneRef = useRef(new Audio("/ringtone.mp3"));
  const pendingCandidates = useRef([]);

  const currentCallId = useRef(null);

  const [callStatus, setCallStatus] = useState("idle");
  const [callType, setCallType] = useState("video");
  const [incomingCall, setIncomingCall] = useState(null);

  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  /* ---------------- CHAT LOAD ---------------- */
  useEffect(() => {
    if (!selectedUser?._id) return;

    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser?._id]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    if (callStatus !== "inCall" || !callStartTime) return;

    const id = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [callStatus, callStartTime]);

  const formatDuration = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  /* ---------------- FORCE STREAM ATTACH ---------------- */
  useEffect(() => {
    if (callStatus === "inCall") {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }

      if (remoteAudioRef.current && remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [callStatus]);

  /* ---------------- SOCKET EVENTS ---------------- */
  useEffect(() => {
    if (!socket) return;

    socket.on("typing", ({ from }) => {
      if (from === selectedUser?._id) setIsTyping(true);
    });

    socket.on("stopTyping", ({ from }) => {
      if (from === selectedUser?._id) setIsTyping(false);
    });

    socket.on("incomingCall", ({ from, offer, type, callId }) => {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(() => {});

      setCallType(type || "video");
      currentCallId.current = callId || null;
      setIncomingCall({ from, offer, type, callId });
      setCallStatus("incoming");
    });

    socket.on("callAnswered", async ({ answer, callId }) => {
      const peer = peerConnection.current;
      if (!peer) return;

      await peer.setRemoteDescription(new RTCSessionDescription(answer));

      for (const c of pendingCandidates.current) {
        await peer.addIceCandidate(new RTCIceCandidate(c));
      }
      pendingCandidates.current = [];

      if (callId) currentCallId.current = callId;

      setCallStartTime(Date.now());
      setCallDuration(0);
      setCallStatus("inCall");
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      const peer = peerConnection.current;
      if (!peer || !candidate) return;

      if (peer.remoteDescription) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidates.current.push(candidate);
      }
    });

    socket.on("callEnded", ({ callId }) => {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      if (callId) currentCallId.current = callId;
      endCall(false);
    });

    return () => {
      socket.off("incomingCall");
      socket.off("callAnswered");
      socket.off("iceCandidate");
      socket.off("callEnded");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, [socket, selectedUser?._id]);

  /* ---------------- MEDIA SETUP ---------------- */
  const setupStream = async (targetId, type) => {
    const media =
      type === "video"
        ? { audio: true, video: { facingMode: "user" } }
        : { audio: true, video: false };

    const stream = await navigator.mediaDevices.getUserMedia(media);
    localStreamRef.current = stream;

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true;
      localAudioRef.current.play().catch(() => {});
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.oniceconnectionstatechange = () =>
      console.log("ICE:", peer.iceConnectionState);

    peer.onconnectionstatechange = () =>
      console.log("STATE:", peer.connectionState);

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0];

      console.log("REMOTE TRACKS:", e.streams[0].getTracks());

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(console.error);
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("iceCandidate", {
          to: String(targetId),
          candidate: e.candidate,
        });
      }
    };

    peerConnection.current = peer;
    return peer;
  };

  /* ---------------- START CALL ---------------- */
  const startCall = async (type) => {
    if (!selectedUser?._id) return;

    setCallType(type);
    setCallStatus("outgoing");
    currentCallId.current = null;

    const peer = await setupStream(String(selectedUser._id), type);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("callUser", {
      to: String(selectedUser._id),
      offer,
      type,
    });
  };

  /* ---------------- ACCEPT CALL ---------------- */
  const acceptCall = async () => {
    if (!incomingCall) return;

    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;

    const { from, offer, type, callId } = incomingCall;

    if (callId) currentCallId.current = callId;

    const peer = await setupStream(String(from), type || "video");

    await peer.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answerCall", {
      to: String(from),
      answer,
      callId: currentCallId.current,
    });

    setCallStartTime(Date.now());
    setCallDuration(0);
    setIncomingCall(null);
    setCallStatus("inCall");
  };

  /* ---------------- DECLINE CALL ---------------- */
  const declineCall = () => {
    if (incomingCall) {
      socket.emit("endCall", {
        to: String(incomingCall.from),
        callId: incomingCall.callId,
      });
    }

    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;

    setIncomingCall(null);
    setCallStatus("idle");
    currentCallId.current = null;
  };

  /* ---------------- TOGGLE MUTE ---------------- */
  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  /* ---------------- TOGGLE CAMERA ---------------- */
  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  };

  /* ---------------- SCREEN SHARE ---------------- */
  const startScreenShare = async () => {
    if (!peerConnection.current) return;

    if (!isScreenSharing) {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screen.getVideoTracks()[0];
      const sender = peerConnection.current
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(screenTrack);
        localVideoRef.current.srcObject = screen;
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          const cam = localStreamRef.current.getVideoTracks()[0];
          sender.replaceTrack(cam);
          localVideoRef.current.srcObject = localStreamRef.current;
          setIsScreenSharing(false);
        };
      }
    } else {
      const sender = peerConnection.current
        .getSenders()
        .find((s) => s.track?.kind === "video");

      const cam = localStreamRef.current.getVideoTracks()[0];
      await sender.replaceTrack(cam);
      localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  /* ---------------- END CALL ---------------- */
  const endCall = (emit = true) => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;

    if (emit && selectedUser?._id) {
      socket.emit("endCall", {
        to: String(selectedUser._id),
        callId: currentCallId.current,
      });
    }

    peerConnection.current?.getSenders().forEach((s) => s.track?.stop());
    peerConnection.current?.close();

    peerConnection.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    setCallStatus("idle");
    setCallDuration(0);
    setCallStartTime(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    currentCallId.current = null;
  };

  /* ---------------- UI ---------------- */

  if (callStatus === "outgoing") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p>{callType === "video" ? "Video Calling..." : "Voice Calling..."}</p>
        <h2 className="text-lg font-semibold">{selectedUser?.fullName}</h2>
        <button className="btn btn-error" onClick={() => endCall(true)}>
          <PhoneOff /> END
        </button>

        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
        <video ref={localVideoRef} autoPlay muted playsInline className="hidden" />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
      </div>
    );
  }

  if (callStatus === "incoming" && incomingCall) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <PhoneIncoming size={44} />
        <h2>
          Incoming {callType === "video" ? "Video Call" : "Voice Call"}
        </h2>
        <div className="flex gap-4">
          <button className="btn btn-success" onClick={acceptCall}>
            ACCEPT
          </button>
          <button className="btn btn-error" onClick={declineCall}>
            DECLINE
          </button>
        </div>

        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
        <video ref={localVideoRef} autoPlay muted playsInline className="hidden" />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
      </div>
    );
  }

  if (callStatus === "inCall") {
    if (callType === "audio") {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <h2>Voice Call with {selectedUser?.fullName}</h2>
          <p className="font-mono text-lg">{formatDuration(callDuration)}</p>
          <button className="btn btn-error" onClick={() => endCall(true)}>
            <PhoneOff /> END
          </button>

          <audio ref={localAudioRef} autoPlay muted />
          <audio ref={remoteAudioRef} autoPlay />
        </div>
      );
    }

    return (
      <div className="flex-1 bg-black relative">
        <video
          key="remote"
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
        />
        <video
          key="local"
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-4 right-4 w-40 h-28 border rounded-md"
        />

        <p className="absolute top-3 left-4 bg-black/60 px-3 py-1 rounded">
          {formatDuration(callDuration)}
        </p>

        <div className="absolute bottom-5 w-full flex justify-center gap-4">
          <button onClick={toggleMute} className="btn btn-neutral btn-sm">
            {isMuted ? <MicOff /> : <Mic />}
          </button>

          <button onClick={toggleCamera} className="btn btn-neutral btn-sm">
            {isCameraOff ? <VideoOff /> : <Video />}
          </button>

          <button onClick={startScreenShare} className="btn btn-neutral btn-sm">
            <MonitorUp />
          </button>

          <button onClick={() => endCall(true)} className="btn btn-error btn-sm">
            <PhoneOff />
          </button>
        </div>

        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    );
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <ChatHeader isTyping={isTyping} />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex justify-end p-2 border-b gap-2">
        <button className="btn btn-info btn-sm" onClick={() => startCall("audio")}>
          <Phone size={16} /> Voice
        </button>
        <button className="btn btn-success btn-sm" onClick={() => startCall("video")}>
          <Video size={16} /> Video
        </button>
      </div>

      <ChatHeader isTyping={isTyping} />

     <div className="flex-1 overflow-y-auto p-4 space-y-4">
  {messages.map((msg) => (
    <div
      key={msg._id}
      ref={messageEndRef}
      className={`chat ${
        msg.senderId === authUser._id ? "chat-end" : "chat-start"
      }`}
    >
      <div className="chat-bubble max-w-xs">
        {msg.image && (
          <img src={msg.image} className="rounded mb-2 max-w-[200px]" />
        )}

        {msg.audio && (
          <audio src={msg.audio} controls className="w-52" />
        )}

        <p>{msg.text}</p>

        {/* ✅ TIME + TICK */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <time className="text-xs opacity-50">
            {formatMessageTime(msg.createdAt)}
          </time>

         {String(msg.senderId) === String(authUser._id) && (
  msg.seen ? (
    <CheckCheck size={16} className="text-blue-500" />
  ) : onlineUsers.includes(msg.receiverId) ? (
    <CheckCheck size={16} className="text-gray-400" />
  ) : (
    <Check size={16} className="text-gray-400" />
  )
)}
        </div>
      </div>
    </div>
  ))}
</div>

<MessageInput />
    </div>
  );
};

export default ChatContainer;
