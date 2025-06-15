const socket = io("http://localhost:3000");

// ✅ URL에서 이름 정보 가져오기
const params = new URLSearchParams(window.location.search);
const myName = params.get("me") || "나";
const otherName = params.get("with") || "상대";

// ✅ 고정된 방 이름 (정렬해서 일관성 있게 유지)
const room = [myName, otherName].sort().join("_");

// ✅ 방 입장
socket.emit("join_room", room);

// ✅ 채팅방 제목 출력
document.getElementById("chatTitle").innerText = `${otherName} 님과의 채팅방`;

// ✅ 메시지 전송
function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (message === "") return;

  // 서버에 메시지 전송
  socket.emit("chat_message", {
    room,
    name: myName,
    message
  });

  // 내 화면에 바로 출력
  appendMessage(`나: ${message}`);
  input.value = "";
}

// ✅ 메시지 수신 처리
socket.on("chat_message", ({ name, message }) => {
  if (name !== myName) {
    appendMessage(`${name}: ${message}`);
  }
});

// ✅ 메시지 출력 함수
function appendMessage(msg) {
  const chatBox = document.getElementById("chatBox");
  const div = document.createElement("div");

  // 메시지가 '나:'로 시작하면 내 메시지, 아니면 상대 메시지로 구분
  const isMine = msg.startsWith("나:");
  div.className = `chat-message ${isMine ? "me" : "other"}`;
  div.textContent = msg;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
