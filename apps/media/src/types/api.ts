import { MediaItem } from "./media";

/**
 * Standard response shape for server actions.
 */
export interface ActionResponse<T = void> {
  /** Whether the action was successful */
  success: boolean;
  /** Data returned from the action on success */
  data?: T;
  /** Error message on failure */
  error?: string;
}

/**
 * Result of the transcript categorization process.
 */
export interface CategorizeResult {
  /** Primary category identified for the content */
  category: string;
  /** List of topic tags generated from the transcript */
  tags: string[];
  /** Proposed refined title for the content */
  title?: string;
}

/**
 * Shape of the GitHub Models AI response for chat completions.
 */
export interface OpenAICompletionResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Result of a media item addition action.
 */
export interface AddMediaResult {
  /** The newly created or updated media item */
  item: MediaItem;
}
