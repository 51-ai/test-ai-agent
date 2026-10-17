const zh = {
  app: {
    name: 'AI 智能代理系统',
    loading: '加载中...'
  },
  login: {
    title: '欢迎回来',
    subtitle: '登录您的账户',
    email: '邮箱',
    emailPlaceholder: '请输入您的邮箱',
    password: '密码',
    passwordPlaceholder: '请输入您的密码',
    signIn: '登录',
    signingIn: '正在登录...',
    error: '邮箱或密码无效',
    noAccount: '还没有账户？',
    signUp: '注册'
  },
  register: {
    title: '创建账户',
    subtitle: '立即加入我们',
    username: '用户名',
    usernamePlaceholder: '请输入用户名',
    email: '邮箱',
    emailPlaceholder: '请输入邮箱',
    password: '密码',
    passwordPlaceholder: '请输入密码',
    createAccount: '创建账户',
    creating: '正在创建...',
    error: '注册失败，用户可能已存在',
    haveAccount: '已有账户？',
    signIn: '登录'
  },
  chat: {
    newChat: '新建对话',
    conversations: '对话列表',
    logout: '退出登录',
    send: '发送',
    sendPlaceholder: '输入消息...',
    deleteConfirm: '确定要删除这个对话吗？',
    noConversation: '请选择或创建一个对话',
    newConversation: '新对话',
    delete: '删除',
    rename: '重命名'
  },
  common: {
    language: '语言',
    english: 'English',
    chinese: '中文'
  }
} as const;

export default zh;