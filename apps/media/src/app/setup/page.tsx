"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cacheGuestConfigShareToken,
  importConfigFromFragment,
  saveGuestConfig,
} from "@/lib/guest-config";

type RestoreState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function getConfigTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get("cfg");
}

export default function SetupPage() {
  const [passphrase, setPassphrase] = useState("");
  const [state, setState] = useState<RestoreState>({
    status: "idle",
    message: "Enter the restore passphrase to import the saved Public settings.",
  });
  const token = useMemo(() => getConfigTokenFromHash(), []);

  const handleRestore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setState({
        status: "error",
        message: "This restore link is missing the saved settings payload.",
      });
      return;
    }

    if (passphrase.trim().length < 8) {
      setState({
        status: "error",
        message: "Enter the restore passphrase used when the QR code was created.",
      });
      return;
    }

    setState({
      status: "loading",
      message: "Restoring Public settings…",
    });

    try {
      const config = await importConfigFromFragment(token, passphrase.trim());
      await saveGuestConfig(config);
      cacheGuestConfigShareToken(token);
      setState({
        status: "success",
        message: "Public settings restored on this browser.",
      });
      setPassphrase("");
    } catch {
      setState({
        status: "error",
        message: "The passphrase is wrong or this restore link is invalid.",
      });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          {state.status === "loading" && <Loader2 className="animate-spin text-primary" />}
          {state.status === "success" && <CheckCircle2 className="text-primary" />}
          {state.status === "error" && <TriangleAlert className="text-destructive" />}
          <div>
            <h1 className="text-lg font-semibold text-foreground">Restore Public settings</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </div>

        <form onSubmit={handleRestore} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="restore-passphrase">
              Restore passphrase
            </label>
            <input
              id="restore-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Enter the passphrase used when sharing"
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {state.status !== "success" && (
            <Button type="submit" disabled={!token || state.status === "loading"}>
              {state.status === "loading" ? "Restoring…" : "Restore settings"}
            </Button>
          )}

          <Button asChild variant={state.status === "success" ? "default" : "outline"}>
            <Link href="/">Open Public dashboard</Link>
          </Button>
        </form>
      </div>
    </main>
  );
}
