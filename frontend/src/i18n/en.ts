const en = {
  app: {
    name: 'AI Agent System',
    loading: 'Loading...'
  },
  login: {
    title: 'Welcome Back',
    subtitle: 'Sign in to your account',
    email: 'Email',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    error: 'Invalid email or password',
    noAccount: "Don't have an account?",
    signUp: 'Sign up'
  },
  register: {
    title: 'Create Account',
    subtitle: 'Join us today',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    email: 'Email',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    createAccount: 'Create Account',
    creating: 'Creating...',
    error: 'Registration failed. User may already exist.',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in'
  },
  chat: {
    newChat: 'New Chat',
    conversations: 'Conversations',
    logout: 'Logout',
    send: 'Send',
    sendPlaceholder: 'Type a message...',
    deleteConfirm: 'Are you sure you want to delete this conversation?',
    noConversation: 'Select or create a conversation',
    newConversation: 'New Conversation',
    delete: 'Delete',
    rename: 'Rename'
  },
  common: {
    language: 'Language',
    english: 'English',
    chinese: '中文'
  }
} as const;

export default en;