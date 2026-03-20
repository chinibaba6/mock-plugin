import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

const CommandType = { CHAT: 1 } as const;
const CommandInputType = { BUILT_IN: 1 } as const;
const CommandOptionType = { STRING: 3 } as const;

/**
 * Converts text to alternating case (one upper, one lower).
 * The starting case (upper or lower) is randomly chosen each time.
 * e.g. "google" -> "gOoGlE" or "GoOgLe"
 */
const mockText = (text: string): string => {
  let startUpper = Math.random() < 0.5;
  let letterIndex = 0;

  return text
    .split("")
    .map((char) => {
      if (/[a-zA-Z]/.test(char)) {
        const shouldUpper = startUpper ? letterIndex % 2 === 0 : letterIndex % 2 !== 0;
        letterIndex++;
        return shouldUpper ? char.toUpperCase() : char.toLowerCase();
      }
      return char;
    })
    .join("");
};

const getMessageActions = () => {
  const g = globalThis as any;
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

const sendMessage = async (
  channelId: string,
  content: string
): Promise<boolean> => {
  const MA = getMessageActions();
  if (!MA) return false;

  const msgObj = { content };
  const nonce = Date.now().toString();

  const attempts: Array<() => any> = [
    () => MA?.sendMessage?.(channelId, msgObj),
    () => MA?.sendMessage?.(channelId, msgObj, true),
    () => MA?.sendMessage?.(channelId, msgObj, undefined, { nonce }),
    () => MA?.createMessage?.(channelId, msgObj),
    () => MA?.createMessage?.(channelId, content),
    () => MA?.sendMessage?.(channelId, content),
    () => MA?.sendMessage?.(channelId, content, true),
    () =>
      MA.default?.createMessage
        ? MA.default.createMessage(channelId, msgObj)
        : undefined,
  ];

  for (const fn of attempts) {
    try {
      const res = fn();
      if (res && typeof res.then === "function") await res;
      return true;
    } catch {}
  }

  return false;
};

let unregister: (() => void) | undefined;

export default {
  onLoad() {
    unregister = registerCommand({
      name: "mock",
      displayName: "mock",
      description: "Converts text to random alternating case (e.g. gOoGlE)",
      displayDescription:
        "Converts text to random alternating case (e.g. gOoGlE)",
      options: [
        {
          name: "text",
          displayName: "text",
          description: "The text to mock",
          displayDescription: "The text to mock",
          type: CommandOptionType.STRING as number,
          required: true,
        },
      ],
      applicationId: "-1",
      id: "mock-command",
      inputType: CommandInputType.BUILT_IN as number,
      type: CommandType.CHAT as number,

      execute: async (args: any[], ctx: any) => {
        try {
          const textArg = args.find((a: any) => a.name === "text");
          const rawText: string = textArg?.value ?? "";

          if (!rawText.trim()) {
            showToast("Please provide some text to mock!");
            return null;
          }

          const mocked = mockText(rawText);
          const channelId =
            ctx?.channel?.id ?? ctx?.channelId ?? ctx?.message?.channel_id;

          if (channelId) {
            const ok = await sendMessage(channelId, mocked);
            if (ok) return null;
          }

          // Fallback: return as command response
          return { content: mocked };
        } catch (err) {
          showToast("Failed to send mocked message!");
          return null;
        }
      },
    });
  },

  onUnload() {
    unregister?.();
  },
};
