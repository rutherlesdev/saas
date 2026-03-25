"use client";

import { type SVGProps, useMemo } from "react";

import { cn } from "@/lib/utils";

// ── QR matrix parsing ────────────────────────────────────────────────────────

/**
 * Parse Unicode half-block QR art (█▀▄ space) into a boolean matrix.
 *
 * Two rendering conventions are supported:
 *
 * Standard (OpenClaw CLI):
 *   █ = both dark   ▀ = top dark   ▄ = bottom dark   space = both light
 *
 * Inverted / wacli style — detected when the first non-empty line is entirely
 * full-block █ characters (quiet zone rendered as filled blocks):
 *   █ = both light   ▀ = top light / bottom dark   ▄ = top dark / bottom light   space = both dark
 */
export function parseBlockQrMatrix(qrText: string): boolean[][] {
  const rawLines = qrText.split("\n");
  const normalizedWidth = Math.max(0, ...rawLines.map((line) => [...line].length));
  if (!normalizedWidth) return [];

  // Detect wacli inverted format: every character in the first non-empty line
  // is a full-block █ (the quiet zone rendered as solid filled blocks).
  const firstNonEmpty = rawLines.find((l) => l.trimEnd().length > 0) ?? "";
  const inverted =
    firstNonEmpty.trimEnd().length > 8 &&
    [...firstNonEmpty.trimEnd()].every((ch) => ch === "\u2588");

  const rows: boolean[][] = [];

  for (const line of rawLines) {
    const chars = [...line]; // Unicode-aware iteration
    while (chars.length < normalizedWidth) {
      chars.push(" ");
    }
    const topRow: boolean[] = [];
    const botRow: boolean[] = [];

    for (const ch of chars) {
      if (inverted) {
        // wacli: █=light, ▀=top-light/bot-dark, ▄=top-dark/bot-light, space=dark
        switch (ch) {
          case "\u2588":
            topRow.push(false);
            botRow.push(false);
            break;
          case "\u2580":
            topRow.push(false);
            botRow.push(true);
            break;
          case "\u2584":
            topRow.push(true);
            botRow.push(false);
            break;
          default:
            topRow.push(true);
            botRow.push(true);
        }
      } else {
        // Standard: █=dark, ▀=top-dark/bot-light, ▄=top-light/bot-dark, space=light
        switch (ch) {
          case "\u2588":
            topRow.push(true);
            botRow.push(true);
            break;
          case "\u2580":
            topRow.push(true);
            botRow.push(false);
            break;
          case "\u2584":
            topRow.push(false);
            botRow.push(true);
            break;
          default:
            topRow.push(false);
            botRow.push(false);
        }
      }
    }

    rows.push(topRow, botRow);
  }

  // Strip boundary rows: all-false (quiet zone in standard) OR all-true
  // (quiet zone in wacli inverted format, or decorative border lines).
  const isBoundaryRow = (r: boolean[]) => !r.some(Boolean) || r.every(Boolean);
  let rStart = 0;
  let rEnd = rows.length - 1;
  while (rStart <= rEnd) {
    const row = rows[rStart];
    if (!row || !isBoundaryRow(row)) break;
    rStart++;
  }
  while (rEnd >= rStart) {
    const row = rows[rEnd];
    if (!row || !isBoundaryRow(row)) break;
    rEnd--;
  }
  const trimmed = rows.slice(rStart, rEnd + 1);
  if (!trimmed.length) return [];

  // Strip boundary columns as well: all-false in standard mode, or all-true
  // when the upstream renderer emits filled side borders.
  const width = Math.max(...trimmed.map((r) => r.length));
  let cStart = 0;
  let cEnd = width - 1;
  const isBoundaryColumn = (col: number) =>
    trimmed.every((r) => !r[col]) || trimmed.every((r) => r[col]);
  while (cStart <= cEnd && isBoundaryColumn(cStart)) cStart++;
  while (cEnd >= cStart && isBoundaryColumn(cEnd)) cEnd--;
  const result = trimmed.map((r) => r.slice(cStart, cEnd + 1));

  // QR finder pattern: top-left corner module must be dark.
  // If it's light the polarity is inverted — flip the whole matrix.
  if (result[0]?.[0] === false) {
    return result.map((row) => row.map((v) => !v));
  }

  return result;
}

// ── QR SVG component ─────────────────────────────────────────────────────────

const QR_QUIET_ZONE_MODULES = 4;

type QrCodeSvgProps = {
  qrText: string;
  size?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">;

export function QrCodeSvg({ qrText, size = 280, className, ...props }: QrCodeSvgProps) {
  const matrix = useMemo(() => parseBlockQrMatrix(qrText), [qrText]);

  const darkModules = useMemo(() => {
    const rows = matrix.length;
    if (!rows) return [];

    const cols = Math.max(...matrix.map((row) => row.length));
    if (!cols) return [];

    const maxSide = Math.max(rows, cols);
    const xOffset = QR_QUIET_ZONE_MODULES + (maxSide - cols) / 2;
    const yOffset = QR_QUIET_ZONE_MODULES + (maxSide - rows) / 2;

    return matrix.flatMap((row, rowIndex) =>
      row.flatMap((isDark, columnIndex) =>
        isDark
          ? [
              {
                id: `${xOffset + columnIndex}-${yOffset + rowIndex}`,
                x: xOffset + columnIndex,
                y: yOffset + rowIndex,
              },
            ]
          : [],
      ),
    );
  }, [matrix]);

  const rows = matrix.length;
  if (!rows) return null;

  const cols = Math.max(...matrix.map((row) => row.length));
  if (!cols) return null;

  const maxSide = Math.max(rows, cols);
  const viewBoxSize = maxSide + QR_QUIET_ZONE_MODULES * 2;

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block shrink-0", className)}
      role="img"
      aria-label="QR code do WhatsApp"
      {...props}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      {darkModules.map((module) => (
        <rect key={module.id} x={module.x} y={module.y} width="1" height="1" fill="#000000" />
      ))}
    </svg>
  );
}
