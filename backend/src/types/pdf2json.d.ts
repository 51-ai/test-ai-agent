declare module 'pdf2json' {
  interface PDFParser {
    on(event: 'pdfParser_dataError', listener: (err: Error) => void): void;
    on(event: 'pdfParser_dataReady', listener: (pdfData: any) => void): void;
    loadPDF(filePath: string): void;
    getRawTextContent(): string;
  }

  const PDFParser: {
    new (context?: any, needRawText?: boolean): PDFParser;
  };

  export default PDFParser;
}

declare module 'pptxgenjs' {
  interface PptxGenJS {
    addSlide(): any;
    save(fileName: string): Promise<void>;
  }

  const PptxGenJS: {
    new (): PptxGenJS;
  };

  export default PptxGenJS;
}