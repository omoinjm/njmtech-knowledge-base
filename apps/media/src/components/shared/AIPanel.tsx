"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseTranscript } from "@/lib/parseTranscript";
import { useNotes } from "@/hooks/useNotes";
import { useTranscript } from "@/hooks/useTranscript";
import { useAIPills } from "@/hooks/useAIPills";
import type { AIPanelVariant } from "@/types/ai";
import type { VariantStyles } from "@/types/ui";

/**
 * Configuration for different visual variants of the AIPanel.
 */
const variantConfig: Record<AIPanelVariant, VariantStyles> = {
  card: {
    spacing: "px-4 py-3",
    pillTextSize: "text-xs",
    transcriptMaxH: "max-h-[280px]",
    answerPadding: "p-3",
  },
  popup: {
    spacing: "px-4 pt-3 pb-1",
    pillTextSize: "text-[11px]",
    transcriptMaxH: "max-h-[200px]",
    answerPadding: "p-2.5",
  },
};

/**
 * Prop interface for the AIPanel component.
 */
export interface AIPanelProps {
  /** Public URL for the markdown notes file */
  notesUrl: string | null;
  /** Public URL for the raw transcript text file */
  transcriptUrl: string | null;
  /** Original video URL (used for context) */
  videoUrl: string;
  /** Video title (used for context in AI generation) */
  title: string;
  /** Whether the panel is expanded/visible */
  enabled: boolean;
  /** Visual style variant */
  variant?: AIPanelVariant;
  /** Injected server action for generating questions */
  onGenerateQuestions: (transcript: string, title: string) => Promise<string[]>;
  /** Injected server action for answering a question */
  onAnswerQuestion: (question: string, transcript: string, title: string) => Promise<string>;
}

/**
 * AI-powered panel showing notes preview, suggested question pills,
 * inline answers, and a collapsible raw transcript viewer.
 *
 * @example
 * <AIPanel
 *   transcriptUrl={item.transcriptUrl}
 *   notesUrl={item.notesUrl}
 *   videoUrl={item.url}
 *   title={item.title}
 *   variant="card"
 *   enabled={isOpen}
 *   onGenerateQuestions={generateTranscriptQuestions}
 *   onAnswerQuestion={answerTranscriptQuestion}
 * />
 */
export const AIPanel: React.FC<AIPanelProps> = ({
  notesUrl,
  transcriptUrl,
  title,
  enabled,
  variant = "popup",
  onGenerateQuestions,
  onAnswerQuestion,
}) => {
  const styles = variantConfig[variant];
  const notesState = useNotes(notesUrl);
  const transcriptState = useTranscript(transcriptUrl, enabled);
  const [transcriptVisible, setTranscriptVisible] = useState(false);

  const {
    questions,
    isLoadingQuestions,
    activeQuestion,
    answer,
    isLoadingAnswer,
    handleQuestionClick,
  } = useAIPills({
    transcript: transcriptState.status === "success" ? transcriptState.data : null,
    title,
    enabled,
    onGenerateQuestions,
    onAnswerQuestion,
  });

  const parsedLines = useMemo(() => {
    if (transcriptState.status === "success") {
      return parseTranscript(transcriptState.data);
    }
    return [];
  }, [transcriptState]);

  return (
    <div className={styles.spacing}>
      {/* Notes Preview */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 font-semibold mb-2">
          Notes Preview
        </p>
        <div className="text-ellipsis prose prose-invert prose-sm text-[12px] leading-relaxed text-white/80">
          {notesState.status === "loading" ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full bg-emerald-500/10 rounded" />
              <div className="h-3 w-4/5 bg-emerald-500/10 rounded" />
            </div>
          ) : notesState.status === "success" ? (
            <ReactMarkdown>
              {notesState.data.slice(0, 300) + (notesState.data.length >= 300 ? "..." : "")}
            </ReactMarkdown>
          ) : (
            <span className="text-[12px] text-white/40 italic">No notes available</span>
          )}
        </div>
      </div>

      {/* AI Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={11} className="text-emerald-400" />
        <span className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-semibold">
          Ask about this video
        </span>
      </div>

      {/* Question Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {isLoadingQuestions || transcriptState.status === "loading" ? (
          [88, 112, 96, 124].map((w, i) => (
            <div
              key={i}
              className="h-6 rounded-full bg-emerald-500/10 animate-pulse"
              style={{ width: w }}
            />
          ))
        ) : questions.length > 0 ? (
          questions.map((q) => (
            <button
              key={q}
              onClick={() => handleQuestionClick(q)}
              className={`${styles.pillTextSize} px-2.5 py-1 rounded-full border transition-all duration-150 text-left ${
                activeQuestion === q
                  ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-300"
                  : "bg-transparent border-emerald-500/25 text-emerald-400/70 hover:border-emerald-400/40 hover:text-emerald-300"
              }`}
            >
              {q}
            </button>
          ))
        ) : transcriptState.status === "success" ? (
          <span className="text-[11px] text-white/40 italic">No questions could be generated.</span>
        ) : transcriptState.status === "error" ? (
          <span className="text-[11px] text-red-400/60 italic">Failed to load context for AI.</span>
        ) : null}
      </div>

      {/* Answer Area */}
      <AnimatePresence>
        {(isLoadingAnswer || answer) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-3 overflow-hidden"
          >
            {isLoadingAnswer ? (
              <div
                className={`space-y-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 ${styles.answerPadding}`}
              >
                {[100, 80, 60].map((w, i) => (
                  <div
                    key={i}
                    className="h-2.5 bg-emerald-500/10 rounded animate-pulse"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            ) : (
              <p
                className={`text-xs text-white/70 leading-relaxed bg-emerald-500/5 border border-emerald-500/15 rounded-lg ${styles.answerPadding}`}
              >
                {answer}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript Toggle */}
      {transcriptState.status === "success" && (
        <button
          onClick={() => setTranscriptVisible((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] text-emerald-500/40 hover:text-emerald-400/70 transition-colors mb-2"
        >
          <ChevronRight
            size={11}
            className={`transition-transform duration-200 ${transcriptVisible ? "rotate-90" : ""}`}
          />
          {transcriptVisible ? "Hide transcript" : "View raw transcript"}
        </button>
      )}

      {/* Raw Transcript Content */}
      <AnimatePresence>
        {transcriptVisible && parsedLines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-2"
          >
            <div
              className={`overflow-y-auto ${styles.transcriptMaxH} space-y-2 border-t border-emerald-500/10 pt-3 pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20`}
            >
              {parsedLines.map((line, i) => (
                <div key={i} className="flex gap-2 text-xs leading-relaxed group">
                  {line.timestamp && (
                    <span className="shrink-0 font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] h-fit mt-0.5">
                      {line.timestamp}
                    </span>
                  )}
                  <span className="text-white/65 group-hover:text-white transition-colors">
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
