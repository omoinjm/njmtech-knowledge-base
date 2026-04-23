/**
 * Discriminated union for managing the state of asynchronous data fetching.
 */
export type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

/**
 * Shared layout configurations for UI components with multiple variants.
 */
export interface VariantStyles {
  /** CSS class for container padding/spacing */
  spacing: string;
  /** CSS class for question pill text size */
  pillTextSize: string;
  /** CSS class for maximum transcript height */
  transcriptMaxH: string;
  /** CSS class for answer bubble padding */
  answerPadding: string;
}
