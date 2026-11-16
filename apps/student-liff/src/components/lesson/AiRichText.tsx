import { Fragment, type ReactNode } from "react";

// Relative import only: vitest maps "@" to another app.
import { cn } from "../../lib/utils";

/**
 * AI answers and feedback arrive as light markdown ("**bold**", "*   item",
 * "1. step", blank lines). This renders a SAFE SUBSET of it as React elements
 * (never HTML strings): bold, bullet and numbered lists (one nesting level),
 * paragraphs and line breaks, and "#" headings as a bold line. Everything else
 * (links, code, tables, HTML) stays plain text, and a marker without a partner
 * is shown as typed, so no content is ever dropped.
 */

/** A run of text, bold or not. */
export interface AiInline {
  text: string;
  strong: boolean;
}

/** One line of inline runs. */
export type AiLine = AiInline[];

export interface AiListItem {
  /** Number written by the AI for a numbered item ("3." → 3), else null. */
  number: number | null;
  lines: AiLine[];
  /** Nested items (one level), grouped into lists by kind. */
  children: AiList[];
}

export interface AiList {
  type: "list";
  ordered: boolean;
  items: AiListItem[];
}

export type AiBlock =
  | { type: "paragraph"; lines: AiLine[] }
  | { type: "heading"; line: AiLine }
  | AiList;

const BULLET = /^([ \t]*)[*\-•][ \t]+(\S.*)$/;
const NUMBERED = /^([ \t]*)(\d{1,2})[.)][ \t]+(\S.*)$/;
const HEADING = /^[ \t]{0,3}#{1,6}[ \t]+(\S.*?)(?:[ \t]+#+)?[ \t]*$/;
/**
 * "***x***", "**x**" or "__x__" with no space just inside the markers. A marker
 * never touches another marker character, so runs such as "_____" (a blank),
 * "*****" or "x**2" stay as typed; "__" never sits inside a word.
 *
 * The character BEFORE the opening marker is checked in code (`openerBlocked`),
 * not with a lookbehind: Safari and the LINE in-app browser below iOS 16.4
 * cannot compile lookbehind, and this module loads with the live lesson.
 */
const BOLD =
  /\*\*\*(?![\s*])([^\n]*?[^\s*])\*\*\*(?!\*)|\*\*(?![\s*])([^\n]*?[^\s*])\*\*(?!\*)|__(?![\s_])([^\n]*?[^\s_])__(?![\p{L}\p{N}_])/gu;
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** The whole character (code point) that ends just before `index`, or "". */
function prevCodePoint(line: string, index: number): string {
  if (index <= 0) return "";
  const low = line.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = line.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return line.slice(index - 2, index);
  }
  return line[index - 1];
}

