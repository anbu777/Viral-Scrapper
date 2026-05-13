"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plug,
  Brain,
  Mic,
  Video,
  Bell,
  Clock,
  Instagram,
  Music2,
  Youtube,
  AlertCircle,
} from "lucide-react";
import type { ProviderSettings } from "@/lib/app-settings";

type TabKey = "scraping" | "ai" | "tts" | "video" | "notifications" | "schedule";

interface TestResult {
  ok: boolean;
  message: string;
}

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "scraping", label: "Scraping", icon: Plug },
  { key: "ai", label: "AI Models", icon: Brain },
  { key: "tts", label: "Voice / TTS", icon: Mic },
  { key: "video", label: "Video Gen", icon: Video },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "schedule", label: "Auto-Scrape", icon: Clock },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("scraping");
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings/providers")
      .then((r) => r.json())
      .then((d: ProviderSettings) => setSettings(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof ProviderSettings>(section: K, value: Partial<ProviderSettings[K]>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [section]: { ...prev[section], ...value } };
    });
    setSaved(false);
  };

  const updateNested = <K extends keyof ProviderSettings, S extends keyof ProviderSettings[K]>(
    section: K,
    subsection: S,
    value: Partial<ProviderSettings[K][S]>
  ) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const sectionData = prev[section] as Record<string, unknown>;
      return {
        ...prev,
        [section]: {
          ...sectionData,
          [subsection]: { ...(sectionData[subsection as string] as object), ...value },
        },
      };
    });
    setSaved(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const test = async (key: string, provider: string, config: Record<string, string | undefined>) => {
    setTesting((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, config }),
      });
      const result = (await res.json()) as TestResult;
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [key]: { ok: false, message: err instanceof Error ? err.message : "Network error" },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure all providers, API keys, and schedules from here. Changes apply immediately without restart.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-neon text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "scraping" && (
          <ScrapingTab
            settings={settings}
            updateNested={updateNested}
            test={test}
            testResults={testResults}
            testing={testing}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        )}
        {activeTab === "ai" && (
          <AiTab
            settings={settings}
            updateNested={updateNested}
            test={test}
            testResults={testResults}
            testing={testing}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        )}
        {activeTab === "tts" && (
          <TtsTab
            settings={settings}
            update={update}
            test={test}
            testResults={testResults}
            testing={testing}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        )}
        {activeTab === "video" && (
          <VideoTab
            settings={settings}
            update={update}
            test={test}
            testResults={testResults}
            testing={testing}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationsTab
            settings={settings}
            updateNested={updateNested}
            test={test}
            testResults={testResults}
            testing={testing}
            showSecrets={showSecrets}
            setShowSecrets={setShowSecrets}
          />
        )}
        {activeTab === "schedule" && <ScheduleTab settings={settings} updateNested={updateNested} />}
      </div>
    </div>
  );
}

// ─── Reusable Components ──────────────────────────────────────────────────────

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  show: boolean;
  onToggle: () => void;
}

