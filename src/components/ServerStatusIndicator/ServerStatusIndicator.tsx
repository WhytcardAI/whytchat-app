import { useState } from "react";
import { useServer } from "../../contexts/ServerContext";
import { ServerDebugModal } from "./ServerDebugModal";

export function ServerStatusIndicator() {
  const { status, error } = useServer();

  const getStatusConfig = () => {
    switch (status) {
      case "ready":
        return {
          color: "bg-green-500",
          title: "AI Server Ready",
          animate: "",
        };
      case "checking":
        return {
          color: "bg-blue-500",
          title: "Checking server...",
          animate: "animate-pulse",
        };
      case "starting":
        return {
          color: "bg-green-400", // Vert plus clair pour démarrage
          title: "Starting AI Server...",
          animate: "animate-pulse",
        };
      case "error":
        return {
          color: "bg-red-500",
          title: error || "Server Error",
          animate: "",
        };
      case "stopped":
        return {
          color: "bg-gray-400",
          title: "Server Stopped - Click to Start",
          animate: "",
        };
      default:
        return { color: "bg-gray-400", title: "Unknown", animate: "" };
    }
  };

  const [open, setOpen] = useState(false);
  const handleStatusClick = () => setOpen(true);

  const config = getStatusConfig();

  const content = (
    <div
      className={`w-3 h-3 ${config.color} rounded-full ${config.animate} cursor-pointer`}
      title={config.title}
      onClick={handleStatusClick}
    />
  );

  return (
    <>
      {content}
      {open && <ServerDebugModal onClose={() => setOpen(false)} />}
    </>
  );
}
