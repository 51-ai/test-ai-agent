import { Router, Request, Response, NextFunction } from 'express';
import * as OTPAuth from 'otpauth';
import bcrypt from 'bcrypt';
import * as qrcode from 'qrcode';
import { User, IUser } from '../models/User';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { config } from '../config';
import { generateToken } from '../utils/jwt';
import { getAuditSystem } from '../core/audit/AuditSystem';

const auditSystem = getAuditSystem();

export const mfaRouter = Router();

const BACKUP_CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ISSUER_NAME = 'AIAgent';

function genBackupCodesPlain(count = 6, len = 8): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 100) {
    attempts++;
    const chars: string[] = [];
    for (let i = 0; i < len; i++) {
      chars.push(BACKUP_CODE_ALPHABET[Math.floor(Math.random() * BACKUP_CODE_ALPHABET.length)]);
    }
    const code = chars.join('');
    if (used.has(code)) continue;
    used.add(code);
    out.push(code);
  }
  return out;
}

function base64EncodeSecret(plain: string): string {
  return Buffer.from(plain, 'utf8').toString('base64');
}

function base64DecodeSecret(encoded: string | undefined | null): string {
  if (!encoded) return '';
  try {
    return Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function makeTOTP(email: string, secretBase32: string): OTPAuth.TOTP {
  const secret = OTPAuth.Secret.fromBase32(secretBase32);
  return new OTPAuth.TOTP({
    issuer: ISSUER_NAME,
    label: `${ISSUER_NAME}:${email}`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
}

function logAudit(actorId: string | undefined, actorName: string | undefined, action: string, extra?: any) {
  try {
    const baseDetails: Record<string, unknown> = extra && typeof extra === 'object' && !Array.isArray(extra)
      ? { ...extra, actorId: actorId || 'system', actorName: actorName || 'unknown' }
      : { summary: extra ? String(extra) : '', actorId: actorId || 'system', actorName: actorName || 'unknown' };
    auditSystem.log({
      category: 'security' as any,
      level: 'info' as any,
      action,
      resource: 'mfa',
      details: baseDetails,
      result: 'success',
    });
  } catch (_) { /* audit failure never blocks */ }
}

mfaRouter.post('/setup', authenticate, async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = (await User.findById(userId)) as IUser | null;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (user.totpEnabled) {
      // 已启用：不允许重新生成，需先 disable 再 setup
      return res.status(400).json({
        error: '双因素认证已启用，请先禁用再重新设置（需验证当前密码）'
      });
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;
    const totp = makeTOTP(user.email, secretBase32);
    const uri = totp.toString();

    let qrcodeDataUrl = '';
    try {
      qrcodeDataUrl = await qrcode.toDataURL(uri, { margin: 1, width: 256, errorCorrectionLevel: 'medium' });
    } catch (_) {
      qrcodeDataUrl = '';
    }

    const backupCodesPlain = genBackupCodesPlain(6, 8);
    const rounds = 8;
    const backupCodesHashed = await Promise.all(
      backupCodesPlain.map((c) => bcrypt.hash(c, rounds)),
    );

    user.totpSecret = base64EncodeSecret(secretBase32);
    user.totpBackupCodes = backupCodesHashed;
    user.totpUsedBackupMask = 0;
    user.totpEnabled = false;
    await user.save();

    logAudit(user.id, user.username, 'mfa_setup_generate');

    return res.json({
      secret: secretBase32,
      uri,
      qrcodeDataUrl,
      backupCodes: backupCodesPlain,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '生成双因素配置失败' });
  }
});

mfaRouter.post('/verify-setup', authenticate, async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = (await User.findById(userId)) as IUser | null;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.totpEnabled) return res.status(400).json({ error: '已启用，无需再次验证' });
    if (!user.totpSecret) return res.status(400).json({ error: '未生成配置，请先调用 /setup' });

    const code = String((req.body as any)?.code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '请输入 6 位数字验证码' });

    const secretBase32 = base64DecodeSecret(user.totpSecret);
    if (!secretBase32) return res.status(500).json({ error: '密钥存储错误' });

    const totp = makeTOTP(user.email, secretBase32);
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return res.status(400).json({ error: '验证码不正确或已过期' });
    }

    user.totpEnabled = true;
    await user.save();
    logAudit(user.id, user.username, 'mfa_setup');

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '验证失败' });
  }
});

mfaRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const email = String((req.body as any)?.email || '').trim();
    const mfaCodeRaw = String((req.body as any)?.mfaCode || '').trim();
    const backupCodeRaw = String((req.body as any)?.backupCode || '').trim();

    if (!email) return res.status(400).json({ error: '缺少 email 参数' });

    const user = (await User.findOne({ email })) as IUser | null;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.totpEnabled) return res.status(400).json({ error: '用户未启用双因素认证' });

    const secretBase32 = base64DecodeSecret(user.totpSecret);
    if (!secretBase32) return res.status(500).json({ error: '密钥存储错误' });

    let ok = false;
    let matchedBackupIdx = -1;

    const code = mfaCodeRaw.replace(/\s+/g, '');
    if (/^\d{6}$/.test(code)) {
      const totp = makeTOTP(user.email, secretBase32);
      const delta = totp.validate({ token: code, window: 1 });
      ok = delta !== null;
    }

    if (!ok && backupCodeRaw) {
      const bc = backupCodeRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (bc.length !== 8) {
        return res.status(400).json({ error: '备份码应为 8 位字母或数字' });
      }
      const codes = user.totpBackupCodes || [];
      for (let i = 0; i < codes.length; i++) {
        const used = ((user.totpUsedBackupMask ?? 0) >> i) & 1;
        if (used) continue;
        try {
          const match = await bcrypt.compare(bc, codes[i]);
          if (match) {
            matchedBackupIdx = i;
            ok = true;
            break;
          }
        } catch (_) { continue; }
      }
      if (!ok) {
        return res.status(400).json({ error: '备份码不正确或已被使用' });
      }
    }

    if (!ok) {
      return res.status(400).json({
        error: (mfaCodeRaw && !backupCodeRaw) ? '6 位验证码不正确' : '请输入 6 位验证码或 8 位备份码',
      });
    }

    if (matchedBackupIdx >= 0) {
      const mask = (user.totpUsedBackupMask ?? 0) | (1 << matchedBackupIdx);
      user.totpUsedBackupMask = mask;
      await user.save();
      logAudit(user.id, user.username, 'mfa_login_backup', { idx: matchedBackupIdx });
    } else {
      logAudit(user.id, user.username, 'mfa_login_totp');
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user._id?.toString?.() ?? (user as any).id,
        username: user.username,
        email: user.email,
        role: user.role,
        totpEnabled: !!user.totpEnabled,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '双因素验证失败' });
  }
});

mfaRouter.post('/disable', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = (await User.findById(userId)) as IUser | null;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const currentPassword = String((req.body as any)?.currentPassword || '');
    if (!currentPassword) return res.status(400).json({ error: '请输入当前密码' });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ error: '密码不正确' });

    user.totpEnabled = false;
    (user as any).totpSecret = undefined;
    (user as any).totpBackupCodes = [];
    user.totpUsedBackupMask = 0;
    await user.save();
    logAudit(user.id, user.username, 'mfa_disable');

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '禁用双因素失败' });
  }
});

mfaRouter.post('/regen-backups', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = (await User.findById(userId)) as IUser | null;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.totpEnabled) return res.status(400).json({ error: '尚未启用双因素认证' });

    const password = String((req.body as any)?.password || (req.body as any)?.currentPassword || '');
    if (!password) return res.status(400).json({ error: '请输入当前密码' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: '密码不正确' });

    const backupCodesPlain = genBackupCodesPlain(6, 8);
    const rounds = 8;
    const backupCodesHashed = await Promise.all(
      backupCodesPlain.map((c) => bcrypt.hash(c, rounds)),
    );
    user.totpBackupCodes = backupCodesHashed;
    user.totpUsedBackupMask = 0;
    await user.save();
    logAudit(user.id, user.username, 'mfa_regen_backups');

    return res.json({ success: true, backupCodes: backupCodesPlain });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '重新生成备份码失败' });
  }
});

export default mfaRouter;
