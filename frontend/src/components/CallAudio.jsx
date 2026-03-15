import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";

const CallAudio = () => {
  const { remoteStream } = useCallStore();
  const audioRef = useRef();

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  return <audio ref={audioRef} autoPlay />;
};

export default CallAudio;
