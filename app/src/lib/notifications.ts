/**
 * Unified notification dispatcher.
 * Sends alerts to all enabled channels: Telegram, Discord, Email.
 */

import { getProviderSettings } from "@/lib/app-settings";

export interface NotificationPayload {
  title: string;
  message: string;
  url?: string;
  platform?: string;
}

async function sendDiscord(payload: NotificationPayload, webhookUrl: string): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Virality System",
      embeds: [
        {
          title: payload.title,
          description: payload.message,
          url: payload.url,
          color: 0x84ff5c, // neon green
          footer: payload.platform ? { text: payload.platform } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {});
}

async function sendTelegram(payload: NotificationPayload, botToken: string, chatId: string): Promise<void> {
  const text = `*${payload.title}*\n${payload.message}${payload.url ? `\n\n[View →](${payload.url})` : ""}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {});
}

async function sendEmail(payload: NotificationPayload, resendKey: string, fromEmail: string, toEmail: string): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: payload.title,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #84ff5c;">${payload.title}</h2>
          <p style="font-size: 14px; color: #333;">${payload.message}</p>
          ${payload.url ? `<a href="${payload.url}" style="display: inline-block; padding: 10px 20px; background: #84ff5c; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">View Content</a>` : ""}
          ${payload.platform ? `<p style="color: #999; font-size: 12px; margin-top: 16px;">${payload.platform}</p>` : ""}
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {});
}

/**
 * Send notification to all enabled channels.
 * Best-effort: failures are silent so one channel doesn't block others.
 */
export async function sendAllNotifications(payload: NotificationPayload): Promise<void> {
  const settings = await getProviderSettings();
  const tasks: Promise<void>[] = [];

  if (settings.notifications.telegram.enabled && settings.notifications.telegram.botToken && settings.notifications.telegram.chatId) {
    tasks.push(sendTelegram(payload, settings.notifications.telegram.botToken, settings.notifications.telegram.chatId));
  }
  if (settings.notifications.discord.enabled && settings.notifications.discord.webhookUrl) {
    tasks.push(sendDiscord(payload, settings.notifications.discord.webhookUrl));
  }
  if (settings.notifications.email.enabled && settings.notifications.email.resendKey && settings.notifications.email.fromEmail && settings.notifications.email.toEmail) {
    tasks.push(sendEmail(
      payload,
      settings.notifications.email.resendKey,
      settings.notifications.email.fromEmail,
      settings.notifications.email.toEmail
    ));
  }

  await Promise.allSettled(tasks);
}
