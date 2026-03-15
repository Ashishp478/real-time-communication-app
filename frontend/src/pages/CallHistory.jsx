import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios";
import { Phone, Video } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const CallHistory = () => {
  const [calls, setCalls] = useState([]);
  const [filter, setFilter] = useState("all");
  const { authUser } = useAuthStore();

  useEffect(() => {
    axiosInstance.get("/calls").then((res) => {
      console.log("CALLS:", res.data);
      setCalls(res.data);
    });
  }, []);

  const filteredCalls = calls.filter((call) => {
    if (filter === "missed") return call.status === "missed";
    if (filter === "answered") return call.status === "answered";
    if (filter === "outgoing")
      return call?.caller?._id === authUser?._id;
    return true;
  });

  const formatDuration = (sec) => {
    if (!sec) return "0s";
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return min ? `${min}m ${s}s` : `${s}s`;
  };

  return (
    <div className="p-4 max-w-xl mx-auto mt-20">
      <h2 className="font-bold text-lg mb-3">📞 Call History</h2>

      {/* FILTER BUTTONS */}
      <div className="flex gap-2 mb-4">
        {["all", "missed", "answered", "outgoing"].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`btn btn-xs ${
              filter === type ? "btn-primary" : "btn-outline"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {!filteredCalls.length && (
        <p className="text-center text-gray-400">
          No call history found
        </p>
      )}

      {filteredCalls.map((call) => {
        const isOutgoing = call?.caller?._id === authUser?._id;
        const user = isOutgoing ? call?.receiver : call?.caller;

        if (!user) return null;

        return (
          <div
            key={call._id}
            className="flex items-center gap-3 bg-white p-3 rounded shadow mb-2"
          >
            <img
              src={user.profilePic || "/avatar.png"}
              className="w-10 h-10 rounded-full object-cover"
            />

            <div className="flex-grow">
              <p className="font-semibold">{user.fullName}</p>

              <p
                className={`text-xs ${
                  call.status === "missed"
                    ? "text-red-500"
                    : "text-gray-500"
                }`}
              >
                {call.type.toUpperCase()} • {call.status}
                {call.duration > 0 && ` • ${formatDuration(call.duration)}`}
                {" • "}
                {isOutgoing ? "Outgoing" : "Incoming"}
              </p>

              <p className="text-xs text-gray-400">
                {new Date(call.startedAt).toLocaleString()}
              </p>
            </div>

            {call.type === "audio" ? (
              <Phone className="text-green-500 cursor-pointer" />
            ) : (
              <Video className="text-blue-500 cursor-pointer" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CallHistory;
