"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines, ChevronDown, CircleHelp, Compass, Image as ImageIcon, Lightbulb, Menu, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PenLine, Plus, Search, Sparkles, SquarePen, Trash2, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[] };
const prompts = [
  { icon: ImageIcon, label: "Create an image", color: "#d47d54", prompt: "Help me create an image of " },
  { icon: PenLine, label: "Help me write", color: "#ad75b3", prompt: "Help me write " },
  { icon: Lightbulb, label: "Brainstorm", color: "#e5ae58", prompt: "Help me brainstorm ideas for " },
  { icon: Compass, label: "Make a plan", color: "#72a9cf", prompt: "Help me make a plan for " },
];
const newChat = (): Chat => ({ id: crypto.randomUUID(), title: "New chat", messages: [] });

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const current = chats.find(c => c.id === active);
  useEffect(() => { try { const stored = localStorage.getItem("chatspace-history"); if (stored) setChats(JSON.parse(stored)); } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem("chatspace-history", JSON.stringify(chats)); }, [chats, ready]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [current?.messages, loading]);
  function startNew() { setActive(null); setText(""); setSearch(false); input.current?.focus(); }
  async function send(e?: React.FormEvent) {
    e?.preventDefault(); const content = text.trim(); if (!content || loading) return;
    const chat = current || newChat(); const messages: Message[] = [...chat.messages, { role: "user", content }];
    const updated = { ...chat, title: chat.messages.length ? chat.title : content.slice(0, 42), messages };
    setChats(prev => [updated, ...prev.filter(c => c.id !== chat.id)]); setActive(chat.id); setText(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
      const data = await res.json();
      const answer = res.ok ? data.message : data.error || "Something went wrong. Please try again.";
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, messages: [...c.messages, { role: "assistant", content: answer }] } : c));
    } catch { setChats(prev => prev.map(c => c.id === chat.id ? { ...c, messages: [...c.messages, { role: "assistant", content: "Couldn’t connect. Please check your connection and try again." }] } : c)); }
    finally { setLoading(false); }
  }
  return <div className="app">
    {sidebar && <aside className="sidebar">
      <div className="side-top"><button className="brand-mark" onClick={startNew} aria-label="New chat"><Sparkles size={19}/></button><button className="icon-button" onClick={() => setSidebar(false)} aria-label="Close sidebar"><PanelLeftClose size={20}/></button></div>
      <nav className="nav"><button onClick={startNew}><SquarePen size={18}/> New chat <span className="shortcut">⌘ K</span></button><button onClick={() => setSearch(true)}><Search size={18}/> Search chats</button><button onClick={() => { setText("Help me explore ideas for "); input.current?.focus(); }}><Compass size={18}/> Explore ideas</button></nav>
      <div className="history"><p>Your chats</p>{chats.length === 0 ? <div className="history-empty">Your conversations will appear here</div> : chats.map(chat => <div className={`history-item ${active === chat.id ? "selected" : ""}`} key={chat.id}><button className="chat-link" onClick={() => { setActive(chat.id); if (window.innerWidth < 700) setSidebar(false); }}>{chat.title}</button><button className="delete" aria-label={`Delete ${chat.title}`} onClick={() => { setChats(chats.filter(c => c.id !== chat.id)); if (active === chat.id) setActive(null); }}><Trash2 size={15}/></button></div>)}</div>
      <div className="side-bottom"><div className="profile-avatar">S</div><div><strong>Personal workspace</strong><span>Free plan</span></div><MoreHorizontal size={18}/></div>
    </aside>}
    <main className="main"><header className="topbar"><div className="top-left">{!sidebar && <button className="icon-button" aria-label="Open sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen size={20}/></button>}<button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setSidebar(!sidebar)}><Menu size={20}/></button><button className="model">ChatGPT <ChevronDown size={16}/></button></div><div className="top-right"><span className="preview-pill">YOUR AI ASSISTANT</span><button className="top-avatar" title="Personal workspace">S</button></div></header>
      <div className={`workspace ${current?.messages.length ? "has-messages" : ""}`}>
        {current?.messages.length ? <div className="conversation"><div className="conversation-inner">{current.messages.map((m, i) => <div className={`message ${m.role}`} key={i}>{m.role === "assistant" && <div className="assistant-avatar"><Sparkles size={15}/></div>}<div className="message-content">{m.content}</div></div>)}{loading && <div className="message assistant"><div className="assistant-avatar"><Sparkles size={15}/></div><div className="thinking">Thinking<span>•••</span></div></div>}<div ref={bottom}/></div></div> : <div className="welcome"><div className="welcome-icon"><Sparkles size={25}/></div><div className="eyebrow">A LITTLE HELP GOES A LONG WAY</div><h1>What’s on your mind?</h1><p>Ask anything, explore an idea, or make something new.</p></div>}
        <div className="composer-wrap"><form className="composer" onSubmit={send}><textarea ref={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything" rows={2} aria-label="Message"/><div className="composer-bottom"><div className="composer-tools"><span className="plus-icon"><Plus size={19}/></span><span className="tools-label">Anything is possible</span></div><div className="send-tools"><AudioLines size={19} className="audio-icon"/><button className="send" type="submit" disabled={!text.trim() || loading} aria-label="Send message"><ArrowUp size={19}/></button></div></div></form>
        {!current?.messages.length && <div className="suggestions">{prompts.map(({ icon: Icon, label, color, prompt }) => <button key={label} onClick={() => { setText(prompt); input.current?.focus(); }}><Icon size={16} color={color}/>{label}</button>)}</div>}
        </div>
      </div><footer>ChatGPT can make mistakes. Check important info. <button aria-label="About this app" title="This is an independent ChatGPT-inspired interface, not affiliated with OpenAI."><CircleHelp size={15}/></button></footer>
    </main>
    {search && <div className="modal-backdrop" onClick={() => setSearch(false)}><div className="search-modal" onClick={e => e.stopPropagation()}><div className="search-row"><Search size={19}/><input autoFocus placeholder="Search your chats..." value={query} onChange={e => setQuery(e.target.value)}/><button className="icon-button" onClick={() => setSearch(false)} aria-label="Close search"><X size={19}/></button></div><div className="search-results">{chats.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).map(c => <button key={c.id} onClick={() => { setActive(c.id); setSearch(false); }}><MessageSquare size={16}/>{c.title}</button>)}{!chats.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).length && <p>No conversations found</p>}</div></div></div>}
  </div>;
}
