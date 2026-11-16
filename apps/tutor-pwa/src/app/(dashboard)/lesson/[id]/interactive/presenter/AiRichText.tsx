/**
 * AI-written lesson text (e.g. the suggested answer in phase 15) comes as
 * light markdown. This renders a safe subset as React elements, never as
 * HTML: **bold** / __bold__, bullet and numbered lists (one nesting level),
 * paragraphs and line breaks, and "# " headings as a bold line. Paired
 * *text* / _text_ show just the text. Everything else (links, code, HTML,
 * tables) stays plain text, no URL becomes a link, and an unbalanced marker
 * is kept as typed so nothing is ever dropped.
 */
import React from "react";
import { cn } from "@/lib/utils";

export interface AiInline {
  text: string;
  bold: boolean;
}

export interface AiListItem {
  content: AiInline[][];
  children?: AiList;
}

export interface AiList {
  ordered: boolean;
  /** First number of a numbered list. */
  start: number;
  items: AiListItem[];
}

export type AiBlock =
  | { kind: "paragraph"; lines: AiInline[][] }
  | { kind: "heading"; content: AiInline[] }
  | ({ kind: "list" } & AiList);

/* ─── Inline: bold, paired emphasis, escapes ─────────────────────────────── */

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
const isDigit = (ch: string | undefined) => ch !== undefined && /\p{N}/u.test(ch);
const ESCAPABLE = new Set(["*", "_", "\\", "#", "-", "`"]);

/** Stars between two digits (5*2, 2**3) are arithmetic, not emphasis. */
const isArithmetic = (text: string, start: number, end: number) =>
  text[start] === "*" && isDigit(text[start - 1]) && isDigit(text[end]);

function pushText(out: AiInline[], text: string, bold: boolean) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.bold === bold) last.text += text;
  else out.push({ text, bold });
}

/** Index of the closing `marker` for an opener ending at `from`, or -1. */
function findClose(text: string, marker: string, from: number): number {
  const ch = marker[0];
  const end = (j: number) => j + marker.length;
  for (let j = text.indexOf(marker, from); j !== -1; j = text.indexOf(marker, j + 1)) {
    const valid =
      j !== from &&
      !isSpace(text[j - 1]) &&
      // The close is a whole run of the same length, never part of a longer
      // run such as a fill-in blank "_____" or "*****".
      text[j - 1] !== ch &&
      text[end(j)] !== ch &&
      !isArithmetic(text, j, end(j)) &&
      !(ch === "_" && isWordChar(text[end(j)]));
    if (valid) return j;
    // A single "_" never spans another underscore ("_at, c_t, ca_" stays as
    // typed), the same rule as the student app.
    if (marker === "_") return -1;
  }
  return -1;
}

function parseInlineInto(text: string, bold: boolean, out: AiInline[]) {
  let plain = "";
  let i = 0;
  const flush = () => {
    pushText(out, plain, bold);
    plain = "";
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && ESCAPABLE.has(text[i + 1] ?? "")) {
      plain += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "*" || ch === "_") {
      // A run of the same marker is one delimiter: * / _ (just the text),
      // ** / __ / *** (bold). Longer runs ("___" is a fill-in blank), or a
      // run with no partner of the same length, stay as typed.
      let run = i;
      while (text[run] === ch) run += 1;
      const marker = text.slice(i, run);
      const opens =
        marker.length <= (ch === "_" ? 2 : 3) &&
        !isSpace(text[run]) &&
        !isArithmetic(text, i, run) &&
        !(ch === "_" && isWordChar(text[i - 1]));
      const close = opens ? findClose(text, marker, run) : -1;
      if (close !== -1) {
        flush();
        parseInlineInto(text.slice(run, close), bold || marker.length >= 2, out);
        i = close + marker.length;
        continue;
      }
      plain += marker;
      i = run;
      continue;
    }
    plain += ch;
    i += 1;
  }
  flush();
}

