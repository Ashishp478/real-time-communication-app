import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Camera, Mic, Check } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);        // ✅ MANDATORY
  const audioStreamRef = useRef(null);

  const { sendMessage } = useChatStore();

  // ✅ IMAGE SELECT
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Select a valid image");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ✅ CAMERA
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsCameraOpen(true);
    } catch {
      toast.error("Camera permission denied");
    }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d").drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/png");
    setImagePreview(image);

    video.srcObject.getTracks().forEach((t) => t.stop());
    setIsCameraOpen(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ START RECORD
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      audioChunks.current = [];

      // ✅ IMPORTANT: attach listener BEFORE stopping
      recorder.ondataavailable = (e) => {
        if (e.data.size) audioChunks.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);

    } catch (err) {
      console.error(err);
      toast.error("Mic permission denied");
    }
  };

  // ✅ STOP RECORD
  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    setIsRecording(false);

    recorder.onstop = async () => {

      const blob = new Blob(audioChunks.current, { type: "audio/webm" });

      if (!blob.size) {
        toast.error("No voice detected");
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        try {
          await sendMessage({ audio: reader.result });
        } catch {
          toast.error("Voice send failed");
        }
      };

      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  };

  // ✅ SEND MESSAGE
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() && !imagePreview) {
      toast.error("Type or send something");
      return;
    }

    try {
      await sendMessage({ text: text.trim(), image: imagePreview });
      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error("Send failed");
    }
  };

  return (
    <div className="p-3 border-t bg-white">

      {/* CAMERA UI */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-black rounded-xl p-4">
            <video ref={videoRef} className="rounded-lg w-72 h-60" />
            <canvas ref={canvasRef} hidden />
            <button onClick={capturePhoto} className="btn btn-success w-full mt-3">
              <Check /> Capture
            </button>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="mb-2">
          <div className="relative inline-block">
            <img src={imagePreview} className="w-20 h-20 rounded-lg border" />
            <button onClick={removeImage} className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">

        <button type="button" onClick={openCamera} className="btn btn-circle btn-sm">
          <Camera size={18} />
        </button>

        <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleImageChange} />
        <button type="button" onClick={() => fileInputRef.current.click()} className="btn btn-circle btn-sm">
          <Image size={18} />
        </button>

        <input
          type="text"
          className="flex-1 input input-bordered rounded-full"
          placeholder="Type message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* HOLD TO RECORD */}
        <button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`btn btn-circle btn-sm ${isRecording ? "bg-red-500 text-white animate-pulse" : ""}`}
        >
          <Mic size={18} />
        </button>

        <button type="submit" className="btn btn-circle btn-sm btn-primary" disabled={!text.trim() && !imagePreview}>
          <Send size={18} />
        </button>

      </form>
    </div>
  );
};

export default MessageInput;
