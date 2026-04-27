import { useEffect, useRef } from "react";

type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutOptions {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  handler: ShortcutHandler,
  options: ShortcutOptions = {}
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        ctrlKey = false,
        metaKey = false,
        shiftKey = false,
        altKey = false,
        preventDefault = false,
      } = options;

      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        event.ctrlKey === ctrlKey &&
        event.metaKey === metaKey &&
        event.shiftKey === shiftKey &&
        event.altKey === altKey
      ) {
        // Don't trigger if user is typing in an input or textarea
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement)?.isContentEditable
        ) {
          // Exception: if the shortcut is meant to focus the input, we might want to allow it?
          // But usually we don't want 'v' to toggle view while typing in the search bar.
          // However, if the key is Escape, we might want it.
          if (event.key !== "Escape") {
            return;
          }
        }

        if (preventDefault) {
          event.preventDefault();
        }
        handlerRef.current(event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, options.ctrlKey, options.metaKey, options.shiftKey, options.altKey, options.preventDefault]);
}
