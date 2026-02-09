import React, { useState, useEffect, useRef } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import io from "socket.io-client";
import axios from "axios";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { 
  Sun, Moon, Play, Cpu, Video, Copy, X, 
  Terminal as TerminalIcon, Check, Download, Sparkles, Users 
} from "lucide-react";

// CodeMirror CSS & Modes
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/theme/neo.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";

const socket = io("http://localhost:5000");

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [language, setLanguage] = useState("javascript");
  const [explanation, setExplanation] = useState("");
  const [output, setOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef(null);
  const outputRef = useRef(null);

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
    socket.on("code-update", (newCode) => {
      if (editorRef.current && newCode !== editorRef.current.getValue()) {
        const cursor = editorRef.current.getCursor();
        editorRef.current.setValue(newCode);
        editorRef.current.setCursor(cursor);
      }
    });

    socket.on("language-update", (newLang) => {
      setLanguage(newLang);
      if (editorRef.current) editorRef.current.setOption("mode", newLang);
    });

    return () => {
      socket.off("code-update");
      socket.off("language-update");
    };
  }, [roomId]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    socket.emit("language-change", { roomId, language: newLang });
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([editorRef.current.getValue()], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `nexcode_${roomId}.${language === 'python' ? 'py' : 'js'}`;
    document.body.appendChild(element);
    element.click();
  };

  const handleCreate = async () => {
    try {
      const response = await axios.post("http://localhost:5000/api/rooms/create");
      const id = response.data.roomId;
      setRoomId(id);
      setJoined(true);
      socket.emit("join-room", { roomId: id });
    } catch (err) { alert("Server connectivity issue."); }
  };

  const handleJoin = async () => {
    if (roomId) {
      try {
        const response = await axios.post("http://localhost:5000/api/rooms/join", { roomId });
        setJoined(true);
        if (response.data.language) setLanguage(response.data.language);
        socket.emit("join-room", { roomId });
        setTimeout(() => {
          if (editorRef.current) editorRef.current.setValue(response.data.lastCode || "");
        }, 500);
      } catch (err) { alert("Room not found"); }
    }
  };

  const handleRunCode = async () => {
    setOutput("🚀 Compiling and running...");
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: language === "clike" ? "cpp" : language,
        version: "*",
        files: [{ content: editorRef.current.getValue() }],
        stdin: stdin,
      });
      setOutput(response.data.run.output || response.data.run.stderr || "Execution finished.");
    } catch (error) { setOutput("❌ Execution Error."); }
  };

  const handleAIExplain = async () => {
    if (!editorRef.current) return;
    setLoading(true);
    setExplanation("### 🤖 NexAI is reading your code...");
    try {
      const response = await axios.post("http://localhost:5000/api/ai/explain", {
        code: editorRef.current.getValue(),
        language: language
      });
      setExplanation(response.data.explanation);
    } catch (error) { setExplanation("### 🚦 AI offline."); }
    setLoading(false);
  };

  const myMeeting = async (element) => {
    if (!element || !roomId) return;
    const appID = 1535846009;
    const serverSecret = "b53e9592639c26f7bdd576c43786a344";
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID, serverSecret, roomId, Date.now().toString(), "User-" + Math.floor(Math.random() * 100)
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
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, color: colors.text, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: "400px", padding: "48px", borderRadius: "32px", background: colors.surface, border: `1px solid ${colors.border}`, textAlign: "center", boxShadow: isDarkMode ? "0 25px 50px -12px rgba(0,0,0,0.8)" : "0 20px 25px -5px rgba(0,0,0,0.05)" }}>
          <div style={{ background: `linear-gradient(135deg, ${colors.accent}, #064e3b)`, width: "64px", height: "64px", borderRadius: "20px", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><Cpu size={32} /></div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", marginBottom: "8px", letterSpacing: "-1px" }}>NexCode AI</h1>
          <p style={{ color: colors.subtext, fontSize: "15px", marginBottom: "32px" }}>Real-time collaboration for elite teams.</p>
          <input placeholder="Room ID" onChange={(e) => setRoomId(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: `1px solid ${colors.border}`, background: isDarkMode ? "#000" : "#f1f5f9", color: colors.text, marginBottom: "16px", outline: "none", fontSize: "15px" }} />
          <button onClick={handleJoin} style={{ width: "100%", padding: "14px", borderRadius: "12px", background: colors.accent, color: "white", border: "none", fontWeight: "700", cursor: "pointer", marginBottom: "16px", fontSize: "16px" }}>Join Now</button>
          <button onClick={handleCreate} style={{ width: "100%", background: "transparent", color: colors.subtext, border: `1px solid ${colors.border}`, padding: "12px", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>+ New Workspace</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: colors.bg, color: colors.text, transition: "0.3s ease", fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .CodeMirror { height: 100% !important; font-family: 'JetBrains Mono', monospace; font-size: 14px; padding: 10px; }
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
      <header style={{ height: "64px", padding: "0 24px", background: colors.header, backdropFilter: "blur(20px)", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><Cpu size={18}/></div>
            <span style={{ fontWeight: "900", fontSize: "1.25rem" }}>NexCode</span>
          </div>
          {/* RESTORED COPY BOX */}
          <div 
            style={{ 
              display: "flex", alignItems: "center", gap: "8px", 
              background: isDarkMode ? "#18181b" : "#f1f5f9", 
              padding: "6px 14px", borderRadius: "20px", border: `1px solid ${colors.border}`,
              cursor: "pointer"
            }}
            onClick={() => { 
              navigator.clipboard.writeText(roomId); 
              setCopied(true); 
              setTimeout(() => setCopied(false), 2000); 
            }}
          >
            <Users size={14} color={colors.subtext} />
            <span style={{ fontSize: "12px", fontWeight: "700", color: copied ? colors.accent : colors.subtext }}>
              {copied ? "Copied ID!" : roomId}
            </span>
            {copied ? <Check size={13} color={colors.accent} /> : <Copy size={13} color={colors.subtext} style={{ opacity: 0.6 }} />}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} style={{ background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "8px 12px", fontWeight: "700", outline: "none" }}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="clike">C++ / Java</option>
          </select>
          <button onClick={handleDownload} style={{ width: "40px", height: "40px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, display: "flex", alignItems: "center", justifyContent: "center" }}><Download size={18} /></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ width: "40px", height: "40px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: colors.surface, color: isDarkMode ? "#fbbf24" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleRunCode} style={{ background: colors.accent, color: "white", padding: "0 24px", height: "40px", borderRadius: "10px", fontWeight: "800", border: "none", display: "flex", alignItems: "center", gap: "8px" }}>
            <Play size={14} fill="white" /> Run
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden", padding: "16px", gap: "16px" }}>
        <div style={{ flex: explanation ? 2 : 3, display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ flex: 1, background: colors.surface, borderRadius: "24px", border: `1px solid ${colors.border}`, overflow: "hidden" }}>
            <CodeMirror
              options={{ mode: language, theme: isDarkMode ? "material" : "neo", lineNumbers: true, lineWrapping: true }}
              editorDidMount={(editor) => { editorRef.current = editor; }}
              onChange={(editor, data, value) => { if (data.origin !== "setValue") socket.emit("code-change", { roomId, code: value }); }}
            />
          </div>
          
          {/* TERMINAL SECTION - SCROLL FIX */}
          <div style={{ height: "240px", background: isDarkMode ? "#000" : "#f1f5f9", borderRadius: "24px", border: `1px solid ${colors.border}`, overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 24px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: isDarkMode ? "#121217" : "#e2e8f0", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f56" }} />
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ffbd2e" }} />
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#27c93f" }} />
                </div>
                <span style={{ fontSize: "11px", marginLeft: "10px", fontWeight: "900", color: colors.subtext }}>TERMINAL</span>
              </div>
              <button onClick={handleAIExplain} disabled={loading} style={{ background: colors.aiPrimary, color: "white", padding: "6px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: "800", border: "none" }}>
                {loading ? "Analyzing..." : "NexAI Explain"}
              </button>
            </div>
            
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <textarea placeholder="Type input here..." value={stdin} onChange={(e) => setStdin(e.target.value)} style={{ flex: 1, background: "transparent", color: colors.accent, border: "none", padding: "18px", outline: "none", resize: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", borderRight: `1px solid ${colors.border}` }} />
              <div 
                ref={outputRef}
                className="terminal-scroll"
                style={{ flex: 1.5, padding: "18px", fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", overflowY: "auto", height: "100%", color: colors.text, whiteSpace: "pre-wrap" }}
              >
                {output || <span style={{ opacity: 0.2 }}>Awaiting execution...</span>}
              </div>
            </div>
          </div>
        </div>

        {explanation && (
          <aside style={{ flex: 1, background: colors.surface, borderRadius: "24px", border: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: colors.aiPrimary }}>NexAI Insight</h3>
              <X size={20} style={{ cursor: "pointer", opacity: 0.4 }} onClick={() => setExplanation("")} />
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
              <ReactMarkdown components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter style={isDarkMode ? materialDark : oneLight} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, "")}</SyntaxHighlighter>
                  ) : <code style={{ background: isDarkMode ? "#27272a" : "#f1f5f9", padding: "3px 8px", borderRadius: "6px" }} {...props}>{children}</code>
                }
              }}>{explanation}</ReactMarkdown>
            </div>
          </aside>
        )}
      </main>

      {showVideo && (
        <div ref={myMeeting} style={{ width: "350px", height: "240px", position: "fixed", bottom: "32px", right: "32px", zIndex: 1000, borderRadius: "28px", overflow: "hidden", border: `4px solid ${colors.accent}` }} />
      )}
    </div>
  );
}

export default App;