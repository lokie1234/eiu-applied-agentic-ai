"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AiDocument, AiRules, AISource } from "@/lib/ai/types";
import {
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_FOLDERS,
  cleanAiResponseText,
} from "@/lib/ai/types";
import styles from "./AdminAiPortal.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  sources?: AISource[];
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function isSupportedKnowledgeDocument(filename: string): boolean {
  return /\.(pdf|txt|md|doc|docx)$/i.test(filename);
}

export default function AdminAiPortal() {
  const [activeTab, setActiveTab] = useState<"chat" | "knowledge" | "rules">("chat");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "ai",
      text: "Xin chào Admin! Tôi là trợ lý AI chuyên biệt của hệ thống EIU Applied Agentic AI. Tôi chỉ trả lời dựa trên tài liệu trong Knowledge Base. Hãy đặt câu hỏi để tôi tra cứu bằng chứng từ tài liệu.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isFastMode, setIsFastMode] = useState(true);
  const [selectedChatFolder, setSelectedChatFolder] = useState("");
  const [selectedChatSubfolder, setSelectedChatSubfolder] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Knowledge State
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [docToDelete, setDocToDelete] = useState<AiDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [scopeToDelete, setScopeToDelete] = useState<{ folder: string; subfolder: string } | null>(null);
  const [deletingFolderDocs, setDeletingFolderDocs] = useState(false);
  const [scopeToRename, setScopeToRename] = useState<{ folder: string; subfolder: string } | null>(null);
  const [renamedScopeName, setRenamedScopeName] = useState("");
  const [renamingScope, setRenamingScope] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("Chung");
  const [selectedSubfolder, setSelectedSubfolder] = useState("");
  const [isCustomSubfolder, setIsCustomSubfolder] = useState(false);
  const [customSubfolderName, setCustomSubfolderName] = useState("");
  const [isCustomFolder, setIsCustomFolder] = useState(false);
  const [customFolderName, setCustomFolderName] = useState("");
  const [activeFolderFilter, setActiveFolderFilter] = useState<string>("all");
  const [activeSubfolderFilter, setActiveSubfolderFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allAvailableFolders = Array.from(
    new Set([
      ...DEFAULT_FOLDERS,
      ...documents.map((d) => d.folder || "Chung"),
    ])
  );

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (activeFolderFilter === "all") return true;
    const docFolder = doc.folder || "Chung";
    if (docFolder !== activeFolderFilter) return false;
    return !activeSubfolderFilter || (doc.subfolder || "") === activeSubfolderFilter;
  });

  const chatScopes = Array.from(
    new Map(
      documents
        .filter(
          (document) =>
            document.status === "READY" && isSupportedKnowledgeDocument(document.filename)
        )
        .map((document) => {
          const folder = document.folder || "Chung";
          const subfolder = document.subfolder || "";
          const key = `${folder}\u0000${subfolder}`;
          return [key, { key, folder, subfolder, count: 0 }] as const;
        })
    ).values()
  ).map((scope) => ({
    ...scope,
    count: documents.filter(
      (document) =>
        document.status === "READY" &&
        isSupportedKnowledgeDocument(document.filename) &&
        (document.folder || "Chung") === scope.folder &&
        (document.subfolder || "") === scope.subfolder
    ).length,
  }));
  const activeChatScope = chatScopes.find(
    (scope) =>
      scope.folder === selectedChatFolder && scope.subfolder === selectedChatSubfolder
  );
  const activeChatFolder = activeChatScope?.folder || "";
  const activeChatSubfolder = activeChatScope?.subfolder || "";

  const uploadSubfolders = Array.from(
    new Set(
      documents
        .filter((document) => (document.folder || "Chung") === selectedFolder)
        .map((document) => document.subfolder || "")
        .filter(Boolean)
    )
  );
  const activeFilterSubfolders = Array.from(
    new Set(
      documents
        .filter((document) => (document.folder || "Chung") === activeFolderFilter)
        .map((document) => document.subfolder || "")
        .filter(Boolean)
    )
  );

  const activeFolderDocumentCount =
    activeFolderFilter === "all"
      ? 0
      : documents.filter(
          (document) =>
            (document.folder || "Chung") === activeFolderFilter &&
            (!activeSubfolderFilter || (document.subfolder || "") === activeSubfolderFilter)
        ).length;
  const canRenameActiveScope =
    activeFolderFilter !== "all" &&
    (Boolean(activeSubfolderFilter) || !DEFAULT_FOLDERS.includes(activeFolderFilter));

  // Rules State
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [fallbackMessage, setFallbackMessage] = useState(DEFAULT_FALLBACK_MESSAGE);
  const [requireCitation, setRequireCitation] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesNotice, setRulesNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending, activeTab]);

  // Load documents
  async function loadDocuments() {
    try {
      setLoadingDocs(true);
      const res = await fetch("/api/ai/documents", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải danh sách tài liệu.");
      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  }

  // Load rules
  async function loadRules() {
    try {
      setLoadingRules(true);
      const res = await fetch("/api/ai/rules", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải quy tắc AI.");
      const data = await res.json();
      if (data.success && data.rules) {
        const r: AiRules = data.rules;
        setSystemPrompt(r.system_prompt || DEFAULT_SYSTEM_PROMPT);
        setFallbackMessage(r.fallback_message || DEFAULT_FALLBACK_MESSAGE);
        setRequireCitation(r.require_citation ?? true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRules(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/ai/documents", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.success && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      })
      .catch(() => undefined);

    fetch("/api/ai/rules", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.success && data.rules) {
          const r: AiRules = data.rules;
          setSystemPrompt(r.system_prompt || DEFAULT_SYSTEM_PROMPT);
          setFallbackMessage(r.fallback_message || DEFAULT_FALLBACK_MESSAGE);
          setRequireCitation(r.require_citation ?? true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  // Poll for document processing updates
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.status === "PROCESSING" || d.status === "UPLOADING"
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      void loadDocuments();
    }, 4000);

    return () => clearInterval(interval);
  }, [documents]);

  // Sign out handler
  async function handleSignOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  }

  // Send Chat message with Real-time Streaming
  async function handleSendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    const promptText = inputPrompt.trim();
    if (!promptText || isSending) return;
    if (!activeChatFolder) {
      setChatError("Vui lòng chọn một thư mục tài liệu trước khi đặt câu hỏi.");
      return;
    }

    setChatError("");
    const userMsg: ChatMessage = {
      id: "u_" + Date.now(),
      role: "user",
      text: promptText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsSending(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome-msg")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptText,
          history,
          stream: true,
          fastMode: isFastMode,
          folder: activeChatFolder,
          subfolder: activeChatSubfolder,
        }),
      });

      if (!res.ok) {
        let errMsg = "Lỗi khi trao đổi với AI.";
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && res.body) {
        const aiMsgId = "ai_" + Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: "ai",
            text: "",
            sources: [],
            createdAt: new Date().toISOString(),
          },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === "chunk" && typeof event.text === "string") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, text: m.text + event.text } : m
                  )
                );
              } else if (event.type === "replace") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? {
                          ...m,
                          text: event.answer,
                          sources: Array.isArray(event.sources) ? event.sources : [],
                        }
                      : m
                  )
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? {
                          ...m,
                          sources: Array.isArray(event.sources) ? event.sources : [],
                        }
                      : m
                  )
                );
              } else if (event.type === "error") {
                setChatError(event.error || "Lỗi tạo câu trả lời.");
              }
            } catch {
              // ignore malformed SSE messages
            }
          }
        }
      } else {
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || "Lỗi tạo câu trả lời từ AI.");
        }

        const aiMsg: ChatMessage = {
          id: "ai_" + Date.now(),
          role: "ai",
          text: data.answer,
          sources: Array.isArray(data.sources) ? data.sources : [],
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi trao đổi với AI.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: "welcome-msg",
        role: "ai",
        text: "Lịch sử trò chuyện đã được làm mới. Hãy nhập câu hỏi để tra cứu trong Knowledge Base.",
        createdAt: new Date().toISOString(),
      },
    ]);
    setChatError("");
  }

  function handleChatFolderChange(folder: string, subfolder: string = "") {
    setSelectedChatFolder(folder);
    setSelectedChatSubfolder(subfolder);
    setInputPrompt("");
    setChatError("");
    setMessages([
      {
        id: "welcome-msg",
        role: "ai",
        text: folder
          ? `Đã khóa phạm vi tra cứu vào “${subfolder ? `${folder} / ${subfolder}` : folder}”. Hãy nhập câu hỏi của bạn.`
          : "Vui lòng chọn một thư mục tài liệu trước khi bắt đầu tra cứu.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  // Multiple files upload handler
  async function handleFilesUpload(files: File[]) {
    if (!files.length) return;
    setUploadNotice(null);
    setUploading(true);

    const chosenFolder = isCustomFolder
      ? (customFolderName.trim() || "Chung")
      : selectedFolder;
    const chosenSubfolder = isCustomSubfolder
      ? customSubfolderName.trim()
      : selectedSubfolder;

    const invalidFiles = files.filter((file) => !isSupportedKnowledgeDocument(file.name));
    if (invalidFiles.length > 0) {
      setUploadNotice({
        type: "error",
        text: `Chỉ hỗ trợ PDF, TXT, Markdown hoặc Word. File không hợp lệ: ${invalidFiles
          .map((file) => file.name)
          .join(", ")}`,
      });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("folder", chosenFolder);
    formData.append("subfolder", chosenSubfolder);
    for (const f of files) {
      formData.append("files", f);
    }

    try {
      const res = await fetch("/api/ai/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Tải lên tài liệu thất bại.");
      }

      setUploadNotice({
        type: "success",
        text: data.message || `Đã tải lên và lập chỉ mục ${files.length} tài liệu thành công!`,
      });

      void loadDocuments();
    } catch (err) {
      setUploadNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi khi upload tài liệu.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Confirm delete document
  async function handleConfirmDelete() {
    if (!docToDelete || deletingDoc) return;
    setDeletingDoc(true);

    try {
      const res = await fetch(`/api/ai/documents/${docToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không thể xóa tài liệu.");
      }

      setDocToDelete(null);
      void loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi xóa tài liệu.");
    } finally {
      setDeletingDoc(false);
    }
  }

  async function handleConfirmDeleteFolder() {
    if (!scopeToDelete || deletingFolderDocs) return;
    setDeletingFolderDocs(true);
    setUploadNotice(null);

    try {
      const res = await fetch(
        `/api/ai/documents?folder=${encodeURIComponent(scopeToDelete.folder)}${
          scopeToDelete.subfolder
            ? `&subfolder=${encodeURIComponent(scopeToDelete.subfolder)}`
            : ""
        }`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không thể xóa tài liệu trong thư mục.");
      }

      setDocuments((current) =>
        current.filter((document) => {
          if ((document.folder || "Chung") !== scopeToDelete.folder) return true;
          if (!scopeToDelete.subfolder) return false;
          return (document.subfolder || "") !== scopeToDelete.subfolder;
        })
      );
      setSearchQuery("");
      setActiveFolderFilter("all");
      setActiveSubfolderFilter("");
      if (
        selectedChatFolder === scopeToDelete.folder &&
        (!scopeToDelete.subfolder || selectedChatSubfolder === scopeToDelete.subfolder)
      ) {
        handleChatFolderChange("");
      }
      const deletedScopeLabel = scopeToDelete.subfolder
        ? `${scopeToDelete.folder} / ${scopeToDelete.subfolder}`
        : scopeToDelete.folder;
      setScopeToDelete(null);
      setUploadNotice({
        type: "success",
        text: data.message || `Đã xóa tài liệu trong "${deletedScopeLabel}".`,
      });
      void loadDocuments();
    } catch (err) {
      setUploadNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi khi xóa tài liệu trong thư mục.",
      });
      setScopeToDelete(null);
    } finally {
      setDeletingFolderDocs(false);
    }
  }

  async function handleRenameScope(event: FormEvent) {
    event.preventDefault();
    if (!scopeToRename || renamingScope) return;

    const newName = renamedScopeName.trim();
    if (!newName) return;

    setRenamingScope(true);
    setUploadNotice(null);
    try {
      const res = await fetch("/api/ai/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: scopeToRename.folder,
          subfolder: scopeToRename.subfolder,
          newName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Không thể đổi tên thư mục.");
      }

      const isSubfolderRename = Boolean(scopeToRename.subfolder);
      const nextFolder = isSubfolderRename ? scopeToRename.folder : newName;
      const nextSubfolder = isSubfolderRename ? newName : "";

      setDocuments((current) =>
        current.map((document) => {
          if ((document.folder || "Chung") !== scopeToRename.folder) return document;
          if (isSubfolderRename && (document.subfolder || "") !== scopeToRename.subfolder) {
            return document;
          }
          return {
            ...document,
            folder: nextFolder,
            subfolder: isSubfolderRename ? nextSubfolder : document.subfolder,
          };
        })
      );

      if (isSubfolderRename) {
        setActiveSubfolderFilter(nextSubfolder);
        if (
          selectedFolder === scopeToRename.folder &&
          selectedSubfolder === scopeToRename.subfolder
        ) {
          setSelectedSubfolder(nextSubfolder);
        }
      } else {
        setActiveFolderFilter(nextFolder);
        if (selectedFolder === scopeToRename.folder) {
          setSelectedFolder(nextFolder);
          setCustomFolderName(nextFolder);
          setIsCustomFolder(!DEFAULT_FOLDERS.includes(nextFolder));
        }
      }

      if (
        selectedChatFolder === scopeToRename.folder &&
        (!isSubfolderRename || selectedChatSubfolder === scopeToRename.subfolder)
      ) {
        handleChatFolderChange(
          nextFolder,
          isSubfolderRename ? nextSubfolder : selectedChatSubfolder
        );
      }

      setScopeToRename(null);
      setRenamedScopeName("");
      setUploadNotice({ type: "success", text: data.message });
    } catch (error) {
      setUploadNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Lỗi khi đổi tên thư mục.",
      });
    } finally {
      setRenamingScope(false);
    }
  }

  // Save rules
  async function handleSaveRules(e: FormEvent) {
    e.preventDefault();
    if (savingRules) return;

    setSavingRules(true);
    setRulesNotice(null);

    try {
      const res = await fetch("/api/ai/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          fallback_message: fallbackMessage,
          require_citation: requireCitation,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Lỗi lưu quy tắc AI.");
      }

      setRulesNotice({
        type: "success",
        message: "Đã lưu quy tắc phản hồi của AI thành công!",
      });
    } catch (err) {
      setRulesNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Lỗi khi lưu quy tắc.",
      });
    } finally {
      setSavingRules(false);
    }
  }

  function handleResetDefaultRules() {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setFallbackMessage(DEFAULT_FALLBACK_MESSAGE);
    setRequireCitation(true);
    setRulesNotice({
      type: "success",
      message: "Đã điền lại nội dung quy tắc mặc định (nhấn 'Lưu quy tắc' để áp dụng).",
    });
  }

  return (
    <main className={styles.portal}>
      <div className={styles.grid} aria-hidden="true" />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.logoWindow}>
            <Image
              src="/branding/EIU-logo-white.png"
              alt="EIU"
              width={2048}
              height={2048}
              priority
              unoptimized
            />
          </div>
          <div className={styles.brandDivider} />
          <div className={styles.brandTitles}>
            <span className={styles.brandEyebrow}>EIU · Applied Agentic AI</span>
            <strong className={styles.brandTitle}>Admin Private Knowledge AI</strong>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/" className={styles.backLink}>
            ← Về Sections
          </Link>
          <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className={styles.mainContainer}>
        {/* Navigation Tabs */}
        <nav className={styles.tabsNav} aria-label="AI Navigation Tabs">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "chat" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 AI CHAT
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "knowledge" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("knowledge")}
          >
            📚 KNOWLEDGE ({documents.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "rules" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            ⚙️ RULES
          </button>
        </nav>

        {/* Tab 1: AI Chat */}
        {activeTab === "chat" && (
          <section className={styles.tabPanel}>
            <div className={styles.chatContainer}>
              <div className={styles.chatHeader}>
                <div className={styles.chatTitleGroup}>
                  <h2>EIU Knowledge AI Assistant</h2>
                  <p>
                    Hỏi đáp trực tiếp dựa trên {documents.filter((d) => d.status === "READY").length} tài liệu đã sẵn sàng trong Knowledge Base
                  </p>
                </div>
                <div className={styles.chatHeaderControls}>
                  <button
                    type="button"
                    className={`${styles.fastModeBtn} ${isFastMode ? styles.fastModeBtnActive : ""}`}
                    onClick={() => setIsFastMode((prev) => !prev)}
                    title={
                      isFastMode
                        ? "Ưu tiên vector index theo folder; tự fallback File Search khi cần"
                        : "Dùng Gemini File Search theo folder đã chọn"
                    }
                  >
                    {isFastMode ? "⚡ Siêu tốc (Bật)" : "🔍 Tìm kiếm sâu (Tắt)"}
                  </button>
                  <button type="button" className={styles.clearChatBtn} onClick={handleClearChat}>
                    Làm mới đoạn chat
                  </button>
                </div>
              </div>

              <div className={styles.chatScopeBar}>
                <div className={styles.chatScopeLabel}>
                  <strong>Phạm vi tra cứu</strong>
                  <span>Bắt buộc chọn một thư mục để AI không trộn lẫn nguồn.</span>
                </div>
                <div className={styles.chatScopeOptions}>
                  {chatScopes.length === 0 ? (
                    <span className={styles.chatScopeEmpty}>Chưa có thư mục chứa tài liệu sẵn sàng.</span>
                  ) : (
                    chatScopes.map(({ key, folder, subfolder, count }) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.chatScopeBtn} ${
                          activeChatFolder === folder && activeChatSubfolder === subfolder
                            ? styles.chatScopeBtnActive
                            : ""
                        }`}
                        onClick={() => handleChatFolderChange(folder, subfolder)}
                        disabled={isSending}
                      >
                        📁 {folder}
                        {subfolder ? ` / ${subfolder}` : ""}
                        <span>{count}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Message List */}
              <div className={styles.chatMessages}>
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAi}`}
                    >
                      <div className={styles.messageAuthor}>
                        {isUser ? (
                          <span className={styles.authorUser}>Admin</span>
                        ) : (
                          <span className={styles.authorAi}>
                            EIU AI
                            <span className={styles.authorAiBadge}>Grounded</span>
                          </span>
                        )}
                      </div>

                      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>
                        {isUser ? m.text : cleanAiResponseText(m.text)}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className={`${styles.messageRow} ${styles.messageRowAi}`}>
                    <div className={styles.messageAuthor}>
                      <span className={styles.authorAi}>EIU AI</span>
                    </div>
                    <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                      <div className={styles.chatLoading}>
                        <span className={styles.spinner} />
                        <span>AI đang phân tích tài liệu và tìm bằng chứng...</span>
                      </div>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className={`${styles.rulesNotice} ${styles.noticeError}`} role="alert">
                    ⚠️ {chatError}
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className={styles.chatInputArea}>
                <textarea
                  className={styles.chatTextarea}
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    if (chatError) setChatError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeChatFolder
                      ? `Đặt câu hỏi trong “${activeChatSubfolder ? `${activeChatFolder} / ${activeChatSubfolder}` : activeChatFolder}”...`
                      : "Chọn một thư mục tài liệu ở phía trên để bắt đầu..."
                  }
                  rows={2}
                  disabled={isSending || !activeChatFolder}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={isSending || !activeChatFolder || !inputPrompt.trim()}
                >
                  {isSending ? (
                    <>
                      <span className={styles.spinner} />
                      Đang tra cứu
                    </>
                  ) : (
                    <>Gửi câu hỏi ➤</>
                  )}
                </button>
              </form>
              <div className={styles.chatInputHint}>
                Gợi ý: Nhấn Enter để gửi nhanh, Shift + Enter để xuống hàng
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Knowledge */}
        {activeTab === "knowledge" && (
          <section className={`${styles.tabPanel} ${styles.knowledgePanel}`}>
            <div className={styles.knowledgeHeader}>
              <div>
                <h2>Tài liệu Knowledge Base</h2>
                <p>
                  Upload PDF, TXT, MD hoặc Word để hệ thống lập chỉ mục và chỉ trả lời từ tài liệu nội bộ
                </p>
              </div>
              <div className={styles.knowledgeHeaderActions}>
                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => void loadDocuments()}
                  disabled={loadingDocs}
                >
                  {loadingDocs ? "Đang tải…" : "↻ Làm mới danh sách"}
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              className={`${styles.uploadDropzone} ${uploading ? styles.uploadDropzoneActive : ""}`}
              onClick={() => {
                if (!uploading) fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (uploading) return;
                const droppedFiles = Array.from(e.dataTransfer.files || []);
                if (droppedFiles.length > 0) void handleFilesUpload(droppedFiles);
              }}
            >
              <div className={styles.uploadMainRow}>
                <div className={styles.uploadIcon}>＋</div>
                <div className={styles.uploadCopy}>
                  <div className={styles.uploadTitle}>
                    {uploading
                      ? "Đang phân tích và lập chỉ mục tài liệu..."
                      : "Thêm tài liệu vào Knowledge Base"}
                  </div>
                  <div className={styles.uploadSubtitle}>
                    Kéo thả hoặc chọn nhiều file · PDF, TXT, MD, DOC, DOCX · Tối đa 25MB/file
                  </div>
                </div>

                {!uploading ? (
                  <button type="button" className={styles.browseBtn}>
                    Chọn tài liệu
                  </button>
                ) : (
                  <div className={styles.uploadProgressBox}>
                    <span className={styles.spinner} />
                    <span>Đang xử lý...</span>
                  </div>
                )}
              </div>

              <div className={styles.uploadScopeGrid}>
                {/* Folder Selector in Dropzone */}
                <div
                  className={styles.folderSelectorArea}
                  onClick={(e) => e.stopPropagation()}
                >
                <div className={styles.folderLabel}>
                  <span>📁 Lưu vào thư mục:</span>
                </div>
                <div className={styles.folderChipsRow}>
                  {DEFAULT_FOLDERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.folderChip} ${
                        !isCustomFolder && selectedFolder === f ? styles.folderChipActive : ""
                      }`}
                      onClick={() => {
                        setIsCustomFolder(false);
                        setSelectedFolder(f);
                        setSelectedSubfolder("");
                        setIsCustomSubfolder(false);
                      }}
                    >
                      {f}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.folderChip} ${isCustomFolder ? styles.folderChipActive : ""}`}
                    onClick={() => {
                      setIsCustomFolder(true);
                      setSelectedSubfolder("");
                      setIsCustomSubfolder(false);
                    }}
                  >
                    + Thư mục mới
                  </button>
                </div>
                {isCustomFolder && (
                  <input
                    type="text"
                    className={styles.customFolderInput}
                    placeholder="Nhập tên thư mục mới..."
                    value={customFolderName}
                    onChange={(e) => setCustomFolderName(e.target.value)}
                    autoFocus
                  />
                )}
                </div>

                <div
                  className={styles.subfolderSelectorArea}
                  onClick={(event) => event.stopPropagation()}
                >
                <div className={styles.folderLabel}>↳ Folder nhỏ:</div>
                <div className={styles.folderChipsRow}>
                  <button
                    type="button"
                    className={`${styles.folderChip} ${
                      !isCustomSubfolder && !selectedSubfolder ? styles.folderChipActive : ""
                    }`}
                    onClick={() => {
                      setIsCustomSubfolder(false);
                      setSelectedSubfolder("");
                    }}
                  >
                    Không có
                  </button>
                  {!isCustomFolder &&
                    uploadSubfolders.map((subfolder) => (
                      <button
                        key={subfolder}
                        type="button"
                        className={`${styles.folderChip} ${
                          !isCustomSubfolder && selectedSubfolder === subfolder
                            ? styles.folderChipActive
                            : ""
                        }`}
                        onClick={() => {
                          setIsCustomSubfolder(false);
                          setSelectedSubfolder(subfolder);
                        }}
                      >
                        {subfolder}
                      </button>
                    ))}
                  <button
                    type="button"
                    className={`${styles.folderChip} ${
                      isCustomSubfolder ? styles.folderChipActive : ""
                    }`}
                    onClick={() => setIsCustomSubfolder(true)}
                  >
                    + Folder nhỏ mới
                  </button>
                </div>
                {isCustomSubfolder && (
                  <input
                    type="text"
                    className={styles.customFolderInput}
                    placeholder="Tên folder nhỏ..."
                    value={customSubfolderName}
                    onChange={(event) => setCustomSubfolderName(event.target.value)}
                  />
                )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={styles.fileInput}
                accept=".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={uploading}
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  if (selectedFiles.length > 0) void handleFilesUpload(selectedFiles);
                }}
              />

            </div>

            {uploadNotice && (
              <div
                className={`${styles.rulesNotice} ${
                  uploadNotice.type === "success" ? styles.noticeSuccess : styles.noticeError
                }`}
                style={{ marginBottom: 18 }}
              >
                {uploadNotice.type === "success" ? "✓" : "⚠️"} {uploadNotice.text}
              </div>
            )}

            <div className={styles.documentListHeader}>
              <div>
                <h3>Tài liệu đã upload</h3>
                <p>Danh sách tài liệu hiện đang được AI sử dụng để tra cứu.</p>
              </div>
              <div className={styles.documentListActions}>
                <span className={styles.documentCountBadge}>
                  {activeFolderFilter === "all" ? documents.length : activeFolderDocumentCount} tài liệu
                </span>
                {canRenameActiveScope && activeFolderDocumentCount > 0 && (
                  <button
                    type="button"
                    className={styles.renameFolderBtn}
                    onClick={() => {
                      const scope = {
                        folder: activeFolderFilter,
                        subfolder: activeSubfolderFilter,
                      };
                      setScopeToRename(scope);
                      setRenamedScopeName(scope.subfolder || scope.folder);
                    }}
                  >
                    Đổi tên {activeSubfolderFilter ? "folder nhỏ" : "thư mục"}
                  </button>
                )}
                {activeFolderFilter !== "all" && activeFolderDocumentCount > 0 && (
                  <button
                    type="button"
                    className={styles.deleteAllBtn}
                    onClick={() =>
                      setScopeToDelete({
                        folder: activeFolderFilter,
                        subfolder: activeSubfolderFilter,
                      })
                    }
                    disabled={deletingFolderDocs}
                  >
                    {activeSubfolderFilter
                      ? "Xóa tài liệu trong folder nhỏ"
                      : "Xóa tài liệu trong folder"}
                  </button>
                )}
              </div>
            </div>

            {/* Folder Filter Bar */}
            <div className={styles.folderFilterBar}>
              <button
                type="button"
                className={`${styles.folderFilterBtn} ${
                  activeFolderFilter === "all" ? styles.folderFilterBtnActive : ""
                }`}
                onClick={() => {
                  setActiveFolderFilter("all");
                  setActiveSubfolderFilter("");
                }}
              >
                📂 Tất cả ({documents.length})
              </button>
              {allAvailableFolders.map((f) => {
                const count = documents.filter((d) => (d.folder || "Chung") === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.folderFilterBtn} ${
                      activeFolderFilter === f ? styles.folderFilterBtnActive : ""
                    }`}
                    onClick={() => {
                      setActiveFolderFilter(f);
                      setActiveSubfolderFilter("");
                    }}
                  >
                    📁 {f} ({count})
                  </button>
                );
              })}
            </div>

            {activeFolderFilter !== "all" && activeFilterSubfolders.length > 0 && (
              <div className={styles.subfolderFilterBar}>
                <span>↳ Folder nhỏ:</span>
                <button
                  type="button"
                  className={`${styles.folderFilterBtn} ${
                    !activeSubfolderFilter ? styles.folderFilterBtnActive : ""
                  }`}
                  onClick={() => setActiveSubfolderFilter("")}
                >
                  Tất cả trong {activeFolderFilter}
                </button>
                {activeFilterSubfolders.map((subfolder) => {
                  const count = documents.filter(
                    (document) =>
                      (document.folder || "Chung") === activeFolderFilter &&
                      (document.subfolder || "") === subfolder
                  ).length;
                  return (
                    <button
                      key={subfolder}
                      type="button"
                      className={`${styles.folderFilterBtn} ${
                        activeSubfolderFilter === subfolder ? styles.folderFilterBtnActive : ""
                      }`}
                      onClick={() => setActiveSubfolderFilter(subfolder)}
                    >
                      📂 {subfolder} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search Toolbar & Statistics */}
            <div className={styles.tableToolbar}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Tìm kiếm tài liệu theo tên file..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={() => setSearchQuery("")}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={styles.tableStats}>
                {searchQuery.trim() || activeFolderFilter !== "all" ? (
                  <span>
                    Tìm thấy <strong>{filteredDocuments.length}</strong> / {documents.length} tài liệu
                  </span>
                ) : (
                  <span>
                    Tổng cộng: <strong>{documents.length}</strong> tài liệu
                  </span>
                )}
              </div>
            </div>

            {/* Documents Table */}
            <div className={styles.docTableContainer}>
              <table className={styles.docTable}>
                <thead>
                  <tr>
                    <th>FILE NAME</th>
                    <th>THƯ MỤC</th>
                    <th>STATUS</th>
                    <th>SIZE</th>
                    <th>UPLOADED AT</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        Chưa có tài liệu nào trong Knowledge Base. Hãy tải lên tài liệu đầu tiên ở trên!
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        Không tìm thấy tài liệu nào khớp với bộ lọc hoặc từ khóa &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => {
                      let badgeClass = styles.statusProcessing;
                      if (doc.status === "READY") badgeClass = styles.statusReady;
                      else if (doc.status === "ERROR") badgeClass = styles.statusError;
                      else if (doc.status === "UPLOADING") badgeClass = styles.statusUploading;

                      const lowerName = doc.filename.toLowerCase();
                      const fileIcon = lowerName.endsWith(".pdf")
                        ? "📄"
                        : isSupportedKnowledgeDocument(lowerName)
                        ? "📝"
                        : "⚠️";

                      return (
                        <tr key={doc.id}>
                          <td>
                            <strong>
                              <span style={{ marginRight: 7, fontSize: "14px" }}>{fileIcon}</span>
                              {doc.filename}
                            </strong>
                            {doc.error_message && (
                              <div style={{ color: "#f87171", fontSize: "11px", marginTop: "2px" }}>
                                {doc.error_message}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={styles.folderBadge}>
                              📁 {doc.folder || "Chung"}
                              {doc.subfolder ? ` / ${doc.subfolder}` : ""}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${badgeClass}`}>
                              {doc.status === "PROCESSING" && <span className={styles.spinner} />}
                              {doc.status}
                            </span>
                          </td>
                          <td>{formatBytes(doc.size)}</td>
                          <td>{formatDateTime(doc.created_at)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.deleteDocBtn}
                              onClick={() => setDocToDelete(doc)}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: Rules */}
        {activeTab === "rules" && (
          <section className={styles.tabPanel}>
            <form onSubmit={handleSaveRules} className={styles.rulesContainer}>
              <div className={styles.rulesHeader}>
                <div>
                  <h2>Cấu hình quy tắc AI &amp; Knowledge Boundary</h2>
                  <p>
                    Chỉnh sửa System Prompt, thông điệp từ chối khi thiếu tài liệu và ràng buộc trích dẫn
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => void loadRules()}
                  disabled={loadingRules}
                >
                  {loadingRules ? "Đang tải…" : "↻ Tải lại quy tắc"}
                </button>
              </div>

              {rulesNotice && (
                <div
                  className={`${styles.rulesNotice} ${
                    rulesNotice.type === "success" ? styles.noticeSuccess : styles.noticeError
                  }`}
                >
                  {rulesNotice.type === "success" ? "✓" : "⚠️"} {rulesNotice.message}
                </div>
              )}

              {/* System Instruction */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>AI System Rules (System Instruction)</label>
                <span className={styles.formHint}>
                  Chỉ thị cốt lõi định hình Knowledge Boundary, phong cách trả lời và quy tắc bảo mật của AI.
                </span>
                <textarea
                  className={styles.rulesTextarea}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  required
                />
              </div>

              {/* Fallback Message */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fallback response (Câu từ chối khi không có bằng chứng)</label>
                <span className={styles.formHint}>
                  Câu trả lời bắt buộc khi câu hỏi không tìm thấy thông tin trong tài liệu đã upload.
                </span>
                <input
                  type="text"
                  className={styles.fallbackInput}
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  required
                />
              </div>

              {/* Require Sources Toggle */}
              <div className={styles.toggleContainer}>
                <div className={styles.toggleMeta}>
                  <strong>Bắt buộc có nguồn (Require Sources Guard)</strong>
                  <span>
                    Chỉ cho phép hiển thị câu trả lời khi có bằng chứng grounding từ Knowledge Base. Nếu 0 nguồn, tự động trả về câu từ chối.
                  </span>
                </div>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={requireCitation}
                    onChange={(e) => setRequireCitation(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              {/* Actions */}
              <div className={styles.rulesActions}>
                <button
                  type="submit"
                  className={styles.saveRulesBtn}
                  disabled={savingRules || loadingRules}
                >
                  {savingRules ? "Đang lưu..." : "Lưu quy tắc (SAVE RULES)"}
                </button>
                <button
                  type="button"
                  className={styles.resetRulesBtn}
                  onClick={handleResetDefaultRules}
                  disabled={savingRules}
                >
                  Khôi phục mặc định
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className={styles.modalLayer} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h3>Xác nhận xóa tài liệu</h3>
            <p>
              Bạn có chắc chắn muốn xóa tài liệu <strong>&quot;{docToDelete.filename}&quot;</strong> khỏi Knowledge Base không?
              Thao tác này sẽ xóa vĩnh viễn vector embedding trên Gemini và dữ liệu trên Supabase.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setDocToDelete(null)}
                disabled={deletingDoc}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={() => void handleConfirmDelete()}
                disabled={deletingDoc}
              >
                {deletingDoc ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {scopeToDelete && (
        <div className={styles.modalLayer} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-folder-title">
            <h3 id="delete-folder-title">Xác nhận xóa tài liệu trong folder</h3>
            <p>
              Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ tài liệu trong <strong>&quot;{
                scopeToDelete.subfolder
                  ? `${scopeToDelete.folder} / ${scopeToDelete.subfolder}`
                  : scopeToDelete.folder
              }&quot;</strong> không?
              Dữ liệu trên Gemini và Supabase sẽ bị xóa và không thể hoàn tác.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setScopeToDelete(null)}
                disabled={deletingFolderDocs}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={() => void handleConfirmDeleteFolder()}
                disabled={deletingFolderDocs}
              >
                {deletingFolderDocs ? "Đang xóa…" : `Xóa ${activeFolderDocumentCount} tài liệu`}
              </button>
            </div>
          </div>
        </div>
      )}

      {scopeToRename && (
        <div className={styles.modalLayer} role="presentation">
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-folder-title"
            onSubmit={handleRenameScope}
          >
            <h3 id="rename-folder-title">
              Đổi tên {scopeToRename.subfolder ? "folder nhỏ" : "thư mục"}
            </h3>
            <p>
              Tên hiện tại: <strong>&quot;{scopeToRename.subfolder || scopeToRename.folder}&quot;</strong>.
              Tất cả tài liệu và vector index trong phạm vi này sẽ được cập nhật đồng bộ.
            </p>
            <input
              type="text"
              className={styles.renameFolderInput}
              value={renamedScopeName}
              onChange={(event) => setRenamedScopeName(event.target.value)}
              maxLength={100}
              autoFocus
              required
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => {
                  setScopeToRename(null);
                  setRenamedScopeName("");
                }}
                disabled={renamingScope}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={styles.renameConfirmBtn}
                disabled={renamingScope || !renamedScopeName.trim()}
              >
                {renamingScope ? "Đang đổi tên…" : "Lưu tên mới"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
