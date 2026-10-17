import type { AxiosError } from 'axios';

export interface HumanizedError {
  title: string;
  message: string;
  status?: number;
  code?: string;
  raw: any;
  action?: 'retry' | 'logout' | 'switch-model' | 'check-backend' | 'wait';
}

export function humanizeAxiosError(e: AxiosError | any): HumanizedError {
  if (!e || !e.isAxiosError) {
    return {
      title: '操作失败',
      message: typeof e === 'string' ? e : (e?.message?.toString() || '未知错误'),
      raw: e,
    };
  }
  const ax = e as AxiosError<any>;
  const status = ax.response?.status;
  const code = ax.code;
  const data = ax.response?.data;
  const bizErr = data?.error || data?.message || '';

  if (status === 401) {
    return {
      title: '登录已过期',
      message: '请重新登录。',
      status, code, raw: ax, action: 'logout',
    };
  }
  if (code === 'ECONNABORTED' || ax.message?.includes('timeout')) {
    return {
      title: '请求超时',
      message: 'AI 推理或网络响应过长。建议换 deepseek-v4-flash 模型或稍后重试。',
      status, code, raw: ax, action: 'switch-model',
    };
  }
  if (ax.message === 'Network Error' || !ax.response) {
    return {
      title: '后端不可达',
      message: '请检查后端服务是否在 3000 端口启动（或刷新页面重试）。',
      status, code, raw: ax, action: 'check-backend',
    };
  }
  if (status === 502 || status === 504) {
    return {
      title: `AI 网关错误（${status}）`,
      message: 'DeepSeek 上游网关异常，建议稍后重试或切换模型。',
      status, code, raw: ax, action: 'switch-model',
    };
  }
  if (status === 429) {
    return {
      title: '调用频次超限（429）',
      message: bizErr || '请 30 秒后重试，或更换 API Key。',
      status, code, raw: ax, action: 'wait',
    };
  }
  if (bizErr) {
    return {
      title: `业务错误 ${status ? `【${status}】` : ''}`,
      message: bizErr.toString(),
      status, code, raw: ax, action: 'retry',
    };
  }
  return {
    title: `请求失败 ${status ? `【HTTP ${status}】` : ''}`,
    message: ax.message?.toString() || '未知错误',
    status, code, raw: ax, action: 'retry',
  };
}