/** True when a bold opener at `index` touches a "*" (for "*") or a word character (for "_") on its left. */
function openerBlocked(line: string, index: number): boolean {
  const prev = prevCodePoint(line, index);
  if (prev === "") return false;
  return line[index] === "*" ? prev === "*" : WORD_CHAR.test(prev);
}
/** "*x*" not touching a letter, digit or another "*" outside the pair. */
const ITALIC_STAR = /(^|[^\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gu;
/** "_x_" not inside a word (keeps snake_case as typed). */
const ITALIC_UNDERSCORE = /(^|[^\p{L}\p{N}_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/gu;

function indentWidth(indent: string): number {
  let width = 0;
  for (const ch of indent) width += ch === "\t" ? 4 : 1;
  return width;
}

/** Drops the markers of a clear "*x*" / "_x_" pair; anything else stays. */
function stripItalics(text: string): string {
  return text.replace(ITALIC_STAR, "$1$2").replace(ITALIC_UNDERSCORE, "$1$2");
}

function pushRun(runs: AiInline[], text: string, strong: boolean) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && last.strong === strong) last.text += text;
  else runs.push({ text, strong });
}

/** Bold spans of one line, left to right: where each starts and ends (markers included) and its inner text. */
export function findAiBoldSpans(line: string): { start: number; end: number; text: string }[] {
  const spans: { start: number; end: number; text: string }[] = [];
  const bold = new RegExp(BOLD.source, BOLD.flags);
  let match: RegExpExecArray | null;
  while ((match = bold.exec(line)) !== null) {
    const start = match.index;
    if (openerBlocked(line, start)) {
      // Not an opener here: look again from the next character.
      bold.lastIndex = start + 1;
      continue;
    }
    spans.push({ start, end: start + match[0].length, text: match[1] ?? match[2] ?? match[3] ?? "" });
  }
  return spans;
}

/** Splits one line into plain and bold runs. */
export function parseAiInline(line: string): AiLine {
  const runs: AiInline[] = [];
  let cursor = 0;
  for (const span of findAiBoldSpans(line)) {
    pushRun(runs, stripItalics(line.slice(cursor, span.start)), false);
    pushRun(runs, stripItalics(span.text), true);
    cursor = span.end;
  }
  pushRun(runs, stripItalics(line.slice(cursor)), false);
  return runs;
}

/** Parses AI text into blocks. Pure: no HTML is produced. */
export function parseAiRichText(source: string | null | undefined): AiBlock[] {
  const blocks: AiBlock[] = [];
  if (!source) return blocks;

  let paragraph: { type: "paragraph"; lines: AiLine[] } | null = null;
  let list: AiList | null = null;
  /** Indent of the top-level items of the open list. */
  let listIndent = 0;

  const close = () => {
    paragraph = null;
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (!rawLine.trim()) {
      close();
      continue;
    }

    const heading = rawLine.match(HEADING);
    if (heading) {
      close();
      blocks.push({ type: "heading", line: parseAiInline(heading[1]) });
      continue;
    }

    const bullet = rawLine.match(BULLET);
    const numbered = bullet ? null : rawLine.match(NUMBERED);
    if (bullet || numbered) {
      const indent = indentWidth((bullet ?? numbered)![1]);
      const ordered = !!numbered;
      const item: AiListItem = {
        number: numbered ? Number(numbered[2]) : null,
        lines: [parseAiInline(bullet ? bullet[2] : numbered![3])],
        children: [],
      };
      paragraph = null;
      const openList = list as AiList | null;
      const parent = openList?.items[openList.items.length - 1];
      if (openList && parent && indent >= listIndent + 2) {
        // Nested item (any deeper indent stays at the one nesting level).
        const lastChild = parent.children[parent.children.length - 1];
        if (lastChild && lastChild.ordered === ordered) lastChild.items.push(item);
        else parent.children.push({ type: "list", ordered, items: [item] });
      } else if (openList && openList.ordered === ordered) {
        openList.items.push(item);
      } else {
        list = { type: "list", ordered, items: [item] };
        listIndent = indent;
        blocks.push(list);
      }
      continue;
    }

    const text = parseAiInline(rawLine.trim());
    const openList = list as AiList | null;
    if (openList && indentWidth(rawLine.match(/^[ \t]*/)![0]) >= listIndent + 2) {
      // Indented continuation of the last item (or of its last nested item).
      const item = openList.items[openList.items.length - 1];
      const nested = item.children[item.children.length - 1];
      const target = nested ? nested.items[nested.items.length - 1] : item;
      target.lines.push(text);
      continue;
    }

    list = null;
    if (!paragraph) {
      paragraph = { type: "paragraph", lines: [] };
      blocks.push(paragraph);
    }
    paragraph.lines.push(text);
  }

  return blocks;
}

function InlineLine({ line }: { line: AiLine }) {
  return (
    <>
      {line.map((run, i) =>
        run.strong ? (
          <strong key={i} className="font-semibold">
            {run.text}
          </strong>
        ) : (
          <Fragment key={i}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}

function Lines({ lines }: { lines: AiLine[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <InlineLine line={line} />
        </Fragment>
      ))}
    </>
  );
}

function ListBlock({ list, nested }: { list: AiList; nested?: boolean }) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "flex flex-col gap-1 pl-5 marker:text-fg-muted",
        list.ordered ? "list-decimal" : nested ? "list-[circle]" : "list-disc",
        nested && "mt-1 pl-4",
      )}
    >
      {list.items.map((item, i) => (
        <li key={i} value={list.ordered && item.number !== null ? item.number : undefined} className="pl-0.5">
          <Lines lines={item.lines} />
          {item.children.map((child, j) => (
            <ListBlock key={j} list={child} nested />
          ))}
        </li>
      ))}
    </Tag>
  );
}

/**
 * Renders AI text with the safe markdown subset above. Typography (size, line
 * height, colour, wrapping) comes from `className` on the wrapper.
 */
export function AiRichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseAiRichText(text);
  const content: ReactNode[] = blocks.map((block, i) => {
    if (block.type === "list") return <ListBlock key={i} list={block} />;
    if (block.type === "heading") {
      return (
        <p key={i} className="font-semibold">
          <InlineLine line={block.line} />
        </p>
      );
    }
    return (
      <p key={i}>
        <Lines lines={block.lines} />
      </p>
    );
  });
  return <div className={cn("flex min-w-0 flex-col gap-2 [overflow-wrap:anywhere]", className)}>{content}</div>;
}
