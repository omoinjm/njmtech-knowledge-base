"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, Send, X as CloseIcon, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  const [manualQuestion, setManualQuestion] = useState("");

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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestion.trim() || isLoadingAnswer) return;
    handleQuestionClick(manualQuestion);
    setManualQuestion("");
  };

  const parsedLines = useMemo(() => {
    if (transcriptState.status === "success") {
      return parseTranscript(transcriptState.data);
    }
    return [];
  }, [transcriptState]);

  // Extract summary from notes if available
  const transcriptSummary = notesState.status === "success"
    ? (notesState.data.match(/#+ Summary\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim())
    : null;
  const keyMoments = notesState.status === "success"
    ? (notesState.data.match(/#+ Key Moments\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim())
    : null;
  const keyPoints = notesState.status === "success"
    ? (notesState.data.match(/#+ Key Points\n+([\s\S]+?)(?=\n+#+|$)/i)?.[1]?.trim())
    : null;

  let summarizedContent = [
    transcriptSummary ? `### Summary\n${transcriptSummary}` : null,
    keyMoments ? `### Key Moments\n${keyMoments}` : null,
    keyPoints ? `### Key Takeaways\n${keyPoints}` : null,
  ].filter(Boolean).join("\n\n");

  // Fallback if extraction fails
  if (!summarizedContent && notesState.status === "success" && notesState.data) {
    summarizedContent = notesState.data.slice(0, 1000) + (notesState.data.length > 1000 ? "..." : "");
  }

  return (
    <div className={styles.spacing}>
      {/* Notes Preview */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 font-semibold mb-2">
          Notes Preview
        </p>
        <div className="prose prose-invert prose-sm text-[12px] leading-relaxed">
          {notesState.status === "loading" ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full bg-emerald-500/10 rounded" />
              <div className="h-3 w-4/5 bg-emerald-500/10 rounded" />
            </div>
          ) : notesState.status === "success" ? (
            <div className="max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {notesState.data}
              </ReactMarkdown>
            </div>
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
        {transcriptVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-4"
          >
            <div className="border-t border-emerald-500/10 pt-3">
              <div
                className={`overflow-y-auto ${styles.transcriptMaxH} pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20`}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => {
                      const content = React.Children.toArray(children).map(child => {
                        if (typeof child === 'string') {
                          const parts = child.split(/(\(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\))/g);
                          return parts.map((part, i) => {
                            if (part.match(/\(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\)/)) {
                              return <span key={i} className="text-emerald-400 font-mono font-medium">{part}</span>;
                            }
                            return part;
                          });
                        }
                        return child;
                      });
                      return <p className="mb-2 text-[11px] leading-relaxed text-white/70">{content}</p>;
                    },
                    h3: ({ children }) => <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-[9px] mt-4 mb-2">{children}</h3>
                  }}
                >
                  {summarizedContent || "_Summarized transcript loading..._"}
                </ReactMarkdown>

                <div className="mt-4 pt-4 border-t border-emerald-500/5">
                  <p className="text-[9px] uppercase tracking-widest text-white/20 font-bold mb-2">Raw Lines</p>
                  <div className="space-y-2">
                    {parsedLines.map((line, i) => (
                      <div key={i} className="flex gap-2 text-[11px] leading-relaxed group">
                        {line.timestamp && (
                          <span className="shrink-0 font-mono text-emerald-500/50 bg-emerald-500/5 px-1 py-0.5 rounded text-[9px] h-fit mt-0.5">
                            {line.timestamp}
                          </span>
                        )}
                        <span className="text-white/50 group-hover:text-white/80 transition-colors">
                          {line.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Question Input */}
      <form onSubmit={handleManualSubmit} className="relative mt-2">
        <input
          type="text"
          value={manualQuestion}
          onChange={(e) => setManualQuestion(e.target.value)}
          placeholder="Ask a question..."
          className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-full py-2 pl-4 pr-10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
        />
        <button
          type="submit"
          disabled={!manualQuestion.trim() || isLoadingAnswer}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-emerald-500 hover:text-emerald-400 disabled:text-white/10 transition-colors"
        >
          {isLoadingAnswer ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
};
