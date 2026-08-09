/**
 * Course Requests helpers usable from both server and client code —
 * deliberately no "server-only" import and no DB access, mirroring
 * chat-shared.ts's client/server split.
 */

export type RequestStatus = "REQUESTED" | "IN_PROGRESS" | "AVAILABLE" | "RESOLVED" | "CLOSED" | "REJECTED";
export type RequestSkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type RequestSort = "trending" | "newest" | "popular" | "updated";
export type RequestKind = "REQUEST" | "RECOMMENDATION";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  REQUESTED: "Requested",
  IN_PROGRESS: "In Progress",
  AVAILABLE: "Available",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  REQUEST: "Request",
  RECOMMENDATION: "Recommendation",
};

/** Sort-mode labels shown in the UI — kept separate from the underlying query values so wording can evolve independently of the API. */
export const REQUEST_SORT_LABELS: Record<RequestSort, string> = {
  newest: "New Requests",
  trending: "Trending",
  popular: "Most Requested",
  updated: "Recently Updated",
};

export interface RequestAuthorDTO {
  label: string;
  image: string | null;
  isAnonymous: boolean;
}

export interface RequestCategoryDTO {
  slug: string;
  name: string;
}

export interface RequestCardDTO {
  id: string;
  slug: string;
  kind: RequestKind;
  title: string;
  subject: string;
  description: string;
  category: RequestCategoryDTO | null;
  skillLevel: RequestSkillLevel | null;
  tags: string[];
  imageThumbUrl: string | null;
  status: RequestStatus;
  pinned: boolean;
  featured: boolean;
  isPopular: boolean;
  voteCount: number;
  bookmarkCount: number;
  commentCount: number;
  views: number;
  mergedIntoId: string | null;
  createdAt: string;
  lastActivityAt: string;
  author: RequestAuthorDTO;
  votedByMe: boolean;
  bookmarkedByMe: boolean;
  followedByMe: boolean;
  mine: boolean;
}

export interface RequestDetailDTO extends RequestCardDTO {
  motivation: string;
  instructor: string | null;
  sourceProvider: string | null;
  referenceUrl: string | null;
  imageUrl: string | null;
  commentsLocked: boolean;
  updatedAt: string;
}

export interface RequestCommentAuthorDTO {
  label: string;
  image: string | null;
  isAdmin: boolean;
}

export interface RequestCommentReactionDTO {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface RequestCommentDTO {
  id: string;
  requestId: string;
  parentId: string | null;
  body: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  createdAt: string;
  editedAt: string | null;
  author: RequestCommentAuthorDTO;
  mine: boolean;
  reactions: RequestCommentReactionDTO[];
  replyCount: number;
}

/** Curated set of tag suggestions shown in the create form — free text is still allowed. */
export const REQUEST_TAG_SUGGESTIONS = [
  "javascript", "python", "react", "nextjs", "ai", "machine-learning",
  "design", "ui-ux", "marketing", "business", "data-science", "devops",
  "backend", "frontend", "mobile", "cloud", "security", "beginner-friendly",
] as const;

export function parseTagsInput(raw: string): string[] {
  return [...new Set(
    raw
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
      .filter(Boolean)
  )].slice(0, 8);
}
