﻿import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n';
import { Globe } from 'lucide-react';

const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
  };

  return (
    <div className="relative group">
      <button type="button" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
        <Globe className="w-4 h-4" />
        <span>{language === 'en' ? 'EN' : '中文'}</span>
      </button>
      
      <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button type="button"
          
          onClick={() => handleLanguageChange('en')}
          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
            language === 'en' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          English
        </button>
        <button type="button"
          
          onClick={() => handleLanguageChange('zh')}
          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
            language === 'zh' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          中文
        </button>
      </div>
    </div>
  );
};

export default LanguageToggle;