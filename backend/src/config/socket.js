import { Server } from "socket.io";
import logger from "./logger.js";
import { registerSocketHandlers } from "../routes/api/v1/socket.js";
import { isAllowedOrigin } from "./origins.js";

let io = null;

export const initSocket = (server) => {
  if (io) {
    logger.warn("Socket.IO server is already initialized.");
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS blocked socket connection"), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    socket.on("join_room", (room) => {
      socket.join(room);
      logger.info(`Socket client ${socket.id} joined room: ${room}`);
    });

    // Register our new session abortion event listeners
    registerSocketHandlers(io, socket);

    socket.on("disconnect", () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    logger.error(
      "Socket.IO server requested but has not been initialized yet!",
    );
  }
  return io;
};
