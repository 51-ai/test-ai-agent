import axios from 'axios';
import { ToolExecutor, ToolRegistry, ToolCallResult } from '../../tool-enhance';
import { config } from '../../../config';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface WebSearchResponse {
  success: boolean;
  results: WebSearchResult[];
  query: string;
  source: string;
  totalResults?: number;
  note?: string;
  error?: string;
}

export class WebSearchTool {
  private usageCount = 0;
  private successCount = 0;

  async execute(toolId: string, parameters: Record<string, any>): Promise<ToolCallResult> {
    this.usageCount++;
    
    const query = parameters.query as string;
    const numResults = (parameters.numResults as number) || 5;
    
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        error: 'Query parameter is required',
        duration: 0
      };
    }

    try {
      if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
        const result = await googleSearch(query, numResults);
        if (result.success) this.successCount++;
        return {
          success: result.success,
          result,
          duration: 0
        };
      }
      
      if (process.env.BING_SEARCH_API_KEY) {
        const result = await bingSearch(query, numResults);
        if (result.success) this.successCount++;
        return {
          success: result.success,
          result,
          duration: 0
        };
      }
      
      if (process.env.USE_DUCKDUCKGO === 'true') {
        const result = await duckduckgoSearch(query, numResults);
        if (result.success) this.successCount++;
        return {
          success: result.success,
          result,
          duration: 0
        };
      }
      
      if (process.env.SERPAPI_API_KEY) {
        const result = await serpapiSearch(query, numResults);
        if (result.success) this.successCount++;
        return {
          success: result.success,
          result,
          duration: 0
        };
      }
      
      const result = mockSearch(query, numResults);
      this.successCount++;
      return {
        success: true,
        result,
        duration: 0
      };
    } catch (error) {
      console.error('[WebSearchTool] Error:', error instanceof Error ? error.message : String(error));
      // 当配置了 API key 但全部失败时，返回失败而非静默降级到 mock
      const hasAnyApiKey = !!(process.env.GOOGLE_SEARCH_API_KEY || process.env.BING_SEARCH_API_KEY || process.env.SERPAPI_API_KEY);
      if (hasAnyApiKey) {
        return {
          success: false,
          error: 'All search APIs unavailable',
          result: { source: 'error', query, note: '所有搜索 API 均不可用，非 mock 数据' },
          duration: 0
        };
      }
      const result = mockSearch(query, numResults);
      return {
        success: true,
        result,
        duration: 0
      };
    }
  }

  getStats() {
    return {
      usageCount: this.usageCount,
      successCount: this.successCount,
      successRate: this.usageCount > 0 ? this.successCount / this.usageCount : 0
    };
  }
}

async function googleSearch(query: string, numResults: number): Promise<WebSearchResponse> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  
  const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: {
      key: apiKey,
      cx: cx,
      q: query,
      num: Math.min(numResults, 10)
    },
    timeout: 10000
  });

  const items = response.data.items || [];
  const results = items.map((item: any) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    source: 'google'
  }));

  return {
    success: true,
    results,
    query,
    source: 'google',
    totalResults: response.data.searchInformation?.totalResults || 0
  };
}

async function bingSearch(query: string, numResults: number): Promise<WebSearchResponse> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  
  const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey!
    },
    params: {
      q: query,
      count: Math.min(numResults, 50),
      mkt: 'zh-CN'
    },
    timeout: 10000
  });

  const webPages = response.data.webPages?.value || [];
  const results = webPages.slice(0, numResults).map((item: any) => ({
    title: item.name,
    snippet: item.snippet,
    url: item.url,
    source: 'bing'
  }));

  return {
    success: true,
    results,
    query,
    source: 'bing',
    totalResults: response.data.webPages?.totalEstimatedMatches || 0
  };
}

async function duckduckgoSearch(query: string, numResults: number): Promise<WebSearchResponse> {
  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: '1',
        no_redirect: '1'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'AI Agent Search Bot'
      }
    });

    const data = response.data;
    const results: WebSearchResult[] = [];

    if (data.results && Array.isArray(data.results)) {
      data.results.slice(0, numResults).forEach((item: any) => {
        if (item.Title && item.FirstURL) {
          results.push({
            title: item.Title,
            snippet: item.Text || '搜索结果摘要',
            url: item.FirstURL,
            source: 'duckduckgo'
          });
        }
      });
    }

    if (results.length === 0) {
      return mockSearch(query, numResults);
    }

    return {
      success: true,
      results,
      query,
      source: 'duckduckgo'
    };
  } catch {
    return mockSearch(query, numResults);
  }
}

async function serpapiSearch(query: string, numResults: number): Promise<WebSearchResponse> {
  const apiKey = process.env.SERPAPI_API_KEY;
  
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      q: query,
      api_key: apiKey,
      num: Math.min(numResults, 10),
      engine: 'google'
    },
    timeout: 10000
  });

  const items = response.data.organic_results || [];
  const results = items.slice(0, numResults).map((item: any) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    source: 'serpapi'
  }));

  return {
    success: true,
    results,
    query,
    source: 'serpapi',
    totalResults: response.data.search_information?.total_results || 0
  };
}

function mockSearch(query: string, numResults: number): WebSearchResponse {
  const mockResults: WebSearchResult[] = [
    {
      title: `${query} - 维基百科`,
      snippet: `关于"${query}"的详细介绍和背景信息...`,
      url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      source: 'wikipedia'
    },
    {
      title: `${query}的最新信息和动态`,
      snippet: `这里是关于${query}的最新资讯和相关报道...`,
      url: `https://example.com/news/${encodeURIComponent(query)}`,
      source: 'news'
    },
    {
      title: `${query} - 专业教程和指南`,
      snippet: `学习${query}的完整教程，包含实例和最佳实践...`,
      url: `https://example.com/tutorial/${encodeURIComponent(query)}`,
      source: 'tutorial'
    },
    {
      title: `${query}常见问题解答`,
      snippet: `解答关于${query}的常见问题，帮助您快速了解...`,
      url: `https://example.com/faq/${encodeURIComponent(query)}`,
      source: 'faq'
    },
    {
      title: `${query}相关资源和工具`,
      snippet: `精选的${query}相关资源、工具和推荐...`,
      url: `https://example.com/resources/${encodeURIComponent(query)}`,
      source: 'resources'
    }
  ];

  return {
    success: true,
    results: mockResults.slice(0, numResults),
    query,
    source: 'mock',
    note: '这是Mock数据，请配置真实的搜索引擎API以获得真实结果'
  };
}

export const webSearchTool = new WebSearchTool();