export function parseAiInline(text: string): AiInline[] {
  const out: AiInline[] = [];
  parseInlineInto(text, false, out);
  return out;
}

/* ─── Blocks: paragraphs, headings, lists ──────────────────────────────── */

const BULLET = /^(\s*)[*\-•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
// A closing "#" sequence is dropped only after a space, so "## Key F#" keeps its "#".
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;

const indentOf = (raw: string) => raw.replace(/\t/g, "    ").length;

export function parseAiRichText(source: string | null | undefined): AiBlock[] {
  const blocks: AiBlock[] = [];
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  // The block being built (a paragraph or a list), closed by a blank line or a change of kind.
  const open: { paragraph: AiInline[][] | null; list: (AiList & { indent: number }) | null } = { paragraph: null, list: null };

  const close = () => {
    const { paragraph, list } = open;
    if (paragraph) blocks.push({ kind: "paragraph", lines: paragraph });
    if (list) blocks.push({ kind: "list", ordered: list.ordered, start: list.start, items: list.items });
    open.paragraph = null;
    open.list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      close();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading && heading[1]) {
      close();
      blocks.push({ kind: "heading", content: parseAiInline(heading[1]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const indent = indentOf((bullet ?? numbered)![1]);
      const ordered = Boolean(numbered);
      const content = parseAiInline(bullet ? bullet[2] : numbered![3]);
      const start = numbered ? Number(numbered[2]) : 1;
      const current = open.list;
      if (current && indent > current.indent && current.items.length > 0) {
        // One nesting level: anything indented under an item is its child.
        // Deeper levels, or a mix of bullets and numbers, stay in that one child list.
        const parent = current.items[current.items.length - 1];
        parent.children ??= { ordered, start, items: [] };
        parent.children.items.push({ content: [content] });
        continue;
      }
      if (current && current.ordered === ordered && indent >= current.indent) {
        current.items.push({ content: [content] });
        continue;
      }
      close();
      open.list = { ordered, start, items: [{ content: [content] }], indent };
      continue;
    }
    const text = parseAiInline(line.trim());
    const current = open.list;
    if (current && indentOf(/^\s*/.exec(line)![0]) > current.indent) {
      // An indented line under a list item continues that item.
      const item = current.items[current.items.length - 1];
      const target = item.children ? item.children.items[item.children.items.length - 1] : item;
      target.content.push(text);
      continue;
    }
    if (current) close();
    open.paragraph ??= [];
    open.paragraph.push(text);
  }
  close();
  return blocks;
}

/* ─── Rendering ────────────────────────────────────────────────────────── */

function Inline({ parts }: { parts: AiInline[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-semibold">
            {part.text}
          </strong>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

function Lines({ lines }: { lines: AiInline[][] }) {
  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <br /> : null}
          <Inline parts={line} />
        </React.Fragment>
      ))}
    </>
  );
}

function ListView({ list, nested = false }: { list: AiList; nested?: boolean }) {
  const items = list.items.map((item, index) => (
    <li key={index} className="pl-1">
      <Lines lines={item.content} />
      {item.children ? <ListView list={item.children} nested /> : null}
    </li>
  ));
  const className = cn(
    "flex flex-col gap-1 pl-6 marker:text-fg-subtle",
    list.ordered ? "list-decimal" : nested ? "list-[circle]" : "list-disc",
    nested && "mt-1",
  );
  return list.ordered ? (
    <ol className={className} start={list.start === 1 ? undefined : list.start}>
      {items}
    </ol>
  ) : (
    <ul className={className}>{items}</ul>
  );
}

/** AI text with its light markdown shown as bold, lists and paragraphs. Size and colour come from `className`. */
export function AiRichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = React.useMemo(() => parseAiRichText(text), [text]);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <p key={index} className="font-semibold">
              <Inline parts={block.content} />
            </p>
          );
        }
        if (block.kind === "list") return <ListView key={index} list={block} />;
        return (
          <p key={index}>
            <Lines lines={block.lines} />
          </p>
        );
      })}
    </div>
  );
}
