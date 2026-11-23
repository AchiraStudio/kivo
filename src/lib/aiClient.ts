import { aiTools, executeTool } from './aiTools';
import { useAuthStore, UserInfo } from '../store/AuthStore';
import { invoke, getSettings } from './api';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export async function getOpenAIApiKey(): Promise<string> {
  // 1. Check localStorage
  const localKey = localStorage.getItem('kivo_openai_api_key');
  if (localKey && localKey.trim()) return localKey.trim();

  // 2. Check DB settings
  try {
    const settings = await getSettings();
    const dbKey = settings.find((s: any) => s.key === 'openai_api_key')?.value;
    if (dbKey && dbKey.trim()) return dbKey.trim();
  } catch {}

  // 3. Fallback to Vite env
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();

  return '';
}

export async function getSelectedAIModel(): Promise<string> {
  const localModel = localStorage.getItem('kivo_ai_model');
  if (localModel && localModel.trim()) return localModel.trim();

  try {
    const settings = await getSettings();
    const dbModel = settings.find((s: any) => s.key === 'openai_model')?.value;
    if (dbModel && dbModel.trim()) return dbModel.trim();
  } catch {}

  return 'gpt-4o-mini';
}

function buildConversationPrompt(messages: ChatMessage[], user: UserInfo, branchId: string): ChatMessage[] {
  let conversation = [...messages];
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayIso = `${year}-${month}-${day}`;
  const todayReadable = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeReadable = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const systemContent = `Kamu adalah Kivo AI, asisten operasional untuk platform bisnis dan kasir Kivo (v1.5.5).
Pengguna: ${user.username} | Role: ${user.role} | Branch: ${branchId}
Waktu Saat Ini: ${todayReadable}, pukul ${timeReadable} (ISO: ${todayIso}).

KEMAMPUAN & ATURAN INPUT DATA MUDAH:
- Kamu memiliki akses penuh ke tool operasional: inventaris (tambah 1 barang atau bulk_add_items banyak barang sekaligus, edit barang/harga/HPP, stok masuk/keluar, stock opname), kategori & merk, supplier & terima barang langsung, pelanggan & rekam medis klinik, penjualan & laporan, promo, akuntansi (COA/akun, kas masuk/keluar, Laba Rugi, Neraca), serta tambah pengguna (add_user) dan buat workspace (create_workspace).
- Saat pengguna menginput data barang (1 atau banyak sekaligus): JANGAN bertanya berulang kali untuk field opsional (seperti SKU, rak, satuan, atau min_stock). Gunakan default cerdas (SKU otomatis, satuan "Pcs", min_stock 5, kategori/merk otomatis dibuat jika belum ada) lalu langsung eksekusi add_item atau bulk_add_items!
- Jika pengguna menyebutkan 2 barang atau lebih dalam satu pesan (termasuk daftar/tabel/baris), SELALU gunakan bulk_add_items agar selesai dalam 1 langkah.
- Untuk tanggal "hari ini", SELALU gunakan "${todayIso}" sebagai date_from dan date_to.
- Kamu TIDAK memiliki akses ke kontrol admin destruktif (reset database, hapus user, ubah hak akses/role permission, ubah konfigurasi cloud/API key). Jika diminta, tolak dengan sopan dan arahkan ke menu Pengaturan.
- Jawab singkat, jelas, gunakan Markdown (daftar/tabel ringkas untuk hasil input massal), dan jangan suruh pengguna mengerjakan manual jika kamu bisa langsung memanggil tool.`;

  const otherMsgs = conversation.filter(m => m.role !== 'system');
  const systemMsg: ChatMessage = {
    role: 'system',
    content: systemContent
  };

  // Keep last 14 messages while ensuring no orphan tool message at the start of recent list
  let recentMsgs = otherMsgs.slice(-14);
  while (recentMsgs.length > 0 && recentMsgs[0].role === 'tool') {
    recentMsgs.shift();
  }

  return [systemMsg, ...recentMsgs];
}

async function fetchChatCompletion(conversation: ChatMessage[], apiKey?: string): Promise<any> {
  const resolvedKey = apiKey || (await getOpenAIApiKey());
  const selectedModel = await getSelectedAIModel();

  try {
    return await invoke('send_ai_chat_request', {
      request: {
        model: selectedModel,
        messages: conversation,
        tools: aiTools,
        tool_choice: 'auto',
        api_key: resolvedKey || undefined,
      }
    });
  } catch (tauriError: any) {
    const errMsg = tauriError?.message || String(tauriError);

    // Fallback: If not invoke error, try browser fetch
    if (errMsg.includes('Command') && errMsg.includes('not found') && resolvedKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resolvedKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversation,
          tools: aiTools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI Error (${response.status}): ${errData.error?.message || response.statusText}`);
      }

      return await response.json();
    }

    throw new Error(errMsg);
  }
}

async function processToolCall(toolCall: any, user: UserInfo, branchId: string): Promise<ChatMessage> {
  const functionName = toolCall.function.name;
  const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
  
  let result;
  try {
    result = await executeTool(functionName, functionArgs, {
      branchId,
      userId: user.id,
      role: user.role
    });
  } catch (execError: any) {
    result = { error: execError.message || String(execError) };
  }

  let contentStr = JSON.stringify(result);
  if (contentStr.length > 3000) {
    contentStr = contentStr.substring(0, 3000) + '... (truncated)';
  }

  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: functionName,
    content: contentStr
  };
}

/**
 * Send a chat completion request to OpenAI with the current conversation history.
 * If the model returns a tool call, we execute it locally and send the result back (recursive loop).
 */
export async function sendChatRequest(messages: ChatMessage[], branchId: string): Promise<ChatMessage[]> {
  const { user } = useAuthStore.getState();
  if (!user) throw new Error('Not logged in');

  const apiKey = await getOpenAIApiKey();
  let conversation = buildConversationPrompt(messages, user, branchId);

  const data = await fetchChatCompletion(conversation, apiKey);
  const assistantMessage = data.choices[0].message;
  conversation.push(assistantMessage);

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type === 'function') {
        const toolMsg = await processToolCall(toolCall, user, branchId);
        conversation.push(toolMsg);
      }
    }
    return sendChatRequest(conversation, branchId);
  }

  return conversation;
}