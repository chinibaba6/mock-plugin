// src/index.ts
import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
var CommandType = { CHAT: 1 };
var CommandInputType = { BUILT_IN: 1 };
var CommandOptionType = { STRING: 3 };
var mockText = (text) => {
  let startUpper = Math.random() < 0.5;
  let letterIndex = 0;
  return text.split("").map((char) => {
    if (/[a-zA-Z]/.test(char)) {
      const shouldUpper = startUpper ? letterIndex % 2 === 0 : letterIndex % 2 !== 0;
      letterIndex++;
      return shouldUpper ? char.toUpperCase() : char.toLowerCase();
    }
    return char;
  }).join("");
};
var getMessageActions = () => {
  const g = globalThis;
  if (g?.MessageActions && typeof g.MessageActions === "object")
    return g.MessageActions;
  const bySendOnly = findByProps("sendMessage");
  if (bySendOnly) return bySendOnly;
  const bySendReceive = findByProps("sendMessage", "receiveMessage");
  if (bySendReceive) return bySendReceive;
  const byCreate = findByProps("createMessage", "getMessages");
  if (byCreate) return byCreate;
  return null;
};
var sendMessage = async (channelId, content) => {
  const MA = getMessageActions();
  if (!MA) return false;
  const msgObj = { content };
  const nonce = Date.now().toString();
  const attempts = [
    () => MA?.sendMessage?.(channelId, msgObj),
    () => MA?.sendMessage?.(channelId, msgObj, true),
    () => MA?.sendMessage?.(channelId, msgObj, void 0, { nonce }),
    () => MA?.createMessage?.(channelId, msgObj),
    () => MA?.createMessage?.(channelId, content),
    () => MA?.sendMessage?.(channelId, content),
    () => MA?.sendMessage?.(channelId, content, true),
    () => MA.default?.createMessage ? MA.default.createMessage(channelId, msgObj) : void 0
  ];
  for (const fn of attempts) {
    try {
      const res = fn();
      if (res && typeof res.then === "function") await res;
      return true;
    } catch {
    }
  }
  return false;
};
var unregister;
var index_default = {
  onLoad() {
    unregister = registerCommand({
      name: "mock",
      displayName: "mock",
      description: "Converts text to random alternating case (e.g. gOoGlE)",
      displayDescription: "Converts text to random alternating case (e.g. gOoGlE)",
      options: [
        {
          name: "text",
          displayName: "text",
          description: "The text to mock",
          displayDescription: "The text to mock",
          type: CommandOptionType.STRING,
          required: true
        }
      ],
      applicationId: "-1",
      id: "mock-command",
      inputType: CommandInputType.BUILT_IN,
      type: CommandType.CHAT,
      execute: async (args, ctx) => {
        try {
          const textArg = args.find((a) => a.name === "text");
          const rawText = textArg?.value ?? "";
          if (!rawText.trim()) {
            showToast("Please provide some text to mock!");
            return null;
          }
          const mocked = mockText(rawText);
          const channelId = ctx?.channel?.id ?? ctx?.channelId ?? ctx?.message?.channel_id;
          if (channelId) {
            const ok = await sendMessage(channelId, mocked);
            if (ok) return null;
          }
          return { content: mocked };
        } catch (err) {
          showToast("Failed to send mocked message!");
          return null;
        }
      }
    });
  },
  onUnload() {
    unregister?.();
  }
};
export {
  index_default as default
};
