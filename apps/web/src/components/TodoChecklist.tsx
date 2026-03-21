"use client";

import { useState } from "react";
import type { TodoItem } from "@/lib/api";

interface TodoChecklistProps {
  items: TodoItem[];
}

export default function TodoChecklist({ items }: TodoChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.done).map((i) => i.id))
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
      {items.map((item) => {
        const done = checked.has(item.id);
        return (
          <li key={item.id}>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span
                className={`text-sm transition-colors ${
                  done ? "line-through text-gray-400" : "text-gray-700"
                }`}
              >
                {item.label}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
