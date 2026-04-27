"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useEffect } from "react";

interface Shortcut {
  key: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "personal" | "public";
}

const SHORTCUT_GROUPS: (mode: string) => ShortcutGroup[] = (mode) => [
  {
    title: "General",
    shortcuts: [
      { key: "/", description: "Focus Search / Add URL bar" },
      { key: "v", description: "Toggle between Grid and Graph view" },
      { key: "1-9", description: "Switch between category tabs" },
      { key: "s", description: mode === "public" ? "Open Public Mode settings" : "Settings (Public mode only)" },
      { key: "?", description: "Show keyboard shortcuts" },
      { key: "Esc", description: "Close modals / Blur search" },
    ],
  },
  {
    title: "Card Navigation (when focused)",
    shortcuts: [
      { key: "Tab", description: "Move between cards" },
      { key: "Enter", description: "Play video / Open link" },
      { key: "t", description: "Toggle Transcript" },
      { key: "n", description: "Toggle Notes" },
      { key: "a", description: "Toggle AI Ask panel" },
      { key: "Del", description: "Hide / Delete item" },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose, mode }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Keyboard size={18} />
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {SHORTCUT_GROUPS(mode).map((group) => (
                <div key={group.title}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h3>
                  <div className="space-y-3">
                    {group.shortcuts.map((shortcut) => (
                      <div key={shortcut.key} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-foreground/80">{shortcut.description}</span>
                        <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-border pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Press any key or click outside to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
