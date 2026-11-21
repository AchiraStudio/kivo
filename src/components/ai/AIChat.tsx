import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Loader2, Minimize2, Maximize2, Trash2, Copy, Check, X, BarChart3, Package, Gift, Key, MessageSquare, PlusCircle, Boxes, Cpu } from 'lucide-react';
import { ChatMessage, sendChatRequest, getOpenAIApiKey, getSelectedAIModel } from '../../lib/aiClient';
import * as api from '../../lib/api';
import { isDesktopTauri } from '../../lib/runtime';
import { useAuthStore } from '../../store/AuthStore';
import { toast } from '../ui/Toast';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import { useMobileBack } from '../../hooks/useMobileBack';

const CHAT_HISTORY_KEY = 'kivo_chat_history';
const LEGACY_CHAT_HISTORY_KEY = 'achira_chat_history';

const formatMessageContent = (text: string) => {
  if (!text) return { __html: '' };

  const formatted = text
    .replace(/`([^`]+)`/g, '<code class="bg-muted text-primary px-1.5 py-0.5 rounded text-xs font-mono border border-line">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-heading">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-heading">$1</em>');

  const lines = formatted.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      resultLines.push('<div class="h-1.5"></div>');
      continue;
    }

    if (trimmed.startsWith('### ')) {
      resultLines.push(`<h3 class="text-xs font-bold text-heading mt-2.5 mb-1">${trimmed.slice(4)}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      resultLines.push(`<h2 class="text-sm font-bold text-heading mt-3 mb-1.5">${trimmed.slice(3)}</h2>`);
      continue;
    }

    const numMatch = rawLine.match(/^(\s*)([0-9]+)\.\s+(.*$)/);
    if (numMatch) {
      resultLines.push(
        `<div class="flex items-start gap-1.5 my-1 text-heading"><span class="font-bold text-primary shrink-0 tnum">${numMatch[2]}.</span><div class="flex-1">${numMatch[3]}</div></div>`
      );
      continue;
    }

    const bulletMatch = rawLine.match(/^(\s*)[\-\*•]\s+(.*$)/);
    if (bulletMatch) {
      resultLines.push(
        `<div class="flex items-start gap-2 ml-2 my-0.5 text-heading"><span class="text-dim shrink-0 select-none">•</span><div class="flex-1 leading-relaxed">${bulletMatch[2]}</div></div>`
      );
      continue;
    }

    resultLines.push(`<div class="text-heading leading-relaxed">${rawLine}</div>`);
  }

  return { __html: resultLines.join('') };
};

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

