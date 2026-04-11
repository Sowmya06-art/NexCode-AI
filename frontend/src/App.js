import React, { useState, useEffect, useRef } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import io from "socket.io-client";
import axios from "axios";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  materialDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Sun,
  Moon,
  Play,
  Cpu,
  Video,
  Copy,
  X,
  Terminal as TerminalIcon,
  Check,
  Download,
  Sparkles,
  Users,
  Lock,
  Unlock,
  Plus,
  Edit3,
  Trash2,
} from "lucide-react";

// CodeMirror CSS & Modes
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/theme/neo.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";

const socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:5000");

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [roomUsers, setRoomUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [language, setLanguage] = useState("");
  const [explanation, setExplanation] = useState("");
  const [output, setOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeFileName, setActiveFileName] = useState("main.js");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const editorRef = useRef(null);
  const outputRef = useRef(null);
  const [files, setFiles] = useState([
    {
      name: "main.js",
      content: "// Welcome to NexCode",
      language: "javascript",
    },
  ]);

  // 1. Update handleCreateFile
  const handleCreateFile = () => {
    const name = prompt("File name (e.g. index.py):");
    if (name) {
      const newLang = detectLanguage(name);
      const newFile = { name, content: "", language: newLang };
      const updatedFiles = [...files, newFile];

      setFiles(updatedFiles);
      setActiveFileName(name);
      setLanguage(newLang);

      // SYNC: Tell others a file was created
      socket.emit("file-structure-update", { roomId, files: updatedFiles });
    }
  };

  // 2. Update handleDeleteFile
  const handleDeleteFile = (fileName) => {
    if (files.length === 1) return alert("You must have at least one file.");
    if (window.confirm(`Delete ${fileName}?`)) {
      const updatedFiles = files.filter((f) => f.name !== fileName);
      setFiles(updatedFiles);
      if (activeFileName === fileName) {
        setActiveFileName(updatedFiles[0].name);
      }

      // SYNC: Tell others a file was deleted
      socket.emit("file-structure-update", { roomId, files: updatedFiles });
    }
  };

  // 3. Update handleRenameFile
  const handleRenameFile = (oldName) => {
    const newName = prompt("Enter new file name:", oldName);
    if (newName && newName !== oldName) {
      const updatedFiles = files.map((f) =>
        f.name === oldName
          ? { ...f, name: newName, language: detectLanguage(newName) }
          : f,
      );
      setFiles(updatedFiles);
      setActiveFileName(newName);

      // SYNC: Tell others a file was renamed
      socket.emit("file-structure-update", { roomId, files: updatedFiles });
    }
  };

  // 3. Save / Save As (Local Download)
  const handleSaveAs = (file) => {
    const element = document.createElement("a");
    const blob = new Blob([file.content], { type: "text/plain" });
    element.href = URL.createObjectURL(blob);
    element.download = file.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const detectLanguage = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    const map = {
      js: "javascript",
      py: "python",
      java: "text/x-java",
      cpp: "text/x-c++src",
      c: "text/x-csrc",
      ts: "text/typescript",
      rs: "text/x-rustsrc",
      go: "text/x-go",
      cs: "text/x-csharp", // Ensure C# is included
    };
    return map[ext] || "javascript";
  };

  const colors = {
    bg: isDarkMode ? "#09090b" : "#f8fafc",
    surface: isDarkMode ? "#121217" : "#ffffff",
    header: isDarkMode ? "rgba(18, 18, 23, 0.8)" : "rgba(255, 255, 255, 0.85)",
    text: isDarkMode ? "#fafafa" : "#0f172a",
    subtext: isDarkMode ? "#a1a1aa" : "#64748b",
    border: isDarkMode ? "#27272a" : "#e2e8f0",
    accent: "#10b981",
    aiPrimary: "#6366f1",
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    socket.on("file-structure-update", (newFiles) => {
      setFiles(newFiles);
    });

    socket.on("code-update", ({ code, fileName }) => {
      // 1. Update the background files array immediately
      setFiles((prev) =>
        prev.map((f) => (f.name === fileName ? { ...f, content: code } : f)),
      );

      // 2. ONLY update the editor if this code update is for the file I am LOOKING at
      if (
        activeFileName === fileName &&
        editorRef.current &&
        code !== editorRef.current.getValue()
      ) {
        const cursor = editorRef.current.getCursor();
        editorRef.current.setValue(code);
        editorRef.current.setCursor(cursor);
      }
    });

    socket.on("language-update", (newLang) => {
      setLanguage(newLang);
      if (editorRef.current) editorRef.current.setOption("mode", newLang);
    });

    return () => {
      socket.off("file-structure-update");
      socket.off("code-update");
      socket.off("language-update");
    };
    // FIX: Add activeFileName to this dependency array!
  }, [roomId, activeFileName]);

  useEffect(() => {
    socket.on("user-list-update", (users) => {
      setRoomUsers(users);
    });
    return () => socket.off("user-list-update");
  }, []);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    socket.emit("language-change", { roomId, language: newLang });
  };

  const handleDownload = () => {
    // Guard clause: If no language is selected, don't download
    if (!language) {
      alert(
        "Please select a programming language before downloading your code.",
      );
      return;
    }

    const extensions = {
      "text/x-csrc": "c",
      javascript: "js",
      python: "py",
      "text/x-java": "java",
      "text/x-c++src": "cpp",
      "text/typescript": "ts",
      "text/x-rustsrc": "rs",
      "text/x-go": "go",
      "text/x-csharp": "cs",
      "text/x-php": "php",
      "text/x-swift": "swift",
    };

    const ext = extensions[language] || "txt";
    const element = document.createElement("a");
    const file = new Blob([editorRef.current.getValue()], {
      type: "text/plain",
    });

    element.href = URL.createObjectURL(file);
    element.download = `nexcode_${roomId}.${ext}`;

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element); // Cleanup
  };

  const handleCreate = async () => {
    if (!username) {
      alert("⚠️ Please enter your username first.");
      return;
    }

    if (!password) {
      alert("🔒 You must set a password to secure this workspace.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5000"}/api/rooms/create`,
        { password },
      );
      const id = response.data.roomId;
      setRoomId(id);
      setJoined(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      socket.emit("join-room", { roomId: id, username });
    } catch (err) {
      alert("❌ Connectivity issue. Room could not be created.");
    }
  };

  const handleJoin = async () => {
    if (!roomId || !username || !password) {
      alert("⚠️ Please fill in all fields (ID, Username, and Password).");
      return;
    }

    setIsJoining(true); // Start loading

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5000"}/api/rooms/join`,
        { roomId, username, password },
      );

      // Successful Join logic
      setJoined(true);
      if (response.data.language) setLanguage(response.data.language);
      socket.emit("join-room", { roomId, username });

      // Trigger the toast AFTER joining
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      if (err.response?.status === 401) {
        alert("❌ Incorrect Password. Please check with your team.");
      } else if (err.response?.status === 404) {
        alert("🔍 Room ID not found. Please verify the ID.");
      } else {
        alert("📡 Server error. Please try again later.");
      }
    } finally {
      // Always stop the loading state, whether success or error
      setIsJoining(false);
    }
  };

  const handleRunCode = async () => {
    // 1. Find the actual file object for the file currently on screen
    const activeFile = files.find((f) => f.name === activeFileName);

    if (!activeFile || !activeFile.content) {
      setOutput("⚠️ The current file is empty or not found.");
      return;
    }

    setOutput("🚀 NexCode is compiling " + activeFile.name + "...");

    // 2. Map your CodeMirror modes to the Piston API language IDs
    const langMap = {
      "text/x-csrc": "c",
      python: "python",
      javascript: "javascript",
      "text/x-java": "java",
      "text/x-c++src": "cpp",
      "text/typescript": "typescript",
      "text/x-rustsrc": "rust",
      "text/x-go": "go",
      "text/x-csharp": "csharp",
    };

    // Detect the language based on the active file name
    const currentLang = langMap[detectLanguage(activeFile.name)];

    try {
      const response = await axios.post(
        "https://emkc.org/api/v2/piston/execute",
        {
          language: currentLang,
          version: "*", // Uses the latest stable version
          files: [{ content: activeFile.content }],
          stdin: stdin, // Includes any user input from your terminal textarea
        },
      );

      // 3. Display output or errors in your terminal area
      setOutput(
        response.data.run.output ||
          response.data.run.stderr ||
          "✅ Execution finished with no output.",
      );
    } catch (error) {
      console.error(
        "Piston API Error:",
        error.response ? error.response.data : error.message,
      );
      setOutput(
        "❌ Compiler Error: " +
          (error.response?.data?.message || "Check Console"),
      );
    }
  };

  const handleAIExplain = async () => {
    // 1. Get the code from the currently active file in your state
    const activeFile = files.find((f) => f.name === activeFileName);
    const codeToExplain = activeFile ? activeFile.content : "";

    if (!codeToExplain || codeToExplain.trim() === "") {
      setExplanation("### ⚠️ Please write some code first!");
      return;
    }

    setLoading(true);
    setExplanation("### 🤖 NexAI is reading your code...");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5000"}/api/ai/explain`,
        {
          // 2. Send the content of the specific active file
          code: codeToExplain,
          language: language || detectLanguage(activeFileName),
        },
      );
      setExplanation(response.data.explanation);
    } catch (error) {
      console.error("AI Error:", error);
      setExplanation(
        "### 🚦 AI offline. Make sure your backend server is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const myMeeting = async (element) => {
    if (!element || !roomId) return;
    const appID = 1535846009;
    const serverSecret = "b53e9592639c26f7bdd576c43786a344";
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomId,
      Date.now().toString(),
      "User-" + Math.floor(Math.random() * 100),
    );
    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zp.joinRoom({
      container: element,
      scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
      showScreenSharingButton: true,
    });
  };

  if (!joined) {
    return (
      <>
        <style>
          {`
  @keyframes pulse {
    0% { transform: scale(1); filter: drop-shadow(0 0 0px #10b981); }
    50% { transform: scale(1.05); filter: drop-shadow(0 0 15px #10b981); }
    100% { transform: scale(1); filter: drop-shadow(0 0 0px #10b981); }
  }
  .pulsing-logo {
    animation: pulse 3s infinite ease-in-out;
  }
    input:focus {
    border-color: #10b981 !important;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
    transition: all 0.3s ease;
  }
`}
        </style>

        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle at top, #18181b 0%, #09090b 100%)`,
            color: colors.text,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div
            style={{
              width: "400px",
              padding: "48px",
              borderRadius: "32px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              textAlign: "center",
              boxShadow: isDarkMode
                ? "0 25px 50px -12px rgba(0,0,0,0.8)"
                : "0 20px 25px -5px rgba(0,0,0,0.05)",
            }}
          >
            <div
              className="pulsing-logo"
              style={{
                background: `linear-gradient(135deg, ${colors.accent}, #064e3b)`,
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Cpu size={32} />
            </div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "900",
                marginBottom: "8px",
                letterSpacing: "-1px",
              }}
            >
              NexCode AI
            </h1>
            <p
              style={{
                color: colors.subtext,
                fontSize: "15px",
                marginBottom: "32px",
              }}
            >
              Real-time collaboration for elite teams.
            </p>

            {/* 1. Name Input */}
            <div
              style={{
                position: "relative",
                width: "100%",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            >
              <Users
                size={18}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#666",
                }}
              />
              <input
                placeholder="Enter Your Name"
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 14px 14px 45px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  background: "#000",
                  color: colors.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* 2. Room ID Input */}
            <div
              style={{
                position: "relative",
                width: "100%",
                marginBottom: "16px",
              }}
            >
              <TerminalIcon
                size={18}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#666",
                }}
              />
              <input
                placeholder="Room ID"
                onChange={(e) => setRoomId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 14px 14px 45px", // Extra padding-left for the icon
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  background: "#000",
                  color: colors.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* 3. Password Input with Icon */}
            <div
              style={{
                position: "relative",
                width: "100%",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Room Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  paddingRight: "50px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  background: "#000",
                  color: colors.text,
                  outline: "none",
                  boxSizing: "border-box", // ADD THIS
                  display: "block",
                }}
              />
              <div
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showPassword ? (
                  <Unlock size={15} color={colors.accent} />
                ) : (
                  <Lock size={15} color="#666" />
                )}
              </div>
            </div>
            <button
              onClick={handleJoin}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: colors.accent,
                color: "white",
                border: "none",
                fontWeight: "700",
                cursor: "pointer",
                marginBottom: "16px",
                fontSize: "16px",
              }}
            >
              {isJoining ? "Connecting to AI..." : "Join Now"}
            </button>
            <button
              onClick={handleCreate}
              style={{
                width: "100%",
                background: "transparent",
                color: colors.subtext,
                border: `1px solid ${colors.border}`,
                padding: "12px",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              + New Workspace
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: colors.bg,
        color: colors.text,
        transition: "0.3s ease",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* WELCOME TOAST */}
      <div
        className={showToast ? "toast-animate" : ""} // Apply class based on state
        style={{
          position: "fixed",
          top: showToast ? "24px" : "-100px", // Backup position logic
          left: "50%",
          transform: "translateX(-50%)",
          background: colors.surface,
          border: `1px solid ${colors.accent}`,
          padding: "12px 24px",
          borderRadius: "16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          transition: "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)", // Smooth movement
        }}
      >
        <div
          style={{
            background: colors.accent,
            padding: "8px",
            borderRadius: "10px",
            color: "white",
          }}
        >
          <Sparkles size={18} />
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: "800",
              color: colors.text,
            }}
          >
            Welcome, {username}!
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: colors.subtext }}>
            Successfully connected to room: {roomId}
          </p>
        </div>
      </div>
      <style>{`
      @keyframes slideIn {
    0% { transform: translate(-50%, -100px); opacity: 0; }
    100% { transform: translate(-50%, 0); opacity: 1; }
  }

  .toast-animate {
    animation: slideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
        .CodeMirror { height: 100% !important; font-family: 'JetBrains Mono', monospace; font-size: 14px; padding: 10px; }
        .file-row .file-actions { 
    opacity: 0; 
    transition: opacity 0.2s ease; 
  }
  
  .file-row:hover .file-actions { 
    opacity: 1; 
  }

  .action-icon {
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .action-icon:hover {
    color: #10b981 !important; /* turns green on hover */
    transform: scale(1.2);
  }
        .cm-s-material { background: ${colors.surface} !important; }
        .cm-s-neo.CodeMirror { background: #ffffff !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${isDarkMode ? "#3f3f46" : "#cbd5e1"}; border-radius: 10px; }
        .terminal-scroll::-webkit-scrollbar { width: 6px; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: ${isDarkMode ? "#52525b" : "#cbd5e1"}; border-radius: 10px; }
        button { transition: 0.2s; }
        button:hover { transform: translateY(-1px); }
      `}</style>

      {/* HEADER */}
      <header
        style={{
          height: "64px",
          padding: "0 24px",
          background: colors.header,
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Cpu size={18} />
            </div>
            <span style={{ fontWeight: "900", fontSize: "1.25rem" }}>
              NexCode
            </span>
          </div>
          {/* RESTORED COPY BOX */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: isDarkMode ? "#18181b" : "#f1f5f9",
              padding: "6px 14px",
              borderRadius: "20px",
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
            }}
            onClick={() => {
              navigator.clipboard.writeText(roomId);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Users size={14} color={colors.subtext} />
            <span
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: copied ? colors.accent : colors.subtext,
              }}
            >
              {copied ? "Copied ID!" : roomId}
            </span>
            {copied ? (
              <Check size={13} color={colors.accent} />
            ) : (
              <Copy size={13} color={colors.subtext} style={{ opacity: 0.6 }} />
            )}
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                padding: "8px 12px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <Users size={18} color={colors.accent} />
              <span style={{ fontSize: "14px", fontWeight: "700" }}>
                {roomUsers.length}
              </span>
            </button>

            {showUserDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "50px",
                  right: 0,
                  width: "200px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                  zIndex: 1000,
                  padding: "8px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: colors.subtext,
                    padding: "8px",
                    margin: 0,
                  }}
                >
                  Active Now
                </p>
                {roomUsers.map((user, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px",
                      borderRadius: "8px",
                      background:
                        user === username
                          ? "rgba(16,185,129,0.1)"
                          : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: colors.accent,
                      }}
                    ></div>
                    <span style={{ fontSize: "14px" }}>
                      {user} {user === username && "(You)"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "10px",
              padding: "8px 12px",
              fontWeight: "700",
              outline: "none",
            }}
          >
            <option value="" disabled hidden>
              Select Programming Language
            </option>
            <option value="text/x-csrc">C</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="text/x-java">Java</option>
            <option value="text/x-c++src">C++</option>
            <option value="text/typescript">TypeScript</option>
            <option value="text/x-rustsrc">Rust</option>
            <option value="text/x-go">Go</option>
            <option value="text/x-csharp">C#</option>
          </select>
          <button
            onClick={handleDownload}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: isDarkMode ? "#fbbf24" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleRunCode}
            style={{
              background: colors.accent,
              color: "white",
              padding: "0 24px",
              height: "40px",
              borderRadius: "10px",
              fontWeight: "800",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Play size={14} fill="white" /> Run
          </button>

          <button
            onClick={() => setShowVideo(!showVideo)}
            style={{
              background: showVideo ? "#ef4444" : colors.surface,
              color: showVideo ? "white" : colors.text,
              padding: "0 12px",
              height: "40px",
              borderRadius: "10px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <Video size={18} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          padding: "16px",
          gap: "16px",
        }}
      >
        {/* WRAPPER FOR COLLAPSIBLE SIDEBAR */}
        <div style={{ display: "flex", height: "100%" }}>
          {/* STATIC ICON STRIP (Always Visible) */}
          <div
            style={{
              width: "60px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: isSidebarOpen ? "24px 0 0 24px" : "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 0",
              gap: "20px",
              zIndex: 2,
              transition: "0.3s ease",
            }}
          >
            <div
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                cursor: "pointer",
                color: isSidebarOpen ? colors.accent : colors.subtext,
              }}
            >
              <Copy size={24} />
            </div>
            <Plus
              size={24}
              style={{ cursor: "pointer", opacity: 0.5 }}
              onClick={handleCreateFile}
            />
          </div>

          {/* SLIDING EXPLORER PANEL (The Drawer) */}
          <aside
            style={{
              width: isSidebarOpen ? "200px" : "0px",
              opacity: isSidebarOpen ? 1 : 0,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderLeft: "none",
              borderRadius: "0 24px 24px 0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                padding: "16px",
                fontWeight: "800",
                fontSize: "12px",
                color: colors.subtext,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              EXPLORER
            </div>

            <div style={{ padding: "8px" }}>
              {files.map((file) => (
                <div
                  key={file.name}
                  className="file-row"
                  onClick={() => {
                    setActiveFileName(file.name);
                    setLanguage(detectLanguage(file.name));
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "4px",
                    background:
                      activeFileName === file.name
                        ? "rgba(16, 185, 129, 0.1)"
                        : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <TerminalIcon
                      size={14}
                      color={
                        activeFileName === file.name
                          ? colors.accent
                          : colors.subtext
                      }
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        color:
                          activeFileName === file.name
                            ? colors.accent
                            : colors.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight:
                          activeFileName === file.name ? "600" : "400",
                      }}
                    >
                      {file.name}
                    </span>
                  </div>

                  {/* ACTION ICONS (Hidden by default via CSS classes) */}
                  <div
                    className="file-actions"
                    style={{ display: "flex", gap: "6px" }}
                  >
                    <Download
                      className="action-icon"
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveAs(file);
                      }}
                      style={{ opacity: 0.6 }}
                    />
                    <Edit3
                      className="action-icon"
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameFile(file.name);
                      }}
                      style={{ opacity: 0.6 }}
                    />
                    <Trash2
                      className="action-icon"
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.name);
                      }}
                      style={{ color: "#ef4444", opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* EDITOR AREA */}
        <div
          style={{
            flex: explanation ? 2 : 3,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: colors.surface,
              borderRadius: "24px",
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
            }}
          >
            <CodeMirror
              value={
                files.find((f) => f.name === activeFileName)?.content || ""
              }
              options={{
                mode: detectLanguage(activeFileName),
                theme: isDarkMode ? "material" : "neo",
                lineNumbers: true,
                lineWrapping: true,
              }}
              editorDidMount={(editor) => {
                editorRef.current = editor;
              }}
              onChange={(editor, data, value) => {
                if (data.origin !== "setValue") {
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.name === activeFileName ? { ...f, content: value } : f,
                    ),
                  );
                  socket.emit("code-change", {
                    roomId,
                    code: value,
                    fileName: activeFileName,
                  });
                }
              }}
            />
          </div>

          {/* TERMINAL SECTION */}
          <div
            style={{
              height: "240px",
              background: isDarkMode ? "#000" : "#f1f5f9",
              borderRadius: "24px",
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "12px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isDarkMode ? "#121217" : "#e2e8f0",
                flexShrink: 0,
              }}
            >
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <div style={{ display: "flex", gap: "6px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#ff5f56",
                    }}
                  />
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#ffbd2e",
                    }}
                  />
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#27c93f",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    marginLeft: "10px",
                    fontWeight: "900",
                    color: colors.subtext,
                  }}
                >
                  TERMINAL
                </span>
              </div>
              <button
                onClick={handleAIExplain}
                disabled={loading}
                style={{
                  background: colors.aiPrimary,
                  color: "white",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: "800",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {loading ? "Analyzing..." : "NexAI Explain"}
              </button>
            </div>

            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <textarea
                placeholder="Type input here..."
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  color: colors.accent,
                  border: "none",
                  padding: "18px",
                  outline: "none",
                  resize: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "13px",
                  borderRight: `1px solid ${colors.border}`,
                }}
              />
              <div
                ref={outputRef}
                className="terminal-scroll"
                style={{
                  flex: 1.5,
                  padding: "18px",
                  fontSize: "13px",
                  fontFamily: "'JetBrains Mono', monospace",
                  overflowY: "auto",
                  height: "100%",
                  color: colors.text,
                  whiteSpace: "pre-wrap",
                }}
              >
                {output || (
                  <span style={{ opacity: 0.2 }}>Awaiting execution...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI EXPLAIN PANEL */}
        {explanation && (
          <aside
            style={{
              flex: 1,
              background: colors.surface,
              borderRadius: "24px",
              border: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "800",
                  color: colors.aiPrimary,
                }}
              >
                NexAI Insight
              </h3>
              <X
                size={20}
                style={{ cursor: "pointer", opacity: 0.4 }}
                onClick={() => setExplanation("")}
              />
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={isDarkMode ? materialDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        style={{
                          background: isDarkMode ? "#27272a" : "#f1f5f0",
                          padding: "3px 8px",
                          borderRadius: "6px",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>
          </aside>
        )}
      </main>

      {showVideo && (
        <div
          ref={myMeeting}
          style={{
            width: "350px",
            height: "240px",
            position: "fixed",
            bottom: "32px",
            right: "32px",
            zIndex: 1000,
            borderRadius: "28px",
            overflow: "hidden",
            border: `4px solid ${colors.accent}`,
          }}
        />
      )}
    </div>
  );
}

export default App;
