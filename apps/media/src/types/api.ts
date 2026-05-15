import { KnowledgeBase, MediaItem } from "./media";

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

/**
 * Result of loading a personal knowledge base and its media items.
 */
export interface KnowledgeBaseState {
  /** Available knowledge bases for the current mode */
  knowledgeBases: KnowledgeBase[];
  /** Currently active knowledge base */
  activeKnowledgeBase: KnowledgeBase;
  /** Media items belonging to the active knowledge base */
  items: MediaItem[];
}