export default function AIChat({ isOpen, onClose, branchId }: AIChatProps) {
  useMobileBack(isOpen, onClose);
  const { user } = useAuthStore();
  const [mcpStatus, setMcpStatus] = useState<api.McpStatus | null>(null);

  useEffect(() => {
    if (!isOpen || !isDesktopTauri()) return;
    api.getMcpStatus().then(setMcpStatus).catch(() => {});
  }, [isOpen]);
  const storageKey = `${CHAT_HISTORY_KEY}_${user?.id || 'guest'}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved =
        localStorage.getItem(storageKey) ||
        localStorage.getItem(`${LEGACY_CHAT_HISTORY_KEY}_${user?.id || 'guest'}`);
      if (saved) return JSON.parse(saved) as ChatMessage[];
    } catch {}
    return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{ items: any[] } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [savingSettings, setSavingSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      getOpenAIApiKey().then(k => setApiKeyInput(k));
      getSelectedAIModel().then(m => setSelectedModel(m));
    }
  }, [isOpen]);

  const handleSaveAISettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const cleanKey = apiKeyInput.trim();
      localStorage.setItem('kivo_openai_api_key', cleanKey);
      localStorage.setItem('kivo_ai_model', selectedModel);
      try {
        await api.setSetting('openai_api_key', cleanKey);
        await api.setSetting('openai_model', selectedModel);
      } catch {}
      toast.success('Pengaturan AI tersimpan');
      setShowSettings(false);
    } catch (err: any) {
      toast.error(`Gagal menyimpan: ${err.message || err}`);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    try {
      const toSave = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !confirmClear) {
        if (showSettings) setShowSettings(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, showSettings, confirmClear, onClose]);

  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSendPrompt = (promptText: string) => {
    setInput(promptText);
    setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const handleSubmit = async (_e?: React.MouseEvent | React.KeyboardEvent | null, overrideInput?: string) => {
    const textToSubmit = overrideInput !== undefined ? overrideInput : input;
    if (!textToSubmit.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: textToSubmit.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const finalConversation = await sendChatRequest(newMessages, branchId);

      let foundPreview = null;
      for (const m of finalConversation) {
        if (m.role === 'tool' && m.content) {
          try {
            const data = JSON.parse(m.content);
            if (data.requires_user_approval && data.action === 'preview_bulk_opname') {
              foundPreview = { items: data.items };
            }
          } catch {}
        }
      }
      if (foundPreview) setPendingPreview(foundPreview);

      const filteredMessages = finalConversation.filter(m => {
        if (m.role === 'system' || m.role === 'tool') return false;
        if (m.role === 'assistant' && !m.content) return false;
        return true;
      });

      const combinedMessages: ChatMessage[] = [];
      for (const msg of filteredMessages) {
        if (
          msg.role === 'assistant' &&
          combinedMessages.length > 0 &&
          combinedMessages[combinedMessages.length - 1].role === 'assistant'
        ) {
          combinedMessages[combinedMessages.length - 1].content += '\n\n' + msg.content;
        } else {
          const cleanMsg = { ...msg };
          delete cleanMsg.tool_calls;
          combinedMessages.push(cleanMsg);
        }
      }

      setMessages(combinedMessages);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `**Error:** ${error.message || 'Terjadi kesalahan sistem.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(prev => (prev === idx ? null : prev)), 2000);
  };

  const confirmClearHistory = () => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setConfirmClear(false);
  };

  const handleApprovePreview = async () => {
    if (!pendingPreview || !pendingPreview.items) return;
    setLoading(true);
    try {
      const sessionId = await api.createOpnameSession(branchId, user?.id || 'guest', 'AI Bulk Adjustment');
      await api.submitOpnameLines(sessionId, pendingPreview.items);
      await api.finalizeOpname(sessionId);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: 'Penyesuaian stok disetujui.' },
      ]);
      setPendingPreview(null);
      handleSubmit(null, 'Penyesuaian stok telah diterapkan.');
    } catch (e: any) {
      toast.error(`Gagal menerapkan stok: ${e.message || e}`);
      setLoading(false);
    }
  };

  const handleRejectPreview = () => {
    setPendingPreview(null);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: 'Penyesuaian stok dibatalkan.' },
    ]);
  };

  const visibleMessages = messages.filter(
    m => (m.role === 'user' || m.role === 'assistant') && m.content
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/45 sm:hidden animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-label="Kivo AI"
        className={`fixed z-[110] bottom-0 right-0 sm:bottom-4 sm:right-4 bg-elevated sm:rounded-xl rounded-t-xl shadow-lg shadow-black/15 dark:shadow-black/45 border border-line flex flex-col overflow-hidden transition-[width,height] duration-150 ${
          isExpanded
            ? 'w-full sm:w-[580px] h-[90dvh] sm:h-[680px] sm:max-h-[calc(100dvh-2rem)]'
            : 'w-full sm:w-[400px] h-[82dvh] sm:h-[580px] sm:max-h-[calc(100dvh-2rem)]'
        } animate-pop-in`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-elevated shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={16} className="text-primary shrink-0" />
            <h2 className="font-bold text-heading text-sm truncate">Kivo AI</h2>
            {mcpStatus?.running && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success-soft text-success text-[10px] font-semibold tnum shrink-0"
                title={`MCP Server aktif di ${mcpStatus.url}`}
              >
                <Cpu size={10} />
                MCP · {mcpStatus.tool_count}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Pengaturan API Key"
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
              title="API Key & Model"
            >
              <Key size={14} />
            </button>
            {visibleMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                aria-label="Hapus riwayat"
                className="w-7 h-7 flex items-center justify-center text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer"
                title="Hapus riwayat"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Kecilkan' : 'Perbesar'}
              className="hidden sm:flex w-7 h-7 items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
              title={isExpanded ? 'Kecilkan' : 'Perbesar'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
              title="Tutup (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Inline API Settings */}
        {showSettings && (
          <div className="absolute inset-0 z-30 bg-black/45 p-4 flex items-center justify-center animate-fade-in">
            <form
              onSubmit={handleSaveAISettings}
              className="w-full bg-elevated rounded-xl border border-line shadow-lg p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h3 className="font-bold text-heading text-sm">Pengaturan OpenAI</h3>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  aria-label="Tutup"
                  className="w-7 h-7 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading block">API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full h-9 bg-input border border-line rounded-lg px-3 text-xs font-mono text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading block">Model</label>
                <Select value={selectedModel} onChange={(v) => setSelectedModel(v)} className="w-full">
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={savingSettings}>
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/60 custom-scrollbar">
          {visibleMessages.length === 0 && (
            <div className="flex flex-col justify-center h-full px-1 py-4 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-heading">Halo, {user?.name || 'Admin'}</h3>
                <p className="text-xs text-dim mt-0.5">Pilih perintah cepat atau ketik pertanyaan.</p>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setInput('Tambah barang baru:\n1. Paracetamol 500mg | harga 5000 | modal 3000 | stok 50 | kategori Obat\n2. Vitamin C 1000mg | harga 15000 | modal 10000 | stok 30 | kategori Vitamin')}
                  className="w-full px-3 py-2.5 bg-card hover:bg-muted border border-line rounded-lg transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <PlusCircle size={15} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-heading block">Input banyak barang sekaligus</span>
                    <span className="text-[11px] text-dim block truncate">Ketik daftar barang, harga, dan stok — SKU & kategori otomatis</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInput('Update stok barang: ')}
                  className="w-full px-3 py-2.5 bg-card hover:bg-muted border border-line rounded-lg transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Boxes size={15} className="text-dim shrink-0" />
                  <span className="text-xs font-semibold text-heading">Edit / tambah stok cepat</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendPrompt('Tampilkan ringkasan penjualan hari ini')}
                  className="w-full px-3 py-2.5 bg-card hover:bg-muted border border-line rounded-lg transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <BarChart3 size={15} className="text-dim shrink-0" />
                  <span className="text-xs font-semibold text-heading">Ringkasan penjualan hari ini</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendPrompt('Cek produk yang stoknya di bawah batas minimum')}
                  className="w-full px-3 py-2.5 bg-card hover:bg-muted border border-line rounded-lg transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Package size={15} className="text-dim shrink-0" />
                  <span className="text-xs font-semibold text-heading">Cek stok menipis</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendPrompt('Rekomendasikan promo bundle dari produk terlaris')}
                  className="w-full px-3 py-2.5 bg-card hover:bg-muted border border-line rounded-lg transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Gift size={15} className="text-dim shrink-0" />
                  <span className="text-xs font-semibold text-heading">Ide promo bundle</span>
                </button>
              </div>
            </div>
          )}

          {visibleMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 border ${
                    isUser
                      ? 'bg-muted text-heading border-line'
                      : 'bg-primary-soft text-primary border-primary/20'
                  }`}
                >
                  {isUser ? <User size={13} /> : <MessageSquare size={13} />}
                </div>

                <div
                  className={`relative group text-xs leading-relaxed ${
                    isUser
                      ? 'bg-primary text-white rounded-xl px-3.5 py-2.5 max-w-[82%]'
                      : 'bg-card border border-line text-heading rounded-xl px-3.5 py-2.5 max-w-[85%]'
                  }`}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <>
                      <div
                        className="whitespace-pre-wrap space-y-0.5"
                        dangerouslySetInnerHTML={formatMessageContent(msg.content || '')}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content || '', idx)}
                        aria-label="Salin jawaban"
                        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 bg-muted hover:bg-muted-hover text-dim hover:text-heading rounded transition-opacity cursor-pointer"
                        title="Salin"
                      >
                        {copiedIdx === idx ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>

                      {(msg.content?.includes('API Key') ||
                        msg.content?.includes('Error') ||
                        msg.content?.includes('401') ||
                        msg.content?.includes('Unauthorized')) && (
                        <div className="mt-2 pt-2 border-t border-line">
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                            <Key size={12} />
                            Atur API Key
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-primary-soft text-primary border border-primary/20 flex items-center justify-center">
                <Loader2 size={13} className="animate-spin" />
              </div>
              <div className="bg-card border border-line rounded-xl px-3.5 py-2 text-xs text-dim">
                Memproses...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Opname Preview Approval */}
        {pendingPreview && (
          <div className="p-3 bg-elevated border-t border-line shrink-0 space-y-2">
            <p className="font-semibold text-xs text-heading">Konfirmasi penyesuaian stok</p>
            <div className="max-h-28 overflow-y-auto custom-scrollbar bg-muted/40 rounded-lg p-2 border border-line">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line text-dim">
                    <th className="pb-1">Item</th>
                    <th className="pb-1">Qty</th>
                    <th className="pb-1">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPreview.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-line/50 last:border-0">
                      <td className="py-1 font-mono">{it.item_id.substring(0, 8)}</td>
                      <td className="py-1 font-semibold text-heading tnum">{it.actual_qty}</td>
                      <td className="py-1 text-dim">{it.batch_no || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleRejectPreview}>
                Tolak
              </Button>
              <Button variant="primary" size="sm" onClick={handleApprovePreview}>
                Terapkan
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-elevated border-t border-line shrink-0">
          <div className="flex items-end gap-1.5 bg-input border border-line rounded-lg p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pertanyaan..."
              disabled={loading}
              autoFocus
              rows={1}
              className="flex-1 resize-none bg-transparent border-none px-2 py-1 text-xs text-heading outline-none placeholder:text-dim disabled:opacity-50 overflow-y-auto leading-relaxed custom-scrollbar"
              style={{ minHeight: '32px', maxHeight: '100px' }}
            />
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}
              disabled={!input.trim() || loading}
              aria-label="Kirim pesan"
              className="shrink-0 w-8 h-8 bg-primary hover:bg-primary-hover text-white rounded-md disabled:opacity-40 transition-colors flex items-center justify-center cursor-pointer"
              title="Kirim"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      {confirmClear && (
        <ConfirmModal
          title="Hapus Riwayat Chat"
          message="Semua pesan Kivo AI di perangkat ini akan dihapus."
          confirmLabel="Hapus"
          variant="danger"
          onConfirm={confirmClearHistory}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}
