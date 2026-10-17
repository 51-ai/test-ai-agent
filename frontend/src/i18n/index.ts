import en from './en';
import zh from './zh';

export type Language = 'en' | 'zh';

export interface Translations {
  app: {
    name: string;
    loading: string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    signIn: string;
    signingIn: string;
    error: string;
    noAccount: string;
    signUp: string;
  };
  register: {
    title: string;
    subtitle: string;
    username: string;
    usernamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    createAccount: string;
    creating: string;
    error: string;
    haveAccount: string;
    signIn: string;
  };
  chat: {
    newChat: string;
    conversations: string;
    logout: string;
    send: string;
    sendPlaceholder: string;
    deleteConfirm: string;
    noConversation: string;
    newConversation: string;
    delete: string;
    rename: string;
  };
  common: {
    language: string;
    english: string;
    chinese: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: en as unknown as Translations,
  zh: zh as unknown as Translations
};