"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface BookmarkButtonProps {
  programId: string;
  initialBookmarked?: boolean;
}

export default function BookmarkButton({
  programId,
  initialBookmarked = false,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.toggleBookmark(programId);
      setBookmarked(res.bookmarked);
    } catch {
      // optimistic toggle on error
      setBookmarked((prev) => !prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? "북마크 해제" : "북마크"}
      className={`p-2 rounded-full transition-colors ${
        bookmarked
          ? "text-blue-600 bg-blue-50"
          : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
      } disabled:opacity-50`}
    >
      <svg
        className="h-5 w-5"
        fill={bookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
