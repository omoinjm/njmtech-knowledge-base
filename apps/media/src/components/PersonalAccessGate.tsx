"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { setupPersonalAccessKey, unlockPersonalRoute } from "@/app/actions";

interface PersonalAccessGateProps {
  hasKeyConfigured: boolean;
}

export default function PersonalAccessGate({ hasKeyConfigured }: PersonalAccessGateProps) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSetup = !hasKeyConfigured;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isSetup && key !== confirmKey) {
      setError("Keys do not match");
      return;
    }

    startTransition(async () => {
      const result = isSetup ? await setupPersonalAccessKey(key) : await unlockPersonalRoute(key);
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        return;
      }

      setKey("");
      setConfirmKey("");
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-glow)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSetup ? <KeyRound size={18} /> : <Lock size={18} />}
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">
              {isSetup ? "Set up personal access" : "Unlock personal dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSetup
                ? "Create the first access key for /omoinjm. The key will be stored as a hash in the database."
                : "Enter your access key to open the personal route."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="personal-access-key">
              Access key
            </label>
            <input
              id="personal-access-key"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={isPending}
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
          </div>

          {isSetup && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="confirm-personal-access-key">
                Confirm access key
              </label>
              <input
                id="confirm-personal-access-key"
                type="password"
                value={confirmKey}
                onChange={(event) => setConfirmKey(event.target.value)}
                disabled={isPending}
                className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : isSetup ? <KeyRound size={16} /> : <Lock size={16} />}
            {isSetup ? "Create access key" : "Unlock"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
