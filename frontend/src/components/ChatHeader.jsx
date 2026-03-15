import { X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const ChatHeader = ({ isTyping }) => {
  const { onlineUsers } = useAuthStore();
  const { selectedUser, setSelectedUser } = useChatStore();

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);

  return (
    <div className="flex justify-between items-center px-4 py-2 border-b bg-white shadow-sm">

      {/* USER INFO */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <img
            src={selectedUser.profilePic || "/avatar.png"}
            className="w-10 h-10 rounded-full object-cover"
            alt=""
          />

          {/* ONLINE DOT */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white 
              ${isOnline ? "bg-green-500" : "bg-gray-400"}`}
          />
        </div>

        <div className="leading-tight">
          <p className="font-semibold">{selectedUser.fullName}</p>
          <p className="text-xs text-gray-500">
            {isTyping ? "Typing..." : isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* CLOSE BUTTON */}
      <X
        size={18}
        className="cursor-pointer hover:text-red-500"
        onClick={() => setSelectedUser(null)}
      />
    </div>
  );
};

export default ChatHeader;
