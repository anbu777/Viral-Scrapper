import { NextRequest, NextResponse } from "next/server";
import { updateScript, readScripts } from "@/lib/csv";
import { answerCallbackQuery, editMessageAfterAction } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle callback queries (inline button taps)
    const callbackQuery = body.callback_query;
    if (!callbackQuery) {
      return NextResponse.json({ ok: true });
    }

    const callbackQueryId = callbackQuery.id as string;
    const messageId = callbackQuery.message?.message_id as number;
    const data = callbackQuery.data as string; // e.g. "approve:abc123"

    const [action, scriptId] = data.split(":");
    if (!action || !scriptId) {
      return NextResponse.json({ ok: true });
    }

    // Find the script
    const scripts = readScripts();
    const script = scripts.find((s) => s.id === scriptId);

    if (!script) {
      await answerCallbackQuery(callbackQueryId, "Script not found.");
      return NextResponse.json({ ok: true });
    }

    // Apply action
    if (action === "approve") {
      updateScript(scriptId, { videoStatus: "approved" });
      await answerCallbackQuery(callbackQueryId, "Video approved!");
      await editMessageAfterAction(messageId, "approve", script.title);
    } else if (action === "reject") {
      updateScript(scriptId, { videoStatus: "rejected" });
      await answerCallbackQuery(callbackQueryId, "Video rejected.");
      await editMessageAfterAction(messageId, "reject", script.title);
    } else if (action === "regenerate") {
      updateScript(scriptId, {
        videoStatus: "idle",
        videoJobId: undefined,
        videoUrl: undefined,
        geminiCheck: undefined,
        claudeCheck: undefined,
      });
      await answerCallbackQuery(callbackQueryId, "Regeneration triggered — go to the app to restart.");
      await editMessageAfterAction(messageId, "regenerate", script.title);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram/webhook]", err);
    // Always return 200 to Telegram — otherwise it retries
    return NextResponse.json({ ok: true });
  }
}
