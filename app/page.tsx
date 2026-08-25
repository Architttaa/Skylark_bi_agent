"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "model";
  text: string;
}

const exampleQuestions = [
  "How's our pipeline looking for the mining sector this quarter?",
  "Which work orders are still pending collection?",
  "Give me a revenue summary for this month.",
  "What sectors have the most open deals right now?",
  "Prepare a leadership update on pipeline health.",
];

// Helper function to extract raw text content from React nodes
function extractText(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const element = node as { props?: { children?: React.ReactNode } };
    return extractText(element.props?.children);
  }
  return "";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const submitMessage = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    setInput("");
    setError(null);

    // Append the user message locally
    const newMessages = [...messages, { role: "user" as const, text: messageText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Map history to the {role, parts} format expected by the agent
      const history = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          history,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      setMessages((prev) => [
        ...prev,
        { role: "model" as const, text: data.reply },
      ]);
    } catch (err: unknown) {
      console.error("Chat request failed:", err);
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);

      // Append inline error to chat thread for context
      setMessages((prev) => [
        ...prev,
        {
          role: "model" as const,
          text: `⚠️ **Error processing request:** ${msg}\n\nPlease try again in a moment.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header Bar */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Skylark Drones <span className="text-zinc-500 font-medium">BI Agent</span>
          </h1>
        </div>
        <div className="text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/50">
          Connected to Monday API
        </div>
      </header>

      {/* Main Conversation Stream / Empty State */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            /* Console Empty State View */
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
              <h2 className="text-2xl font-bold tracking-tight text-white mb-8 sm:text-3xl max-w-xl leading-snug">
                Ask the flight deck anything about pipeline, revenue, or ops.
              </h2>
              <div className="grid grid-cols-1 gap-3.5 w-full max-w-2xl">
                {exampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitMessage(q)}
                    disabled={loading}
                    className="font-mono text-left text-sm border border-amber-500/20 bg-zinc-900/60 hover:border-cyan-500/80 hover:text-cyan-400 text-zinc-300 p-4 rounded-xl cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <span className="text-amber-500/60 mr-2 font-bold select-none">&gt;</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Conversation Stream */
            <div className="space-y-6">
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`relative p-4 rounded-2xl shadow-sm text-sm sm:text-base transition-all duration-200 ${
                        isUser
                          ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-none max-w-[85%] sm:max-w-[75%] shadow-indigo-900/10"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none max-w-[90%] sm:max-w-[85%]"
                      }`}
                    >
                      {/* Sender Label */}
                      <span
                        className={`block text-[10px] uppercase font-bold tracking-wider mb-1.5 opacity-60 ${
                          isUser ? "text-right" : "text-left text-indigo-400"
                        }`}
                      >
                        {isUser ? "You" : "Skylark Agent"}
                      </span>

                      {/* Body Text (Rendered via ReactMarkdown) */}
                      <div className="prose prose-invert max-w-none text-zinc-100 overflow-x-auto">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-base font-bold mt-4 mb-2 text-white border-b border-zinc-800 pb-1">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-sm font-semibold mt-3 mb-2 text-white">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-xs font-semibold mt-2.5 mb-1 text-white">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="mb-2 leading-relaxed text-zinc-200">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside mb-3 space-y-1 text-zinc-200 pl-1.5">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside mb-3 space-y-1 text-zinc-200 pl-1.5">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-zinc-200 inline-block w-full">
                                • {children}
                              </li>
                            ),
                            code: ({ children }) => (
                              <code className="bg-zinc-950/60 px-1.5 py-0.5 rounded font-mono text-xs text-indigo-400 border border-zinc-800">
                                {children}
                              </code>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">
                                {children}
                              </strong>
                            ),
                            // Custom GFM Table Rendering Overrides
                            table: ({ children }) => (
                              <div className="overflow-x-auto w-full my-4 rounded-xl border border-[#232B35] shadow-sm">
                                <table className="min-w-full divide-y divide-[#232B35] text-left text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-zinc-900">{children}</thead>
                            ),
                            th: ({ children }) => {
                              const rawText = extractText(children);
                              const isNumericHeader = [
                                "value",
                                "count",
                                "amount",
                                "total",
                                "receivable",
                                "billed",
                                "collected",
                              ].some((keyword) =>
                                rawText.toLowerCase().includes(keyword)
                              );
                              return (
                                <th
                                  className={`px-4 py-3 font-mono text-xs font-bold tracking-wider text-amber-500 uppercase ${
                                    isNumericHeader ? "text-right" : "text-left"
                                  }`}
                                >
                                  {children}
                                </th>
                              );
                            },
                            tr: ({ children }) => (
                              <tr className="hover:bg-cyan-950/20 transition-colors border-b border-[#232B35]/50 last:border-0">
                                {children}
                              </tr>
                            ),
                            td: ({ children }) => {
                              const rawText = extractText(children);
                              // Matches currency symbols, counts, percents, and integers/decimals
                              const isNumeric =
                                /^[₹$%\d\s,.-]+$/.test(rawText.trim()) &&
                                /[0-9]/.test(rawText);
                              return (
                                <td
                                  className={`px-4 py-2.5 text-zinc-350 border-b border-[#232B35]/30 last:border-0 ${
                                    isNumeric
                                      ? "font-mono text-right text-indigo-400"
                                      : "text-left text-zinc-300"
                                  }`}
                                >
                                  {children}
                                </td>
                              );
                            },
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex w-full justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 p-4 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm">
                    <span className="block text-[10px] uppercase font-bold tracking-wider mb-2 text-indigo-400 opacity-60">
                      Skylark Agent
                    </span>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="flex space-x-1.5">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200"></span>
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-300"></span>
                      </div>
                      <span>Thinking and querying Monday.com...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert Box */}
              {error && (
                <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-sm flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <span className="text-base">⚠️</span>
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-300 transition-colors text-xs font-bold uppercase tracking-wider px-2 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input / Control Area */}
      <footer className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur px-4 py-4 sm:px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                loading
                  ? "Waiting for agent response..."
                  : "Ask about pipelines, revenue status, data quality..."
              }
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-16 py-3.5 text-zinc-100 text-sm sm:text-base placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Send"}
            </button>
          </form>
          <div className="text-[10px] text-center text-zinc-500 mt-2 sm:text-left sm:pl-1">
            Data sourced in real-time from active monday.com pipelines.
          </div>
        </div>
      </footer>
    </div>
  );
}
