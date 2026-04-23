"use client";

import { useState, useEffect } from "react";

interface UseAIPillsProps {
  transcript: string | null;
  title: string;
  enabled: boolean;
  onGenerateQuestions: (transcript: string, title: string) => Promise<string[]>;
  onAnswerQuestion: (question: string, transcript: string, title: string) => Promise<string>;
}

/**
 * Hook to manage AI question pills and their answers.
 */
export function useAIPills({
  transcript,
  title,
  enabled,
  onGenerateQuestions,
  onAnswerQuestion,
}: UseAIPillsProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);

  useEffect(() => {
    if (!enabled || !transcript || questions.length > 0) return;

    const generate = async () => {
      setIsLoadingQuestions(true);
      try {
        const result = await onGenerateQuestions(transcript, title);
        setQuestions(result);
      } catch (err) {
        console.error("[useAIPills] Failed to generate questions:", err);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    generate();
  }, [enabled, transcript, title, questions.length, onGenerateQuestions]);

  const handleQuestionClick = async (question: string) => {
    if (activeQuestion === question) {
      setActiveQuestion(null);
      setAnswer(null);
      return;
    }

    setActiveQuestion(question);
    setAnswer(null);
    setIsLoadingAnswer(true);

    try {
      if (!transcript) throw new Error("Transcript missing");
      const result = await onAnswerQuestion(question, transcript, title);
      setAnswer(result);
    } catch (err) {
      setAnswer("Failed to get an answer.");
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  return {
    questions,
    isLoadingQuestions,
    activeQuestion,
    answer,
    isLoadingAnswer,
    handleQuestionClick,
  };
}
