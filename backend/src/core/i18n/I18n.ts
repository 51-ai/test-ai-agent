/**
 * 国际化(i18n) - 多语言支持/翻译/本地化/复数处理
 */

import { v4 as uuidv4 } from 'uuid';

export type Locale = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'ar' | 'th' | 'vi';
export type TextDirection = 'ltr' | 'rtl';

export interface Translation {
  id: string;
  key: string;
  locale: Locale;
  value: string;
  pluralForms?: Record<string, string>;
  context?: string;
  updatedAt: Date;
  updatedBy: string;
  metadata?: Record<string, unknown>;
}

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  direction: TextDirection;
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimalSeparator: string;
    thousandSeparator: string;
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
  };
  fallbackLocale?: Locale;
}

export interface TranslationGroup {
  id: string;
  namespace: string;
  description?: string;
  translations: Map<string, Map<Locale, Translation>>;
  createdAt: Date;
  updatedAt: Date;
}

export class I18n {
  private locales: Map<Locale, LocaleConfig> = new Map();
  private groups: Map<string, TranslationGroup> = new Map();
  private defaultLocale: Locale = 'en';
  private currentLocale: Locale = 'en';
  private translations: Map<string, Map<Locale, Translation>> = new Map();
  private cache: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultLocales();
  }

  private initializeDefaultLocales(): void {
    const configs: LocaleConfig[] = [
      { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', dateFormat: 'MM/DD/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: '$', currencyPosition: 'before' } },
      { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: '¥', currencyPosition: 'before' } },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', dateFormat: 'YYYY/MM/DD', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: '¥', currencyPosition: 'before' } },
      { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', dateFormat: 'YYYY.MM.DD', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: '₩', currencyPosition: 'before' } },
      { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: '.', currencySymbol: '€', currencyPosition: 'after' } },
      { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: ' ', currencySymbol: '€', currencyPosition: 'after' } },
      { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: '.', currencySymbol: '€', currencyPosition: 'after' } },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: '.', currencySymbol: 'R$', currencyPosition: 'before' } },
      { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: ' ', currencySymbol: '₽', currencyPosition: 'after' } },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: 'ر.س', currencyPosition: 'before' } },
      { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: '.', thousandSeparator: ',', currencySymbol: '฿', currencyPosition: 'before' } },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', numberFormat: { decimalSeparator: ',', thousandSeparator: '.', currencySymbol: '₫', currencyPosition: 'after' } }
    ];
    for (const c of configs) this.locales.set(c.code, c);
  }

  setDefaultLocale(locale: Locale): void {
    this.defaultLocale = locale;
  }

  setCurrentLocale(locale: Locale): void {
    this.currentLocale = locale;
  }

  addLocale(config: LocaleConfig): void {
    this.locales.set(config.code, config);
  }

  getLocaleConfig(locale: Locale): LocaleConfig | undefined {
    return this.locales.get(locale);
  }

  listLocales(): LocaleConfig[] {
    return Array.from(this.locales.values());
  }

  addTranslation(key: string, locale: Locale, value: string, options: { context?: string; pluralForms?: Record<string, string>; namespace?: string } = {}): string {
    const id = uuidv4();
    const namespace = options.namespace || 'default';
    let group = this.groups.get(namespace);
    if (!group) {
      group = { id: uuidv4(), namespace, translations: new Map(), createdAt: new Date(), updatedAt: new Date() };
      this.groups.set(namespace, group);
    }
    if (!group.translations.has(key)) group.translations.set(key, new Map());
    const translation: Translation = {
      id,
      key,
      locale,
      value,
      pluralForms: options.pluralForms,
      context: options.context,
      updatedAt: new Date(),
      updatedBy: 'system'
    };
    group.translations.get(key)!.set(locale, translation);

    if (!this.translations.has(key)) this.translations.set(key, new Map());
    this.translations.get(key)!.set(locale, translation);
    group.updatedAt = new Date();
    this.cache.clear();
    return id;
  }

  translate(key: string, options: { locale?: Locale; params?: Record<string, string | number>; count?: number; namespace?: string } = {}): string {
    const locale = options.locale || this.currentLocale;
    const cacheKey = `${locale}:${key}:${JSON.stringify(options.params || {})}:${options.count ?? 'n'}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    let value = this.lookup(key, locale);
    if (value === undefined) value = this.lookup(key, this.defaultLocale);
    if (value === undefined) return key;

    if (options.count !== undefined) {
      const group = this.groups.get(options.namespace || 'default');
      const translation = group?.translations.get(key)?.get(locale);
      if (translation?.pluralForms) {
        value = this.selectPluralForm(translation.pluralForms, options.count, locale);
      }
    }

    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    this.cache.set(cacheKey, value);
    return value;
  }

  private lookup(key: string, locale: Locale): string | undefined {
    return this.translations.get(key)?.get(locale)?.value;
  }

  private selectPluralForm(forms: Record<string, string>, count: number, locale: Locale): string {
    const pluralCategories = this.getPluralCategories(locale);
    const category = this.getPluralCategory(count, pluralCategories);
    return forms[category] || forms.other || Object.values(forms)[0];
  }

  private getPluralCategories(locale: Locale): string[] {
    if (locale === 'zh' || locale === 'ja' || locale === 'ko' || locale === 'vi' || locale === 'th') return ['other'];
    if (locale === 'ar') return ['zero', 'one', 'two', 'few', 'many', 'other'];
    return ['one', 'other'];
  }

  private getPluralCategory(count: number, categories: string[]): string {
    if (categories.includes('zero') && count === 0) return 'zero';
    if (categories.includes('one') && count === 1) return 'one';
    if (categories.includes('two') && count === 2) return 'two';
    if (categories.includes('few') && (count % 10 >= 2 && count % 10 <= 4) && (count % 100 < 12 || count % 100 > 14)) return 'few';
    if (categories.includes('many') && (count % 10 === 0 || count % 10 >= 5 || count % 100 >= 11 && count % 100 <= 14)) return 'many';
    return 'other';
  }

  formatDate(date: Date, locale: Locale = this.currentLocale): string {
    const config = this.locales.get(locale);
    if (!config) return date.toISOString();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return config.dateFormat
      .replace('YYYY', String(y))
      .replace('MM', m)
      .replace('DD', d);
  }

  formatNumber(num: number, locale: Locale = this.currentLocale, options: { decimals?: number; currency?: boolean } = {}): string {
    const config = this.locales.get(locale);
    if (!config) return String(num);
    const decimals = options.decimals ?? 2;
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.numberFormat.thousandSeparator);
    const numStr = decPart ? `${intFormatted}${config.numberFormat.decimalSeparator}${decPart}` : intFormatted;
    if (options.currency) {
      return config.numberFormat.currencyPosition === 'before'
        ? `${config.numberFormat.currencySymbol}${numStr}`
        : `${numStr}${config.numberFormat.currencySymbol}`;
    }
    return numStr;
  }

  formatCurrency(amount: number, locale: Locale = this.currentLocale, currency?: string): string {
    return this.formatNumber(amount, locale, { decimals: 2, currency: true });
  }

  detectLocale(acceptLanguage: string): Locale {
    const languages = acceptLanguage.split(',').map(l => l.split(';')[0].trim().toLowerCase().substring(0, 2));
    for (const lang of languages) {
      if (this.locales.has(lang as Locale)) return lang as Locale;
    }
    return this.defaultLocale;
  }

  exportGroup(namespace: string, locale?: Locale): Record<string, string> {
    const group = this.groups.get(namespace);
    if (!group) return {};
    const result: Record<string, string> = {};
    for (const [key, translations] of group.translations) {
      if (locale) {
        const t = translations.get(locale);
        if (t) result[key] = t.value;
      } else {
        for (const [loc, t] of translations) {
          result[`${key}.${loc}`] = t.value;
        }
      }
    }
    return result;
  }

  importTranslations(data: Record<string, string>, locale: Locale, namespace: string = 'default'): number {
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      this.addTranslation(key, locale, value, { namespace });
      count++;
    }
    return count;
  }

  listGroups(): TranslationGroup[] {
    return Array.from(this.groups.values());
  }

  getGroup(namespace: string): TranslationGroup | undefined {
    return this.groups.get(namespace);
  }

  getCompletionRate(locale: Locale, namespace: string = 'default'): number {
    const group = this.groups.get(namespace);
    if (!group || group.translations.size === 0) return 0;
    let translated = 0;
    for (const translations of group.translations.values()) {
      if (translations.has(locale)) translated++;
    }
    return translated / group.translations.size;
  }

  getStats(): { totalKeys: number; locales: number; groups: number; completion: Record<string, number> } {
    const completion: Record<string, number> = {};
    for (const locale of this.locales.keys()) {
      completion[locale] = this.getCompletionRate(locale);
    }
    return {
      totalKeys: this.translations.size,
      locales: this.locales.size,
      groups: this.groups.size,
      completion
    };
  }
}

export const i18n = new I18n();
export default I18n;
