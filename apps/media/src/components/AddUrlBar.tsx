"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Link, Loader2 } from "lucide-react";

interface AddUrlBarProps {
  onAdd: (url: string) => void;
  isLoading?: boolean;
}

const AddUrlBar = ({ onAdd, isLoading = false }: AddUrlBarProps) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onAdd(url.trim());
    setUrl("");
  };

  return (
    <motion.form
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl items-center gap-2"
    >
      <div className="relative flex-1">
        <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube, TikTok, Instagram, Vimeo, or X URL…"
          disabled={isLoading}
          className="h-11 w-full rounded-lg border border-border bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-60"
        />
      </div>
      <motion.button
        whileHover={{ scale: isLoading ? 1 : 1.03 }}
        whileTap={{ scale: isLoading ? 1 : 0.97 }}
        type="submit"
        disabled={isLoading}
        className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {isLoading ? "Adding…" : "Add"}
      </motion.button>
    </motion.form>
  );
};

export default AddUrlBar;
