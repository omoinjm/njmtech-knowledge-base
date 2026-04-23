"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseTranscript } from "@/lib/parseTranscript";
import { generateTranscriptQuestions, answerTranscriptQuestion } from "@/app/actions";

interface AIPanelProps {
  transcriptUrl: string | null;
  notesUrl: string | null;
  videoUrl: string;
  title: string;
  enabled: boolean;
  variant?: 'popup' | 'card';
}

export const AIPanel: React.FC<AIPanelProps> = ({
  transcriptUrl,
  notesUrl,
  videoUrl,
  title,
  enabled,
  variant = 'popup',
}) => {
  const [notesContent, setNotesContent] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const [questionPills, setQuestionPills] = useState<string[]>([]);
  const [pillsLoading, setPillsLoading] = useState(false);
  const [activePill, setActivePill] = useState<string | null>(null);
  const [pillAnswer, setPillAnswer] = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);

  // Fetch notes on mount if notesUrl exists
  useEffect(() => {
    if (!notesUrl) {
      setNotesContent(null);
      return;
    }

    setIsLoadingNotes(true);
    fetch(notesUrl)
      .then((r) => r.text())
      .then((text) => {
        setNotesContent(text.slice(0, 300));
        setIsLoadingNotes(false);
      })
      .catch(() => {
        setNotesContent(null);
        setIsLoadingNotes(false);
      });
  }, [notesUrl]);

  // Handle background transcript fetch and pill generation when enabled
  useEffect(() => {
    if (!enabled || !transcriptUrl || transcriptContent !== null) return;

    const fetchTranscript = async () => {
      setTranscriptLoading(true);
      setPillsLoading(true);
      try {
        const res = await fetch(transcriptUrl);
        const text = await res.text();
        setTranscriptContent(text);

        // Generate pills as soon as transcript is ready
        const pills = await generateTranscriptQuestions(text, title);
        setQuestionPills(pills);
      } catch (err) {
        console.error("[AIPanel] Failed to fetch transcript or pills:", err);
        setTranscriptContent('Failed to load transcript.');
      } finally {
        setTranscriptLoading(false);
        setPillsLoading(false);
      }
    };

    fetchTranscript();
  }, [enabled, transcriptUrl, transcriptContent, title]);

  const handlePillClick = async (question: string) => {
    if (activePill === question) {
      setActivePill(null);
      setPillAnswer(null);
      return;
    }
    setActivePill(question);
    setPillAnswer(null);
    setAnswerLoading(true);
    try {
      const answer = await answerTranscriptQuestion(question, transcriptContent!, title);
      setPillAnswer(answer);
    } catch {
      setPillAnswer('Failed to get an answer.');
    } finally {
      setAnswerLoading(false);
    }
  };

  const parsedLines = useMemo(() => {
    return transcriptContent ? parseTranscript(transcriptContent) : [];
  }, [transcriptContent]);

  const spacing = variant === 'card' ? 'px-4 py-3' : 'px-4 pt-3 pb-1';
  const pillTextSize = variant === 'card' ? 'text-xs' : 'text-[11px]';
  const transcriptMaxH = variant === 'card' ? 'max-h-[280px]' : 'max-h-[200px]';
  const answerPadding = variant === 'card' ? 'p-3' : 'p-2.5';

  return (
    <div className={spacing}>
      {/* Notes Preview */}
      <div className={`mb-4 ${variant === 'card' ? 'px-0' : ''}`}>
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 font-semibold mb-2">
          Notes Preview
        </p>
        <div className="text-ellipsis prose prose-invert prose-sm text-[12px] leading-relaxed text-white/80">
          {isLoadingNotes ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full bg-emerald-500/10 rounded" />
              <div className="h-3 w-4/5 bg-emerald-500/10 rounded" />
            </div>
          ) : notesContent ? (
            <ReactMarkdown>
              {notesContent + (notesContent.length >= 300 ? "..." : "")}
            </ReactMarkdown>
          ) : (
            <span className="text-[12px] text-white/40 italic">
              No notes available
            </span>
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

      {/* Pills loading skeletons */}
      {pillsLoading && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[88, 112, 96, 124].map((w, i) => (
            <div
              key={i}
              className="h-6 rounded-full bg-emerald-500/10 animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>
      )}

      {/* Pills */}
      {!pillsLoading && questionPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {questionPills.map((q) => (
            <button
              key={q}
              onClick={() => handlePillClick(q)}
              className={`${pillTextSize} px-2.5 py-1 rounded-full border transition-all duration-150 text-left ${
                activePill === q
                  ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
                  : 'bg-transparent border-emerald-500/25 text-emerald-400/70 hover:border-emerald-400/40 hover:text-emerald-300'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Answer area */}
      <AnimatePresence>
        {(answerLoading || pillAnswer) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-3 overflow-hidden"
          >
            {answerLoading ? (
              <div className={`space-y-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 ${answerPadding}`}>
                {[100, 80, 60].map((w, i) => (
                  <div key={i} className="h-2.5 bg-emerald-500/10 rounded animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <p className={`text-xs text-white/70 leading-relaxed bg-emerald-500/5 border border-emerald-500/15 rounded-lg ${answerPadding}`}>
                {pillAnswer}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* View raw transcript toggle — subtle link */}
      {transcriptContent && (
        <button
          onClick={() => setTranscriptVisible(prev => !prev)}
          className="flex items-center gap-1 text-[11px] text-emerald-500/40 hover:text-emerald-400/70 transition-colors mb-2"
        >
          <ChevronRight
            size={11}
            className={`transition-transform duration-200 ${transcriptVisible ? 'rotate-90' : ''}`}
          />
          {transcriptVisible ? 'Hide transcript' : 'View raw transcript'}
        </button>
      )}

      {/* Raw transcript — collapsible sub-section */}
      <AnimatePresence>
        {transcriptVisible && transcriptContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-2"
          >
            <div className={`overflow-y-auto ${transcriptMaxH} space-y-2 border-t border-emerald-500/10 pt-3 pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20`}>
              {parsedLines.map((line, i) => (
                <div key={i} className="flex gap-2 text-xs leading-relaxed group">
                  {line.timestamp && (
                    <span className="shrink-0 font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] h-fit mt-0.5">
                      {line.timestamp}
                    </span>
                  )}
                  <span className="text-white/65 group-hover:text-white transition-colors">{line.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
