const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// ✅ 루트 주소 접근 시 login.html 반환
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
// ✅ public 폴더 내부의 정적 파일을 서빙
app.use(express.static(path.join(__dirname, "public")));
  
// ✅ 사용자 정보 저장용 객체
const users = {};             // socket.id -> 사용자 프로필
const nameToSocketId = {};    // name -> socket.id

// ✅ 소켓 연결 처리
io.on("connection", (socket) => {
  console.log("🔌 연결됨:", socket.id);

  // 🔹 사용자 등록
  socket.on("register", (profile) => {
    const isGroup = profile.isGroup === true;
    const groupMembers = isGroup && Array.isArray(profile.groupMembers)
      ? profile.groupMembers.slice(0, 3)
      : [];

    users[socket.id] = {
      ...profile,
      isGroup,
      groupMembers,
      socketId: socket.id,
      matched: new Set(),
      rejected: new Set()
    };

    nameToSocketId[profile.name] = socket.id;
    console.log("✅ 프로필 등록됨:", users[socket.id]);
    sendFilteredProfiles();
  });

  // 🔹 매칭 요청
  socket.on("send_match", (targetSocketId) => {
    const sender = users[socket.id];
    const receiver = users[targetSocketId];
    if (!sender || !receiver) return;
    if (sender.isGroup !== receiver.isGroup) return;
    if (sender.matched.has(targetSocketId) || sender.rejected.has(targetSocketId)) return;

    io.to(targetSocketId).emit("receive_match", {
      from: sender,
      fromId: socket.id
    });

    console.log(`📨 ${sender.name} → ${receiver.name} 매칭 요청 전송됨`);
  });

  // 🔹 매칭 수락
  socket.on("accept_match", (targetId) => {
    const me = users[socket.id];
    const target = users[targetId];
    if (!me || !target) return;

    me.matched.add(targetId);
    target.matched.add(socket.id);

    // 채팅용 정보 저장
    io.to(targetId).emit("match_result", {
      status: "수락",
      fromId: socket.id,
      name: me.name
    });

    io.to(socket.id).emit("match_result", {
      status: "수락",
      fromId: targetId,
      name: target.name
    });

    console.log(`🤝 매칭 완료: ${me.name} ↔ ${target.name}`);
    sendFilteredProfiles();
  });

  // 🔹 매칭 거절
  socket.on("decline_match", (targetId) => {
    const me = users[socket.id];
    const target = users[targetId];
    if (!me || !target) return;

    me.rejected.add(targetId);
    target.rejected.add(socket.id);

    io.to(targetId).emit("match_result", {
      status: "거절"
    });

    console.log(`🚫 매칭 거절: ${me.name} ↔ ${target.name}`);
    sendFilteredProfiles();
  });

  // 🔹 채팅: 방 참가
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    console.log(`🟢 ${socket.id} 방 입장: ${roomName}`);
  });

  // 🔹 채팅: 메시지 송수신
  socket.on("chat_message", ({ room, name, message }) => {
    console.log(`💬 ${name} → ${room}: ${message}`);
    io.to(room).emit("chat_message", { name, message });
  });

  // 🔹 연결 해제
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user && user.name) {
      delete nameToSocketId[user.name];
    }
    delete users[socket.id];
    console.log("❌ 연결 해제됨:", socket.id);
    sendFilteredProfiles();
  });

  // 🔹 사용자 목록 전송 함수
  function sendFilteredProfiles() {
    Object.keys(users).forEach((id) => {
      const me = users[id];
      const filtered = Object.values(users).filter((other) => {
        return (
          other.socketId !== id &&
          other.isGroup === me.isGroup &&
          !me.matched.has(other.socketId) &&
          !me.rejected.has(other.socketId)
        );
      });
      io.to(id).emit("update_profiles", filtered);
    });
  }
});

// ✅ 서버 실행
server.listen(3000, () => {
  console.log("🚀 서버 실행 중: http://localhost:3000");
});
