/**
 * Telegram Bot client for human-in-the-loop video approval.
 */

const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return token;
}

function getChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID not set");
  return chatId;
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const token = getToken();
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram ${method} error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Sends the generated video to Telegram for human approval.
 * Includes inline approve/reject/regenerate buttons.
 */
export async function sendVideoForApproval(params: {
  videoUrl: string;
  videoBuffer?: Buffer;
  scriptTitle: string;
  scriptId: string;
  videoCreator: string;
  videoViews: number;
}): Promise<number> {
  const { videoUrl, videoBuffer, scriptTitle, scriptId, videoCreator, videoViews } = params;
  const chatId = getChatId();
  const token = getToken();

  const caption = [
    `🎬 *New Video Ready for Review*`,
    ``,
    `📝 *Script:* ${escapeMarkdown(scriptTitle)}`,
    `👤 *Based on:* @${escapeMarkdown(videoCreator)} (${formatViews(videoViews)} views)`,
  ].join("\n");

  const inlineKeyboard = {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve:${scriptId}` },
      { text: "❌ Reject", callback_data: `reject:${scriptId}` },
      { text: "🔄 Regenerate", callback_data: `regenerate:${scriptId}` },
    ]],
  };

  // Upload buffer directly so Telegram receives a proper MP4 with audio
  if (videoBuffer) {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("video", new Blob([new Uint8Array(videoBuffer)], { type: "video/mp4" }), "video.mp4");
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");
    formData.append("reply_markup", JSON.stringify(inlineKeyboard));
    formData.append("supports_streaming", "true");

    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return (data as { result: { message_id: number } }).result.message_id;
    }
    console.warn(`[telegram] Buffer upload failed (${response.status}), falling back to URL`);
  }

  // Try sending by URL
  try {
    const result = await telegramRequest("sendVideo", {
      chat_id: chatId,
      video: videoUrl,
      caption,
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard,
      supports_streaming: true,
    });
    return result.result.message_id as number;
  } catch {
    // Last resort: send as message with link
    const result = await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: caption + `\n\n🔗 [Watch Video](${videoUrl})`,
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard,
    });
    return result.result.message_id as number;
  }
}

/**
 * Answers a Telegram callback query (removes loading spinner after button tap).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string
): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

/**
 * Edits the original message after a button is tapped — removes buttons, shows final status.
 */
export async function editMessageAfterAction(
  messageId: number,
  action: "approve" | "reject" | "regenerate",
  scriptTitle: string
): Promise<void> {
  const chatId = getChatId();

  const statusText: Record<string, string> = {
    approve: `✅ *Approved* — ${escapeMarkdown(scriptTitle)}\nVideo approved and marked as ready.`,
    reject: `❌ *Rejected* — ${escapeMarkdown(scriptTitle)}\nVideo rejected.`,
    regenerate: `🔄 *Regenerating* — ${escapeMarkdown(scriptTitle)}\nNew video generation started.`,
  };

  await telegramRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: statusText[action],
    parse_mode: "Markdown",
  });
}

/**
 * Sends a simple text notification to the Telegram chat.
 */
export async function sendNotification(text: string): Promise<void> {
  const chatId = getChatId();
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}
