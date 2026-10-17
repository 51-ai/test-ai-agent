import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
// 注意：这里 Login 用的是 axiosInstance 的 .post() 方法，所以必须 default 导入 api.ts
// 其他组件 import { authAPI } from '../services/api' 是具名方法集（login/register/...），二者用途不同
import authAPI from '../services/api';
import { useAuth } from '../authContext';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [devKey, setDevKey] = useState('');

  useEffect(() => {
    const storedKey = sessionStorage.getItem('developerKey');
    if (storedKey) setDevKey(storedKey);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const EMAIL_RE = /^\S+@\S+\.\S+$/;
    if (!EMAIL_RE.test(formData.email.trim())) {
      setMessage('邮箱格式不正确，请输入 用户名@域名.后缀');
      return;
    }
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? { username: formData.username, email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password };
      const { data } = await authAPI.post(endpoint, payload);

      if (data && data.token) {
        login(data.token, data.user);
        navigate(isRegister ? '/chat' : '/admin');
      } else {
        setMessage(isRegister ? '注册成功！请登录' : '登录成功！');
      }
    } catch (error: any) {
      const resp = error?.response;
      if (resp && resp.status === 403 && resp.data?.mfaRequired) {
        setMfaRequired(true);
        setMfaEmail(resp.data.email || formData.email);
        setMfaUserId(resp.data.userId || '');
        setMfaCode('');
        setMessage('请输入双因素验证码完成登录');
        return;
      }
      setMessage((error as any).response?.data?.error || (error as Error).message);
    }
  };

  const handleSubmitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const payload: any = {
        email: mfaEmail,
        mfaCode: useBackupCode ? undefined : mfaCode,
        backupCode: useBackupCode ? mfaCode : undefined,
      };
      if (mfaUserId) payload.userId = mfaUserId;

      const { data } = await axios.post('/api/auth/mfa/login', payload);
      if (data?.token) {
        login(data.token, data.user);
        setMfaRequired(false);
        navigate('/admin');
      } else {
        setMessage('验证响应缺少 token');
      }
    } catch (error: any) {
      setMessage((error as any).response?.data?.error || (error as Error).message || 'MFA 验证失败');
    }
  };

  const handleDevKeySave = () => {
    if (devKey.trim()) {
      sessionStorage.setItem('developerKey', devKey.trim());
      setMessage('开发者密钥已保存');
    } else {
      sessionStorage.removeItem('developerKey');
      setMessage('开发者密钥已清除');
    }
  };

  if (mfaRequired) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>🔐 双因素认证</h2>
          <p style={{ color: '#a0aec0', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
            账号：<b style={{ color: '#e6f7ff' }}>{mfaEmail}</b>
          </p>
          <form onSubmit={handleSubmitMfa} style={styles.form}>
            <label style={styles.label}>
              {useBackupCode ? '备份码（8 位）' : '6 位验证码'}
              <input
                type="text"
                autoFocus
                maxLength={useBackupCode ? 8 : 6}
                pattern={useBackupCode ? '[A-Z0-9]{8}' : '[0-9]{6}'}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.trim().toUpperCase())}
                style={{
                  ...styles.input,
                  letterSpacing: 6,
                  fontSize: 20,
                  textAlign: 'center',
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                }}
                placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              />
            </label>
            <button type="submit" style={styles.button}>
              提交{useBackupCode ? '备份码' : '验证码'}
            </button>
            <button
              type="button"
              onClick={() => {
                setUseBackupCode((v) => !v);
                setMfaCode('');
              }}
              style={{
                ...styles.button,
                background: 'transparent',
                border: '1px solid rgba(99,102,241,.5)',
                color: '#818cf8',
                marginTop: 8,
              }}
            >
              {useBackupCode ? '← 返回使用 6 位 TOTP 验证码' : '使用备份码登录'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaRequired(false);
                setMfaCode('');
                setMfaEmail('');
                setMfaUserId('');
                setFormData({ username: '', email: '', password: '' });
              }}
              style={{
                ...styles.button,
                background: 'transparent',
                border: '1px solid rgba(160,174,192,.35)',
                color: '#a0aec0',
                marginTop: 8,
              }}
            >
              ← 返回账号密码登录
            </button>
          </form>
          {message && <p style={styles.message}>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isRegister ? '注册' : '登录'}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <label style={styles.label}>
              用户名
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={styles.input}
              />
            </label>
          )}
          <label style={styles.label}>
            邮箱
            <input
              type="text"
              required
              pattern="^\S+@\S+\.\S+$"
              title="请输入有效邮箱地址（xxx@yyy.zz）"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            密码
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={styles.input}
            />
          </label>
          <button type="submit" style={styles.button}>
            {isRegister ? '注册' : '登录'}
          </button>
          <p style={{ textAlign: 'right', margin: 0 }}>
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              style={{
                background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, padding: 0,
              }}
            >
              {isRegister ? '已有账号？登录' : '没有账号？注册'}
            </button>
          </p>
        </form>
        {import.meta.env.VITE_QUICK_LOGIN !== '0' && import.meta.env.DEV && (
          <>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowQuickLogin(!showQuickLogin)}
                style={{
                  background: 'none',
                  border: '1px dashed rgba(99,102,241,.45)',
                  color: '#818cf8',
                  padding: '6px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {showQuickLogin ? '收起' : '⚙️ 开发者密钥设置'}
              </button>
            </div>
            {showQuickLogin && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  border: '1px solid rgba(99,102,241,.25)',
                  borderRadius: 10,
                  background: 'rgba(99,102,241,.06)',
                }}
              >
                <label style={{ ...styles.label, fontSize: 12 }}>
                  开发者 API 密钥 (X-Developer-Key)
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="输入开发者 API 密钥"
                    value={devKey}
                    onChange={(e) => setDevKey(e.target.value)}
                    style={{ ...styles.input, fontSize: 13 }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDevKeySave}
                  style={{
                    ...styles.button,
                    fontSize: 13,
                    padding: '8px 12px',
                    marginTop: 10,
                    width: '100%',
                  }}
                >
                  💾 保存密钥
                </button>
                <p style={{ fontSize: 11, color: '#7fa8c9', marginTop: 10, marginBottom: 0 }}>
                  🔒 仅用于开发者大屏 API 调用，不绕过正常登录流程
                </p>
              </div>
            )}
          </>
        )}
        {message && <p style={styles.message}>{message}</p>}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link to="/" style={{ color: '#6366f1', fontSize: 14 }}>
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#1a202c',
    fontWeight: 600,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    fontWeight: 500,
    color: '#4a5568',
    gap: 6,
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  button: {
    marginTop: 10,
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'transform 0.1s',
  },
  message: {
    marginTop: 16,
    padding: 10,
    borderRadius: 8,
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
};