function SecretInput({ value, onChange, placeholder, show, onToggle }: SecretInputProps) {
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl glass border-white/[0.08] h-10 pr-10 font-mono text-xs"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function TestButton({
  testKey,
  testResult,
  testing: isTestingNow,
  onTest,
}: {
  testKey: string;
  testResult?: TestResult;
  testing: boolean;
  onTest: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onTest}
        disabled={isTestingNow}
        className="rounded-lg h-8 text-xs glass border border-white/[0.06] gap-1.5"
      >
        {isTestingNow ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
        Test Connection
      </Button>
      {testResult && (
        <span
          className={`text-xs flex items-center gap-1.5 ${
            testResult.ok ? "text-emerald-400" : "text-red-400"
          }`}
          key={testKey}
        >
          {testResult.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {testResult.message}
        </span>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabProps {
  settings: ProviderSettings;
  test: (key: string, provider: string, config: Record<string, string | undefined>) => void;
  testResults: Record<string, TestResult>;
  testing: Record<string, boolean>;
  showSecrets: Record<string, boolean>;
  setShowSecrets: (v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
}

interface TabPropsWithUpdate extends TabProps {
  update: <K extends keyof ProviderSettings>(section: K, value: Partial<ProviderSettings[K]>) => void;
}

interface TabPropsWithUpdateNested extends TabProps {
  updateNested: <K extends keyof ProviderSettings, S extends keyof ProviderSettings[K]>(
    section: K,
    subsection: S,
    value: Partial<ProviderSettings[K][S]>
  ) => void;
}

function ScrapingTab({ settings, updateNested, test, testResults, testing, showSecrets, setShowSecrets }: TabPropsWithUpdateNested) {
  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  return (
    <>
      <ProviderCard title="Instagram" icon={Instagram}>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
          <Select
            value={settings.scraping.instagram.provider}
            onValueChange={(v) => updateNested("scraping", "instagram", { provider: v as "apify" | "playwright" | "manual" })}
          >
            <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apify">Apify (recommended)</SelectItem>
              <SelectItem value="playwright">Playwright (local, free)</SelectItem>
              <SelectItem value="manual">Manual import only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {settings.scraping.instagram.provider === "apify" && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Apify API Token</Label>
            <SecretInput
              value={settings.scraping.instagram.apifyToken || ""}
              onChange={(v) => updateNested("scraping", "instagram", { apifyToken: v })}
              placeholder="apify_api_..."
              show={showSecrets.ig_apify || false}
              onToggle={() => toggleSecret("ig_apify")}
            />
            <TestButton
              testKey="ig_apify"
              testResult={testResults.ig_apify}
              testing={testing.ig_apify || false}
              onTest={() => test("ig_apify", "apify", { apiKey: settings.scraping.instagram.apifyToken })}
            />
          </div>
        )}
      </ProviderCard>

      <ProviderCard title="TikTok" icon={Music2}>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
          <Select
            value={settings.scraping.tiktok.provider}
            onValueChange={(v) => updateNested("scraping", "tiktok", { provider: v as "apify_tiktok" | "ytdlp" })}
          >
            <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apify_tiktok">Apify TikTok Scraper (recommended)</SelectItem>
              <SelectItem value="ytdlp">yt-dlp (local, free)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {settings.scraping.tiktok.provider === "apify_tiktok" && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Apify API Token (shared with Instagram)</Label>
            <SecretInput
              value={settings.scraping.tiktok.apifyToken || ""}
              onChange={(v) => updateNested("scraping", "tiktok", { apifyToken: v })}
              placeholder="apify_api_..."
              show={showSecrets.tt_apify || false}
              onToggle={() => toggleSecret("tt_apify")}
            />
            <TestButton
              testKey="tt_apify"
              testResult={testResults.tt_apify}
              testing={testing.tt_apify || false}
              onTest={() => test("tt_apify", "apify_tiktok", { apiKey: settings.scraping.tiktok.apifyToken })}
            />
          </div>
        )}
        {settings.scraping.tiktok.provider === "ytdlp" && (
          <TestButton
            testKey="tt_ytdlp"
            testResult={testResults.tt_ytdlp}
            testing={testing.tt_ytdlp || false}
            onTest={() => test("tt_ytdlp", "ytdlp", {})}
          />
        )}
      </ProviderCard>

      <ProviderCard title="YouTube Shorts" icon={Youtube}>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
          <Select
            value={settings.scraping.youtube.provider}
            onValueChange={(v) => updateNested("scraping", "youtube", { provider: v as "youtube_api" | "ytdlp" })}
          >
            <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube_api">YouTube Data API v3 (free, recommended)</SelectItem>
              <SelectItem value="ytdlp">yt-dlp (local, free)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {settings.scraping.youtube.provider === "youtube_api" && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">YouTube API Key</Label>
            <SecretInput
              value={settings.scraping.youtube.apiKey || ""}
              onChange={(v) => updateNested("scraping", "youtube", { apiKey: v })}
              placeholder="AIza..."
              show={showSecrets.yt_api || false}
              onToggle={() => toggleSecret("yt_api")}
            />
            <TestButton
              testKey="yt_api"
              testResult={testResults.yt_api}
              testing={testing.yt_api || false}
              onTest={() => test("yt_api", "youtube_api", { apiKey: settings.scraping.youtube.apiKey })}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Get a free key at{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-neon hover:underline">
                Google Cloud Console
              </a>{" "}
              — 10,000 quota/day free
            </p>
          </div>
        )}
      </ProviderCard>
    </>
  );
}

function AiTab({ settings, updateNested, test, testResults, testing, showSecrets, setShowSecrets }: TabPropsWithUpdateNested) {
  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  return (
    <>
      <ProviderCard title="Video Analysis (Gemini)" icon={Brain}>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gemini API Key</Label>
          <SecretInput
            value={settings.ai.analysis.geminiKey || ""}
            onChange={(v) => updateNested("ai", "analysis", { geminiKey: v })}
            placeholder="AIza..."
            show={showSecrets.gemini || false}
            onToggle={() => toggleSecret("gemini")}
          />
          <TestButton
            testKey="gemini"
            testResult={testResults.gemini}
            testing={testing.gemini || false}
            onTest={() => test("gemini", "gemini", { apiKey: settings.ai.analysis.geminiKey })}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Get a free key at{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-neon hover:underline">
              Google AI Studio
            </a>{" "}
            — ~1500 free requests/day
          </p>
        </div>
      </ProviderCard>

      <ProviderCard title="Script Generation" icon={Brain}>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
          <Select
            value={settings.ai.scriptGen.provider}
            onValueChange={(v) => updateNested("ai", "scriptGen", { provider: v as "gemini" | "claude" | "ollama" })}
          >
            <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">Claude Sonnet (best quality)</SelectItem>
              <SelectItem value="gemini">Gemini 2.5 Flash (free)</SelectItem>
              <SelectItem value="ollama">Ollama (local, free)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {settings.ai.scriptGen.provider === "claude" && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Anthropic API Key</Label>
            <SecretInput
              value={settings.ai.scriptGen.claudeKey || ""}
              onChange={(v) => updateNested("ai", "scriptGen", { claudeKey: v })}
              placeholder="sk-ant-..."
              show={showSecrets.claude || false}
              onToggle={() => toggleSecret("claude")}
            />
            <TestButton
              testKey="claude"
              testResult={testResults.claude}
              testing={testing.claude || false}
              onTest={() => test("claude", "claude", { apiKey: settings.ai.scriptGen.claudeKey })}
            />
          </div>
        )}
      </ProviderCard>
    </>
  );
}

function TtsTab({ settings, update, test, testResults, testing, showSecrets, setShowSecrets }: TabPropsWithUpdate) {
  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  return (
    <ProviderCard title="Text-to-Speech" icon={Mic}>
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
        <Select
          value={settings.tts.provider}
          onValueChange={(v) => update("tts", { provider: v as "edge_tts" | "elevenlabs" | "openai_tts" })}
        >
          <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edge_tts">Edge TTS (free, 400+ voices)</SelectItem>
            <SelectItem value="elevenlabs">ElevenLabs (paid, voice cloning)</SelectItem>
            <SelectItem value="openai_tts">OpenAI TTS (paid)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {settings.tts.provider === "edge_tts" && (
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Voice</Label>
          <Input
            value={settings.tts.voice}
            onChange={(e) => update("tts", { voice: e.target.value })}
            placeholder="en-US-AriaNeural"
            className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 font-mono text-xs"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Examples: en-US-AriaNeural, en-US-GuyNeural, id-ID-GadisNeural
          </p>
        </div>
      )}
      {settings.tts.provider === "elevenlabs" && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">ElevenLabs API Key</Label>
            <SecretInput
              value={settings.tts.elevenLabsKey || ""}
              onChange={(v) => update("tts", { elevenLabsKey: v })}
              placeholder="sk_..."
              show={showSecrets.eleven || false}
              onToggle={() => toggleSecret("eleven")}
            />
            <TestButton
              testKey="eleven"
              testResult={testResults.eleven}
              testing={testing.eleven || false}
              onTest={() => test("eleven", "elevenlabs", { apiKey: settings.tts.elevenLabsKey })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Voice ID</Label>
            <Input
              value={settings.tts.elevenLabsVoiceId || ""}
              onChange={(e) => update("tts", { elevenLabsVoiceId: e.target.value })}
              placeholder="21m00Tcm4TlvDq8ikWAM"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 font-mono text-xs"
            />
          </div>
        </>
      )}
    </ProviderCard>
  );
}

function VideoTab({ settings, update, test, testResults, testing, showSecrets, setShowSecrets }: TabPropsWithUpdate) {
  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  return (
    <ProviderCard title="Video Generation" icon={Video}>
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
        <Select
          value={settings.video.provider}
          onValueChange={(v) => update("video", { provider: v as "none" | "fal" | "did" })}
        >
          <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Disabled (no video generation)</SelectItem>
            <SelectItem value="fal">fal.ai Kling 3.0</SelectItem>
            <SelectItem value="did">D-ID (avatar lipsync)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {settings.video.provider === "fal" && (
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">fal.ai API Key</Label>
          <SecretInput
            value={settings.video.falKey || ""}
            onChange={(v) => update("video", { falKey: v })}
            placeholder="fal-..."
            show={showSecrets.fal || false}
            onToggle={() => toggleSecret("fal")}
          />
          <TestButton
            testKey="fal"
            testResult={testResults.fal}
            testing={testing.fal || false}
            onTest={() => test("fal", "fal", { apiKey: settings.video.falKey })}
          />
        </div>
      )}
      {settings.video.provider === "did" && (
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">D-ID API Key</Label>
          <SecretInput
            value={settings.video.didKey || ""}
            onChange={(v) => update("video", { didKey: v })}
            placeholder="..."
            show={showSecrets.did || false}
            onToggle={() => toggleSecret("did")}
          />
        </div>
      )}
    </ProviderCard>
  );
}

function NotificationsTab({ settings, updateNested, test, testResults, testing, showSecrets, setShowSecrets }: TabPropsWithUpdateNested) {
  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));
  return (
    <>
      <ProviderCard
        title="Telegram Bot"
        icon={Bell}
        toggle={settings.notifications.telegram.enabled}
        onToggle={(v) => updateNested("notifications", "telegram", { enabled: v })}
      >
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bot Token</Label>
          <SecretInput
            value={settings.notifications.telegram.botToken || ""}
            onChange={(v) => updateNested("notifications", "telegram", { botToken: v })}
            placeholder="123456:AAH..."
            show={showSecrets.tg || false}
            onToggle={() => toggleSecret("tg")}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Chat ID</Label>
          <Input
            value={settings.notifications.telegram.chatId || ""}
            onChange={(e) => updateNested("notifications", "telegram", { chatId: e.target.value })}
            placeholder="123456789"
            className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 font-mono text-xs"
          />
        </div>
        <TestButton
          testKey="tg"
          testResult={testResults.tg}
          testing={testing.tg || false}
          onTest={() => test("tg", "telegram", { botToken: settings.notifications.telegram.botToken })}
        />
      </ProviderCard>

      <ProviderCard
        title="Discord Webhook"
        icon={Bell}
        toggle={settings.notifications.discord.enabled}
        onToggle={(v) => updateNested("notifications", "discord", { enabled: v })}
      >
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Webhook URL</Label>
          <SecretInput
            value={settings.notifications.discord.webhookUrl || ""}
            onChange={(v) => updateNested("notifications", "discord", { webhookUrl: v })}
            placeholder="https://discord.com/api/webhooks/..."
            show={showSecrets.discord || false}
            onToggle={() => toggleSecret("discord")}
          />
          <TestButton
            testKey="discord"
            testResult={testResults.discord}
            testing={testing.discord || false}
            onTest={() => test("discord", "discord", { webhookUrl: settings.notifications.discord.webhookUrl })}
          />
        </div>
      </ProviderCard>

      <ProviderCard
        title="Email (Resend)"
        icon={Bell}
        toggle={settings.notifications.email.enabled}
        onToggle={(v) => updateNested("notifications", "email", { enabled: v })}
      >
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Resend API Key</Label>
          <SecretInput
            value={settings.notifications.email.resendKey || ""}
            onChange={(v) => updateNested("notifications", "email", { resendKey: v })}
            placeholder="re_..."
            show={showSecrets.resend || false}
            onToggle={() => toggleSecret("resend")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">From Email</Label>
            <Input
              value={settings.notifications.email.fromEmail || ""}
              onChange={(e) => updateNested("notifications", "email", { fromEmail: e.target.value })}
              placeholder="alerts@yourdomain.com"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">To Email</Label>
            <Input
              value={settings.notifications.email.toEmail || ""}
              onChange={(e) => updateNested("notifications", "email", { toEmail: e.target.value })}
              placeholder="you@example.com"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 font-mono text-xs"
            />
          </div>
        </div>
      </ProviderCard>
    </>
  );
}

function ScheduleTab({
  settings,
  updateNested,
}: {
  settings: ProviderSettings;
  updateNested: <K extends keyof ProviderSettings, S extends keyof ProviderSettings[K]>(
    section: K,
    subsection: S,
    value: Partial<ProviderSettings[K][S]>
  ) => void;
}) {
  const platforms = [
    { key: "instagram" as const, label: "Instagram", icon: Instagram },
    { key: "tiktok" as const, label: "TikTok", icon: Music2 },
    { key: "youtube" as const, label: "YouTube", icon: Youtube },
  ];
  return (
    <>
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-100/90 leading-relaxed">
          Auto-scraping runs in the background. The scheduler will only scrape creators when their schedule is due — there&apos;s no separate cron needed.
        </p>
      </div>

      {platforms.map(({ key, label, icon: Icon }) => (
        <ProviderCard
          key={key}
          title={label}
          icon={Icon}
          toggle={settings.schedule[key].enabled}
          onToggle={(v) => updateNested("schedule", key, { enabled: v })}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Scrape Interval</Label>
              <Select
                value={settings.schedule[key].interval}
                onValueChange={(v) => updateNested("schedule", key, { interval: v as ProviderSettings["schedule"]["instagram"]["interval"] })}
              >
                <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Every 1 hour</SelectItem>
                  <SelectItem value="2h">Every 2 hours</SelectItem>
                  <SelectItem value="4h">Every 4 hours</SelectItem>
                  <SelectItem value="6h">Every 6 hours</SelectItem>
                  <SelectItem value="12h">Every 12 hours</SelectItem>
                  <SelectItem value="24h">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Videos per Scrape</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={settings.schedule[key].maxVideos}
                onChange={(e) => updateNested("schedule", key, { maxVideos: Number(e.target.value) })}
                className="mt-1.5 rounded-xl glass border-white/[0.08] h-10"
              />
            </div>
          </div>
        </ProviderCard>
      ))}

      <ProviderCard title="Viral Detection Threshold" icon={AlertCircle}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Multiplier vs Baseline</Label>
            <Input
              type="number"
              step={0.1}
              min={1}
              max={10}
              value={settings.schedule.viralThreshold}
              onChange={(e) => updateNested("schedule", "viralThreshold", Number(e.target.value) as never)}
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Video flagged viral when views &gt; {settings.schedule.viralThreshold}× creator&apos;s avg views
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Minimum Views</Label>
            <Input
              type="number"
              min={0}
              value={settings.schedule.minViews}
              onChange={(e) => updateNested("schedule", "minViews", Number(e.target.value) as never)}
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10"
            />
          </div>
        </div>
      </ProviderCard>
    </>
  );
}

interface ProviderCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  toggle?: boolean;
  onToggle?: (value: boolean) => void;
}

function ProviderCard({ title, icon: Icon, children, toggle, onToggle }: ProviderCardProps) {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 border border-neon/20">
            <Icon className="h-4 w-4 text-neon" />
          </div>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {onToggle !== undefined && (
          <button onClick={() => onToggle(!toggle)} className="relative">
            <div className={`h-5 w-9 rounded-full transition-colors ${toggle ? "bg-neon" : "bg-white/[0.08]"}`} />
            <div
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                toggle ? "translate-x-4" : ""
              }`}
            />
          </button>
        )}
        {onToggle !== undefined && (
          <Badge
            variant="secondary"
            className={`rounded-md text-[10px] ${
              toggle ? "bg-neon/15 text-neon border-neon/25" : "bg-white/[0.05] border-white/[0.06] text-muted-foreground"
            }`}
          >
            {toggle ? "Enabled" : "Disabled"}
          </Badge>
        )}
      </div>
      {(toggle === undefined || toggle) && <div className="space-y-3">{children}</div>}
    </div>
  );
}
