declare module "fontkit" {
  import type { PDFDocument } from "pdf-lib";

  const fontkit: Parameters<PDFDocument["registerFontkit"]>[0];
  export = fontkit;
}
