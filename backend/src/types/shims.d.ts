declare module 'qrcode' {
  export function toDataURL(text: string, opts?: any): Promise<string>;
}
declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(opts?: any);
  }
}
