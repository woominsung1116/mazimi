"use client";

import { useState } from "react";

interface TodoChecklistProps {
  items: string[];
}

export default function TodoChecklist({ items }: TodoChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">할 일이 없습니다.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const done = checked.has(i);
        return (
          <li key={i}>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggle(i)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span
                className={`text-sm transition-colors ${
                  done ? "line-through text-gray-400" : "text-gray-700"
                }`}
              >
                {item}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
