"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { SmilePlus } from "lucide-react";
import { CHAT_EMOJI } from "@/lib/chat-shared";

export function EmojiReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Add reaction"
          // 24x24 as drawn. It ends a `gap-1` row of reaction chips, so the 44px
          // reach `tap-target` gives it on a coarse pointer extends into empty
          // space to the right rather than over the last chip.
          className="tap-target inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SmilePlus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 grid w-56 grid-cols-6 gap-1 rounded-nested border border-border bg-card p-2 shadow-floating inset-shadow-highlight data-[state=open]:animate-pop-in"
        >
          {CHAT_EMOJI.map((emoji) => (
            <PopoverPrimitive.Close asChild key={emoji}>
              <button
                type="button"
                onClick={() => onPick(emoji)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-lg transition-colors hover:bg-muted"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            </PopoverPrimitive.Close>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
