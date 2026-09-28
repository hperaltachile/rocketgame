"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Roving focus for a grid of buttons: one cell is in the tab order, and the
 * arrow keys (plus Home/End) move focus between cells.
 */
export function useGridFocus(rows: number, cols: number) {
  const [active, setActive] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent, index: number) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    let next = index;
    switch (event.key) {
      case "ArrowUp":
        next = row > 0 ? index - cols : index;
        break;
      case "ArrowDown":
        next = row < rows - 1 ? index + cols : index;
        break;
      case "ArrowLeft":
        next = col > 0 ? index - 1 : index;
        break;
      case "ArrowRight":
        next = col < cols - 1 ? index + 1 : index;
        break;
      case "Home":
        next = row * cols;
        break;
      case "End":
        next = row * cols + cols - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    cells.current[next]?.focus();
  };

  const cellProps = (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      cells.current[index] = el;
    },
    tabIndex: index === active ? 0 : -1,
    onFocus: () => setActive(index),
    onKeyDown: (event: KeyboardEvent) => move(event, index),
  });

  return { cellProps };
}
