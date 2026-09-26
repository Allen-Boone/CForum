import { SignJWT, jwtVerify } from 'jose';

interface DBUser {
	id: number;
	email: string;
	username: string;
	password: string;
	verified: number;
	role?: string;
	avatar_url?: string;
	points?: number;
	title?: string;
	badges?: string;
	reg_ip?: string;
	last_ip?: string;
	last_checkin_date?: string;
	created_at?: string;
}

interface AuthUser {
	id: number;
	role: string;
	email: string;
}

const MASTER_SECRET_KEY = new TextEncoder().encode(
	'cforum_master_jwt_secret_key_2026_forever_valid'
);

function jsonResponse(
	data: any,
	status = 200,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers':
				'Content-Type, Authorization, X-Timestamp, X-Nonce',
			...headers
		}
	});
}

async function hashText(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const hash = await crypto.subtle.digest('SHA-256', data);

	return Array.from(new Uint8Array(hash))
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function hashPassword(password: string): Promise<string> {
	return hashText(password.trim());
}

function safeJsonArray(value?: string | null): string[] {
	if (!value) return [];

	try {
		const result = JSON.parse(value);
		return Array.isArray(result) ? result.map(String) : [];
	} catch {
		return [];
	}
}

function getClientIp(request: Request): string {
	const cloudflareIp = request.headers.get('cf-connecting-ip');

	if (cloudflareIp) return cloudflareIp.trim();

	const forwarded = request.headers.get('x-forwarded-for');

	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}

	return '';
}

function normalizeEmail(email: unknown): string {
	return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username: unknown): string {
	return String(username || '').trim();
}

function isValidUsername(username: string): boolean {
	if (username.length < 2 || username.length > 16) return false;

	return /^[\p{L}\p{N}_\-.]+$/u.test(username);
}

function hasRestrictedKeywords(username: string): boolean {
	const restrictedKeywords = [
		'admin',
		'administrator',
		'root',
		'system',
		'sysadmin',
		'moderator',
		'support',
		'service',
		'official',
		'staff',
		'master',
		'官方',
		'客服',
		'站长',
		'管理',
		'系统',
		'总管'
	];

	const lower = username.toLowerCase();

	return restrictedKeywords.some(keyword => lower.includes(keyword));
}

const ALLOWED_EMAIL_DOMAINS = new Set([
	'qq.com',
	'foxmail.com',
	'163.com',
	'126.com',
	'yeah.net',
	'139.com',
	'189.com',
	'aliyun.com',
	'sina.com',
	'sina.cn',
	'gmail.com',
	'outlook.com',
	'hotmail.com',
	'live.com',
	'msn.com',
	'yahoo.com',
	'icloud.com',
	'proton.me',
	'protonmail.com'
]);

function isValidEmailDomain(email: string): boolean {
	const match = email.match(
		/^[^\s@]{1,64}@([a-z0-9.-]+\.[a-z]{2,})$/i
	);

	if (!match) return false;

	return ALLOWED_EMAIL_DOMAINS.has(match[1].toLowerCase());
}

function isSpamContent(value: unknown): boolean {
	const text = String(value || '').trim();

	if (!text) return false;
	if (text.length > 100000) return true;

	if (/(.)\1{11,}/u.test(text)) return true;

	return false;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method.toUpperCase();
		const db = env.cforum_db;
		const bucket = (env as any).BUCKET;
		const clientIp = getClientIp(request);

		if (!db) {
			return jsonResponse(
				{ error: 'D1 数据库尚未绑定' },
				503
			);
		}

		if (method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods':
						'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers':
						'Content-Type, Authorization, X-Timestamp, X-Nonce'
				}
			});
		}

		const ensureSchema = async () => {
			await db.prepare('ALTER TABLE posts ADD COLUMN badge TEXT').run().catch(() => {});
			await db.prepare('ALTER TABLE posts ADD COLUMN reward_points INTEGER DEFAULT 0').run().catch(() => {});
			await db.prepare("ALTER TABLE users ADD COLUMN badges TEXT DEFAULT '[]'").run().catch(() => {});
			await db.prepare('ALTER TABLE users ADD COLUMN reg_ip TEXT').run().catch(() => {});
			await db.prepare('ALTER TABLE users ADD COLUMN last_ip TEXT').run().catch(() => {});
			await db.prepare('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0').run().catch(() => {});
			await db.prepare(`CREATE TABLE IF NOT EXISTS blackhouse (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, reason TEXT, duration TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});
			await db.prepare(`CREATE TABLE IF NOT EXISTS site_badges (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT, color TEXT DEFAULT 'border-amber-500 bg-amber-500/10 text-amber-300', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});
			await db.prepare(`CREATE TABLE IF NOT EXISTS banned_ips (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT UNIQUE NOT NULL, reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});
			await db.prepare(`CREATE TABLE IF NOT EXISTS email_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, code TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});
		};

		const handleError = (error: any): Response => {
			console.error(error);
			const message = error instanceof Error ? error.message : String(error);

			if (message.includes('Unauthorized') || message.includes('Invalid Token')) {
				return jsonResponse({ error: '登录状态无效，请重新登录' }, 401);
			}

			if (message.includes('UNIQUE constraint failed') || message.includes('constraint failed')) {
				return jsonResponse({ error: '该数据已存在，请勿重复提交' }, 409);
			}

			return jsonResponse({ error: '服务器处理失败: ' + message }, 500);
		};

		const authenticate = async (req: Request): Promise<AuthUser> => {
			const authHeader = req.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				throw new Error('Unauthorized');
			}

			const token = authHeader.slice(7).trim();

			try {
				const { payload } = await jwtVerify(token, MASTER_SECRET_KEY);
				const userId = Number((payload as any).id);

				if (!Number.isInteger(userId) || userId < 1) {
					throw new Error('Unauthorized');
				}

				const currentUser = await db
					.prepare('SELECT id, email, username, role FROM users WHERE id = ?')
					.bind(userId)
					.first<{ id: number; email: string; username: string; role: string }>();

				if (!currentUser || currentUser.username === '已注销用户') {
					throw new Error('Unauthorized');
				}

				if (clientIp) {
					ctx.waitUntil(
						db.prepare("UPDATE users SET last_ip = ?, reg_ip = COALESCE(reg_ip, ?) WHERE id = ?")
							.bind(clientIp, clientIp, currentUser.id).run().catch(() => {})
					);
				}

				return {
					id: currentUser.id,
					email: currentUser.email,
					role: currentUser.role || 'user'
				};
			} catch {
				throw new Error('Unauthorized');
			}
		};

		const requireAdmin = async (req: Request): Promise<AuthUser> => {
			const currentUser = await authenticate(req);
			if (currentUser.role !== 'admin') {
				throw new Error('Unauthorized');
			}
			return currentUser;
		};

		if (url.pathname === '/sitemap.xml' && method === 'GET') {
			try {
				const posts = await db
					.prepare(`SELECT id, created_at FROM posts ORDER BY COALESCE(is_pinned, 0) DESC, created_at DESC LIMIT 500`)
					.all<{ id: number; created_at: string }>();

				const postUrls = (posts.results || [])
					.map(post => {
						const postUrl = escapeXml(`https://blog.t20.de5.net/post?id=${post.id}`);
						return `\n\t<url>\n\t\t<loc>${postUrl}</loc>\n\t\t<changefreq>weekly</changefreq>\n\t\t<priority>0.8</priority>\n\t</url>`;
					})
					.join('');

				const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\t<url>\n\t\t<loc>https://blog.t20.de5.net/</loc>\n\t\t<changefreq>daily</changefreq>\n\t\t<priority>1.0</priority>\n\t</url>${postUrls}\n</urlset>`;

				return new Response(sitemapXml, {
					status: 200,
					headers: {
						'Content-Type': 'application/xml; charset=utf-8',
						'Cache-Control': 'public, max-age=1800',
						'Access-Control-Allow-Origin': '*'
					}
				});
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/robots.txt' && method === 'GET') {
			return new Response(
				['User-agent: *', 'Allow: /', 'Sitemap: https://blog.t20.de5.net/sitemap.xml', ''].join('\n'),
				{
					status: 200,
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Cache-Control': 'public, max-age=3600',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		try {
			await ensureSchema();
			if (clientIp) {
				const bannedIp = await db.prepare('SELECT id FROM banned_ips WHERE ip = ?').bind(clientIp).first();
				if (bannedIp) {
					return jsonResponse({ error: '🚫 您的网络 IP 涉嫌违规或恶意攻击，已被自由论坛全站永久物理封锁！' }, 403);
				}
			}
		} catch (error) {
			return handleError(error);
		}

		/*
		 * 发送邮箱验证码
		 */
		if (url.pathname === '/api/auth/send-code' && method === 'POST') {
			try {
				await ensureSchema();
				const body = (await request.json()) as any;
				const email = normalizeEmail(body.email);

				if (!isValidEmailDomain(email)) {
					return jsonResponse({ error: '请输入支持的主流邮箱地址，如 QQ、163、Foxmail 或 Gmail' }, 400);
				}

				const existingUser = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first();
				if (existingUser) {
					return jsonResponse({ error: '该邮箱已经注册，请直接登录' }, 409);
				}

				const nowSeconds = Math.floor(Date.now() / 1000);
				const latestCode = await db.prepare(`SELECT expires_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1`).bind(email).first<{ expires_at: number }>();

				if (latestCode && Number(latestCode.expires_at) - nowSeconds > 240) {
					return jsonResponse({ error: '发送过于频繁，请等待 60 秒后重试' }, 429);
				}

				const sentToday = await db.prepare(`SELECT COUNT(*) AS count FROM email_verifications WHERE email = ? AND created_at > datetime('now', '-1 day')`).bind(email).first<{ count: number }>();
				if (Number(sentToday?.count || 0) >= 10) {
					return jsonResponse({ error: '该邮箱今日发送次数已达上限，请明天再试' }, 429);
				}

				const resendApiKey = String((env as any).RESEND_API_KEY || '').trim();
				if (!resendApiKey) {
					return jsonResponse({ error: '邮件服务尚未配置，请联系站长' }, 503);
				}

				const code = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(10, '0').slice(-6);
				const expiresAt = nowSeconds + 300;
				const storedCode = await hashText(`${email}:${code}`);

				const plainText = `CForum Verification Code: ${code}\n\nYour verification code is ${code}. Please enter this code within 5 minutes to verify your email address.\n\n自由论坛验证码：${code}\n请在 5 分钟内完成验证。如非本人操作，请忽略此邮件。\n\n--\nCForum Support Team\nhttps://blog.t20.de5.net`;

				const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Verification Code</title></head><body style="margin:0;padding:24px 16px;background-color:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#24292f;"><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" style="max-width:540px;width:100%;background-color:#ffffff;border:1px solid #d0d7de;border-radius:6px;padding:32px;box-sizing:border-box;text-align:left;"><tr><td><h2 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#24292f;">CForum Verification Code</h2><p style="margin:0 0 16px 0;font-size:14px;color:#57606a;">Please use the following single-use verification code to complete your registration:</p><div style="margin:20px 0;padding:14px 20px;background-color:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;text-align:center;"><span style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:5px;color:#0969da;">${code}</span></div><p style="margin:0 0 8px 0;font-size:12px;color:#57606a;">This code will expire in 5 minutes. If you did not request this, you can safely ignore this email.</p><p style="margin:0 0 20px 0;font-size:12px;color:#57606a;">验证码有效时间为 5 分钟。如非您本人操作，请忽略此邮件。</p><hr style="border:none;border-top:1px solid #d0d7de;margin:20px 0 16px 0;"><p style="margin:0;font-size:11px;color:#8c959f;text-align:center;">This is an automated notification from CForum. Please do not reply directly.</p></td></tr></table></td></tr></table></body></html>`;

				const resendResponse = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						from: 'CForum <auth@mail.t20.de5.net>',
						to: [email],
						subject: `CForum Verification Code: ${code}`,
						text: plainText,
						html: emailHtml
					})
				});

				const resendData = (await resendResponse.json().catch(() => ({}))) as any;
				if (!resendResponse.ok) {
					return jsonResponse({ error: '邮件发送失败: ' + (resendData?.message || '请稍后重试') }, 502);
				}

				await db.prepare('DELETE FROM email_verifications WHERE email = ?').bind(email).run().catch(() => {});
				await db.prepare(`INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)`).bind(email, storedCode, expiresAt).run();

				return jsonResponse({ success: true, message: '验证码已发送至您的邮箱，请前往查收！' });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/config' && method === 'GET') {
			try {
				const userCount = await db.prepare(`SELECT COUNT(*) AS count FROM users WHERE username != '已注销用户'`).first<{ count: number }>();
				return jsonResponse({
					turnstile_enabled: false,
					turnstile_site_key: '',
					user_count: Number(userCount?.count || 0),
					jwt_secret_configured: true,
					email_verification_enabled: true
				});
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/badges' && method === 'GET') {
			try {
				await ensureSchema();
				const badges = await db.prepare(`SELECT id, name, description, color, created_at FROM site_badges ORDER BY id ASC`).all();
				return jsonResponse(badges.results || []);
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/blackhouse' && method === 'GET') {
			try {
				await ensureSchema();
				const result = await db.prepare(`SELECT id, user_id, username, reason, duration, created_at FROM blackhouse ORDER BY id DESC LIMIT 50`).all();
				return jsonResponse(result.results || []);
			} catch (error) {
				return handleError(error);
			}
		}

		/*
		 * 社区统计（绝对防崩溃鲁棒性设计）
		 */
		if (url.pathname === '/api/community-stats' && method === 'GET') {
			try {
				await ensureSchema();

				let userCount = 0;
				let postCount = 0;
				let commentCount = 0;
				let latestUsers: any[] = [];

				try {
					const uRes = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE username != '已注销用户' AND role != 'banned' AND role != 'deleted'").first<{ count: number }>();
					userCount = Number(uRes?.count || 0);
				} catch (_) {
					const uRes2 = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
					userCount = Number(uRes2?.count || 0);
				}

				try {
					const pRes = await db.prepare('SELECT COUNT(*) AS count FROM posts').first<{ count: number }>();
					postCount = Number(pRes?.count || 0);
				} catch (_) {}

				try {
					const cRes = await db.prepare('SELECT COUNT(*) AS count FROM comments').first<{ count: number }>();
					commentCount = Number(cRes?.count || 0);
				} catch (_) {}

				try {
					const lRes = await db.prepare("SELECT id, username, avatar_url, role, title, badges FROM users WHERE username != '已注销用户' AND role != 'banned' ORDER BY id DESC LIMIT 16").all();
					latestUsers = lRes.results || [];
				} catch (_) {
					try {
						const lRes2 = await db.prepare("SELECT id, username, avatar_url, role FROM users ORDER BY id DESC LIMIT 16").all();
						latestUsers = lRes2.results || [];
					} catch (_) {}
				}

				return jsonResponse({
					topics: postCount,
					replies: commentCount,
					users: userCount,
					latest_users: latestUsers
				});
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/me' && method === 'GET') {
			try {
				const currentUser = await authenticate(request);
				const user = await db.prepare(`SELECT id, username, email, role, avatar_url, points, title, badges, last_checkin_date, created_at FROM users WHERE id = ?`).bind(currentUser.id).first<DBUser>();

				if (!user) return jsonResponse({ error: '用户不存在' }, 404);

				const [postsCount, commentsCount] = await Promise.all([
					db.prepare(`SELECT COUNT(*) AS count FROM posts WHERE author_id = ?`).bind(user.id).first<{ count: number }>(),
					db.prepare(`SELECT COUNT(*) AS count FROM comments WHERE author_id = ?`).bind(user.id).first<{ count: number }>()
				]);

				const postTotal = Number(postsCount?.count || 0);
				const commentTotal = Number(commentsCount?.count || 0);
				const points = Number(user.points || 0);

				let trustLevel = 0;
				if (user.role === 'admin' || user.role === 'moderator') trustLevel = 4;
				else if (user.role === 'elder' || (postTotal >= 4 && commentTotal >= 8 && points >= 50)) trustLevel = 3;
				else if (postTotal >= 2 && commentTotal >= 3) trustLevel = 2;
				else if (commentTotal >= 1 || points >= 5) trustLevel = 1;

				const today = new Date().toISOString().slice(0, 10);

				return jsonResponse({
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role || 'user',
					avatar_url: user.avatar_url,
					points,
					title: user.title || '🌱 初来乍到',
					badges: safeJsonArray(user.badges),
					checked_in_today: user.last_checkin_date === today,
					trust_level: trustLevel,
					stats: { posts_count: postTotal, comments_count: commentTotal, points }
				});
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/user/avatar' && method === 'POST') {
			try {
				const currentUser = await authenticate(request);
				if (currentUser.role === 'banned') return jsonResponse({ error: '该账号已被限制操作' }, 403);

				const body = (await request.json()) as any;
				if (body.username !== undefined) {
					const newName = normalizeUsername(body.username);
					if (!isValidUsername(newName)) return jsonResponse({ error: '用户名须为 2 到 16 个中文、字母、数字、下划线、横线或小数点' }, 400);
					if (currentUser.role !== 'admin' && hasRestrictedKeywords(newName)) return jsonResponse({ error: '该用户名包含官方保留词，禁止使用' }, 400);

					const duplicate = await db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?`).bind(newName, currentUser.id).first();
					if (duplicate) return jsonResponse({ error: '该用户名已被使用' }, 409);

					await db.prepare(`UPDATE users SET username = ? WHERE id = ?`).bind(newName, currentUser.id).run();
				}

				if (body.avatar_url !== undefined) {
					const avatarUrl = String(body.avatar_url || '').trim();
					if (avatarUrl.length > 2048) return jsonResponse({ error: '头像地址过长' }, 400);
					await db.prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`).bind(avatarUrl || null, currentUser.id).run();
				}

				if (body.title !== undefined) {
					const requestedTitle = String(body.title || '').trim();
					if (requestedTitle.length > 32) return jsonResponse({ error: '称号长度不能超过 32 个字符' }, 400);
					if (currentUser.role !== 'admin' && (requestedTitle.includes('站长') || requestedTitle.includes('管理员') || requestedTitle.includes('官方') || requestedTitle.toLowerCase().includes('admin'))) {
						return jsonResponse({ error: '站长与官方专属称号仅限管理员佩戴' }, 403);
					}
					await db.prepare(`UPDATE users SET title = ? WHERE id = ?`).bind(requestedTitle, currentUser.id).run();
				}

				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/user/self' && method === 'DELETE') {
			try {
				const currentUser = await authenticate(request);
				if (currentUser.role === 'admin' || currentUser.id === 1) {
					return jsonResponse({ error: '站长主账号受系统保护，不可注销' }, 400);
				}

				const anonymousEmail = `deleted_${currentUser.id}_${Date.now()}@freedom.invalid`;
				await db.prepare('DELETE FROM likes WHERE user_id = ?').bind(currentUser.id).run().catch(() => {});
				await db.prepare('DELETE FROM checkins WHERE user_id = ?').bind(currentUser.id).run().catch(() => {});
				await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(currentUser.id).run().catch(() => {});
				await db.prepare(`UPDATE users SET username = '已注销用户', email = ?, password = ?, avatar_url = NULL, role = 'deleted', reg_ip = NULL, last_ip = NULL WHERE id = ?`)
					.bind(anonymousEmail, crypto.randomUUID(), currentUser.id).run();

				return jsonResponse({ success: true, message: '账号隐私信息已清除' });
			} catch (error) {
				return handleError(error);
			}
		}

		/*
		 * 注册：真实捕获注册 IP
		 */
		if (url.pathname === '/api/register' && method === 'POST') {
			try {
				await ensureSchema();
				const body = (await request.json()) as any;
				const email = normalizeEmail(body.email);
				const username = normalizeUsername(body.username);
				const password = String(body.password || '').trim();
				const code = String(body.code || '').trim();

				if (!email || !username || !password || !code) {
					return jsonResponse({ error: '请填写邮箱、验证码、用户名和密码' }, 400);
				}
				if (!isValidEmailDomain(email)) return jsonResponse({ error: '本站目前仅支持主流常用邮箱注册' }, 400);
				if (!isValidUsername(username)) return jsonResponse({ error: '用户名须为 2 到 16 个中文、字母、数字、下划线、横线或小数点' }, 400);
				if (hasRestrictedKeywords(username)) return jsonResponse({ error: '用户名包含官方保留词，请更换' }, 400);
				if (password.length < 6 || password.length > 64) return jsonResponse({ error: '密码长度须在 6 到 64 位之间' }, 400);
				if (!/^\d{6}$/.test(code)) return jsonResponse({ error: '请输入正确格式的 6 位邮箱验证码' }, 400);

				const duplicate = await db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`).bind(email, username).first();
				if (duplicate) return jsonResponse({ error: '该用户名或邮箱已经注册' }, 409);

				const nowSeconds = Math.floor(Date.now() / 1000);
				const verification = await db.prepare(`SELECT id, code, expires_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1`).bind(email).first<{ id: number; code: string; expires_at: number }>();
				if (!verification) return jsonResponse({ error: '请先获取邮箱验证码' }, 400);
				if (Number(verification.expires_at) < nowSeconds) return jsonResponse({ error: '验证码已过期，请重新获取' }, 400);

				const submittedCodeHash = await hashText(`${email}:${code}`);
				if (verification.code !== submittedCodeHash) return jsonResponse({ error: '邮箱验证码不正确' }, 400);

				if (clientIp) {
					const registrations = await db.prepare(`SELECT COUNT(*) AS count FROM users WHERE (reg_ip = ? OR last_ip = ?) AND created_at > datetime('now', '-1 day')`).bind(clientIp, clientIp).first<{ count: number }>();
					if (Number(registrations?.count || 0) >= 3) {
						return jsonResponse({ error: '当前网络今日注册次数已达上限' }, 429);
					}
				}

				const passwordHash = await hashPassword(password);
				const insertResult = await db.prepare(`INSERT INTO users (email, username, password, role, verified, points, title, badges, reg_ip, last_ip) VALUES (?, ?, ?, 'user', 1, 0, ?, '[]', ?, ?)`).bind(email, username, passwordHash, '🌱 初来乍到', clientIp || null, clientIp || null).run();

				const userId = Number(insertResult.meta.last_row_id);
				await db.prepare('DELETE FROM email_verifications WHERE email = ?').bind(email).run().catch(() => {});

				const token = await new SignJWT({ id: userId, role: 'user', email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(MASTER_SECRET_KEY);

				return jsonResponse({
					message: '注册成功',
					token,
					user: { id: userId, username, email, role: 'user', points: 0, title: '🌱 初来乍到', badges: [], checked_in_today: false, trust_level: 0 }
				}, 201);
			} catch (error) {
				return handleError(error);
			}
		}

		/*
		 * 登录：每次登录捕获最后活跃 IP
		 */
		if (url.pathname === '/api/login' && method === 'POST') {
			try {
				await ensureSchema();
				const body = (await request.json()) as any;
				const account = String(body.email || body.username || '').trim();
				const password = String(body.password || '').trim();

				if (!account || !password) return jsonResponse({ error: '请输入账号和密码' }, 400);

				const user = await db.prepare(`SELECT id, username, email, password, verified, role, avatar_url, points, title, badges, last_checkin_date FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`).bind(account, account).first<DBUser>();

				if (!user || user.username === '已注销用户' || user.role === 'deleted') {
					return jsonResponse({ error: '账号不存在或已经注销' }, 401);
				}

				if (user.role === 'banned') {
					return jsonResponse({ error: '该账号正在小黑屋反省，暂时无法登录' }, 403);
				}

				const passwordHash = await hashPassword(password);
				if (user.password !== passwordHash) return jsonResponse({ error: '密码不正确' }, 401);

				if (clientIp) {
					await db.prepare("UPDATE users SET last_ip = ?, reg_ip = COALESCE(reg_ip, ?) WHERE id = ?").bind(clientIp, clientIp, user.id).run().catch(() => {});
				}

				const token = await new SignJWT({ id: user.id, role: user.role || 'user', email: user.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(MASTER_SECRET_KEY);
				const today = new Date().toISOString().slice(0, 10);

				return jsonResponse({
					token,
					user: {
						id: user.id,
						username: user.username,
						email: user.email,
						role: user.role || 'user',
						avatar_url: user.avatar_url,
						points: Number(user.points || 0),
						title: user.title || '🌱 初来乍到',
						badges: safeJsonArray(user.badges),
						checked_in_today: user.last_checkin_date === today
					}
				});
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/checkin' && method === 'POST') {
			try {
				const currentUser = await authenticate(request);
				if (currentUser.role === 'banned') return jsonResponse({ error: '该账号当前无法签到' }, 403);

				const user = await db.prepare(`SELECT points, last_checkin_date FROM users WHERE id = ?`).bind(currentUser.id).first<DBUser>();
				const today = new Date().toISOString().slice(0, 10);

				if (user?.last_checkin_date === today) {
					return jsonResponse({ error: '今日已经签到，明天再来', points: Number(user.points || 0) }, 400);
				}

				const reward = Math.floor(Math.random() * 9) + 2;
				await db.prepare(`UPDATE users SET points = COALESCE(points, 0) + ?, last_checkin_date = ? WHERE id = ?`).bind(reward, today, currentUser.id).run();

				return jsonResponse({ success: true, reward, points: Number(user?.points || 0) + reward });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/categories' && method === 'GET') {
			try {
				await ensureSchema();
				const categories = await db.prepare(`SELECT id, name, COALESCE(NULLIF(sort_order, 0), id) AS sort_order, created_at FROM categories ORDER BY COALESCE(NULLIF(sort_order, 0), id) ASC, id ASC`).all();
				return jsonResponse(categories.results || []);
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/categories' && method === 'POST') {
			try {
				await requireAdmin(request);
				await ensureSchema();
				const body = (await request.json()) as any;
				const name = String(body.name || '').trim();
				if (!name || name.length > 20) return jsonResponse({ error: '板块名称不能为空且不能超过 20 个字符' }, 400);

				const maxOrder = await db.prepare(`SELECT MAX(COALESCE(NULLIF(sort_order, 0), id)) AS max_order FROM categories`).first<{ max_order: number }>();
				const nextOrder = Number(maxOrder?.max_order || 0) + 1;
				const result = await db.prepare(`INSERT INTO categories (name, sort_order) VALUES (?, ?)`).bind(name, nextOrder).run();

				return jsonResponse({ success: true, id: result.meta.last_row_id, name, sort_order: nextOrder });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/categories\/\d+\/sort$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const categoryId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const sortOrder = Number(body.sort_order);
				if (!Number.isInteger(sortOrder)) return jsonResponse({ error: '排序值必须是整数' }, 400);

				await db.prepare(`UPDATE categories SET sort_order = ? WHERE id = ?`).bind(sortOrder, categoryId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/categories\/\d+$/.test(url.pathname) && method === 'PUT') {
			try {
				await requireAdmin(request);
				const categoryId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const name = String(body.name || '').trim();
				if (!name || name.length > 20) return jsonResponse({ error: '板块名称不能为空且不能超过 20 个字符' }, 400);

				await db.prepare(`UPDATE categories SET name = ? WHERE id = ?`).bind(name, categoryId).run();
				return jsonResponse({ success: true, name });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/categories\/\d+$/.test(url.pathname) && method === 'DELETE') {
			try {
				await requireAdmin(request);
				const categoryId = Number(url.pathname.split('/')[4]);
				if (categoryId === 9) return jsonResponse({ error: '公告板块为官方保留专区，不可删除' }, 400);

				await db.prepare(`UPDATE posts SET category_id = 1 WHERE category_id = ?`).bind(categoryId).run();
				await db.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/posts' && method === 'GET') {
			try {
				await ensureSchema();
				const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
				const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
				const categoryId = url.searchParams.get('category_id');

				let query = `
					SELECT p.id, p.author_id, p.title, p.content, p.category_id, COALESCE(p.is_pinned, 0) AS is_pinned,
						p.badge, COALESCE(p.reward_points, 0) AS reward_points, COALESCE(p.views, 0) AS view_count, p.created_at,
						u.username AS author_name, u.avatar_url AS author_avatar, u.role AS author_role, u.title AS author_title, u.badges AS author_badges,
						c.name AS category_name,
						(SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
						(SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
					FROM posts p
					LEFT JOIN users u ON p.author_id = u.id
					LEFT JOIN categories c ON p.category_id = c.id
				`;

				const params: any[] = [];
				if (categoryId) {
					query += ' WHERE p.category_id = ?';
					params.push(Number(categoryId));
				}

				query += ` ORDER BY COALESCE(p.is_pinned, 0) DESC, p.created_at DESC LIMIT ? OFFSET ?`;
				params.push(limit, offset);

				const result = await db.prepare(query).bind(...params).all();
				return jsonResponse({ items: result.results || [], total: result.results?.length || 0 });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/posts' && method === 'POST') {
			try {
				const currentUser = await authenticate(request);
				if (currentUser.role === 'banned') return jsonResponse({ error: '该账号当前无法发帖' }, 403);

				const body = (await request.json()) as any;
				const title = String(body.title || '').trim();
				const content = String(body.content || '').trim();
				const categoryId = Number(body.category_id) || 1;

				if (!title || !content) return jsonResponse({ error: '标题与内容不能为空' }, 400);
				if (title.length > 120 || content.length > 100000) return jsonResponse({ error: '标题或正文内容过长' }, 400);
				if (isSpamContent(title) || isSpamContent(content)) return jsonResponse({ error: '检测到重复字符或异常内容，已拒绝提交' }, 400);

				if (categoryId === 9 && currentUser.role !== 'admin') {
					return jsonResponse({ error: '公告板块仅限站长发布' }, 403);
				}

				if (currentUser.role !== 'admin') {
					const latestPost = await db.prepare(`SELECT created_at FROM posts WHERE author_id = ? ORDER BY id DESC LIMIT 1`).bind(currentUser.id).first<{ created_at: string }>();
					if (latestPost?.created_at) {
						const lastTime = new Date(latestPost.created_at.endsWith('Z') ? latestPost.created_at : `${latestPost.created_at}Z`).getTime();
						if (Date.now() - lastTime < 10000) return jsonResponse({ error: '两次发帖间隔须大于 10 秒' }, 429);
					}
				}

				const result = await db.prepare(`INSERT INTO posts (title, content, author_id, category_id) VALUES (?, ?, ?, ?)`).bind(title, content, currentUser.id, categoryId).run();
				return jsonResponse({ success: true, id: result.meta.last_row_id });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+$/.test(url.pathname) && method === 'PUT') {
			try {
				const currentUser = await authenticate(request);
				const postId = Number(url.pathname.split('/')[3]);
				const body = (await request.json()) as any;

				const title = String(body.title || '').trim();
				const content = String(body.content || '').trim();
				const requestedCategory = body.category_id === undefined || body.category_id === null ? null : Number(body.category_id);

				if (!title || !content) return jsonResponse({ error: '标题与内容不能为空' }, 400);

				const post = await db.prepare(`SELECT author_id, category_id FROM posts WHERE id = ?`).bind(postId).first<{ author_id: number; category_id: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);

				if (currentUser.role !== 'admin' && post.author_id !== currentUser.id) {
					return jsonResponse({ error: '无权修改他人帖子' }, 403);
				}

				if (currentUser.role !== 'admin' && (requestedCategory === 9 || post.category_id === 9)) {
					return jsonResponse({ error: '公告板块仅限站长操作' }, 403);
				}

				await db.prepare(`UPDATE posts SET title = ?, content = ?, category_id = COALESCE(?, category_id) WHERE id = ?`).bind(title, content, requestedCategory, postId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+\/badge$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const postId = Number(url.pathname.split('/')[3]);
				const body = (await request.json()) as any;
				const badge = body.badge ? String(body.badge).trim() : null;

				await db.prepare(`UPDATE posts SET badge = ? WHERE id = ?`).bind(badge, postId).run();
				return jsonResponse({ success: true, badge });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+\/reward$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const postId = Number(url.pathname.split('/')[3]);
				const body = (await request.json()) as any;
				const amount = Number(body.amount);

				if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) return jsonResponse({ error: '请输入有效的奖励积分' }, 400);

				const post = await db.prepare(`SELECT author_id FROM posts WHERE id = ?`).bind(postId).first<{ author_id: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);

				await db.batch([
					db.prepare(`UPDATE posts SET reward_points = COALESCE(reward_points, 0) + ? WHERE id = ?`).bind(amount, postId),
					db.prepare(`UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?`).bind(amount, post.author_id)
				]);

				const updated = await db.prepare(`SELECT reward_points FROM posts WHERE id = ?`).bind(postId).first<{ reward_points: number }>();
				return jsonResponse({ success: true, total_reward: Number(updated?.reward_points || 0) });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+$/.test(url.pathname) && method === 'GET') {
			try {
				const postId = Number(url.pathname.split('/')[3]);
				await db.prepare(`UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = ?`).bind(postId).run();

				const post = await db.prepare(`
					SELECT p.id, p.author_id, p.title, p.content, p.category_id, COALESCE(p.is_pinned, 0) AS is_pinned,
						p.badge, COALESCE(p.reward_points, 0) AS reward_points, COALESCE(p.views, 0) AS view_count, p.created_at,
						u.username AS author_name, u.avatar_url AS author_avatar, u.role AS author_role, u.title AS author_title, u.badges AS author_badges,
						c.name AS category_name,
						(SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
						(SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
					FROM posts p
					LEFT JOIN users u ON p.author_id = u.id
					LEFT JOIN categories c ON p.category_id = c.id
					WHERE p.id = ?
				`).bind(postId).first();

				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);
				return jsonResponse(post);
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+\/comments$/.test(url.pathname) && method === 'GET') {
			try {
				const postId = Number(url.pathname.split('/')[3]);
				const comments = await db.prepare(`
					SELECT c.id, c.post_id, c.parent_id, c.author_id, c.content, c.created_at,
						u.username, u.avatar_url, u.role, u.title, u.badges
					FROM comments c
					LEFT JOIN users u ON c.author_id = u.id
					WHERE c.post_id = ?
					ORDER BY c.created_at ASC
				`).bind(postId).all();

				return jsonResponse(comments.results || []);
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+\/comments$/.test(url.pathname) && method === 'POST') {
			try {
				const currentUser = await authenticate(request);
				if (currentUser.role === 'banned') return jsonResponse({ error: '该账号当前无法回复' }, 403);

				const postId = Number(url.pathname.split('/')[3]);
				const body = (await request.json()) as any;
				const content = String(body.content || '').trim();
				const parentId = body.parent_id ? Number(body.parent_id) : null;

				if (!content) return jsonResponse({ error: '评论内容不能为空' }, 400);
				if (content.length > 20000 || isSpamContent(content)) return jsonResponse({ error: '评论内容异常或过长' }, 400);

				const latestComment = await db.prepare(`SELECT created_at FROM comments WHERE author_id = ? ORDER BY id DESC LIMIT 1`).bind(currentUser.id).first<{ created_at: string }>();
				if (currentUser.role !== 'admin' && latestComment?.created_at) {
					const lastTime = new Date(latestComment.created_at.endsWith('Z') ? latestComment.created_at : `${latestComment.created_at}Z`).getTime();
					if (Date.now() - lastTime < 3000) return jsonResponse({ error: '回复过于频繁，请稍后再试' }, 429);
				}

				const result = await db.prepare(`INSERT INTO comments (post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?)`).bind(postId, currentUser.id, parentId, content).run();
				return jsonResponse({ success: true, id: result.meta.last_row_id });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/comments\/\d+$/.test(url.pathname) && method === 'DELETE') {
			try {
				const currentUser = await authenticate(request);
				const commentId = Number(url.pathname.split('/')[3]);

				const comment = await db.prepare(`SELECT author_id FROM comments WHERE id = ?`).bind(commentId).first<{ author_id: number }>();
				if (!comment) return jsonResponse({ error: '评论不存在' }, 404);

				if (currentUser.role !== 'admin' && comment.author_id !== currentUser.id) {
					return jsonResponse({ error: '无权删除他人评论' }, 403);
				}

				await db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/posts\/\d+\/like$/.test(url.pathname) && method === 'POST') {
			try {
				const currentUser = await authenticate(request);
				const postId = Number(url.pathname.split('/')[3]);

				const existingLike = await db.prepare(`SELECT id FROM likes WHERE post_id = ? AND user_id = ?`).bind(postId, currentUser.id).first();
				if (existingLike) {
					await db.prepare(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`).bind(postId, currentUser.id).run();
					return jsonResponse({ liked: false });
				}

				await db.prepare(`INSERT INTO likes (post_id, user_id) VALUES (?, ?)`).bind(postId, currentUser.id).run();
				return jsonResponse({ liked: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if ((/^\/api\/posts\/\d+\/pin$/.test(url.pathname) || /^\/api\/admin\/posts\/\d+\/pin$/.test(url.pathname)) && method === 'POST') {
			try {
				await requireAdmin(request);
				const parts = url.pathname.split('/');
				const postId = Number(parts[parts.length - 2]);
				const body = (await request.json().catch(() => ({}))) as any;

				let weight: number;
				if (body.weight !== undefined) {
					weight = Number(body.weight);
				} else {
					const current = await db.prepare(`SELECT is_pinned FROM posts WHERE id = ?`).bind(postId).first<{ is_pinned: number }>();
					weight = Number(current?.is_pinned || 0) > 0 ? 0 : 1;
				}

				if (!Number.isInteger(weight) || weight < 0 || weight > 9999) return jsonResponse({ error: '置顶权重须为 0 到 9999 的整数' }, 400);

				await db.prepare(`UPDATE posts SET is_pinned = ? WHERE id = ?`).bind(weight, postId).run();
				return jsonResponse({ success: true, weight });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/posts\/\d+\/move$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const postId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const categoryId = Number(body.category_id);
				if (!Number.isInteger(categoryId)) return jsonResponse({ error: '无效的板块编号' }, 400);

				const category = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).first();
				if (!category) return jsonResponse({ error: '目标板块不存在' }, 404);

				await db.prepare(`UPDATE posts SET category_id = ? WHERE id = ?`).bind(categoryId, postId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if ((/^\/api\/posts\/\d+$/.test(url.pathname) || /^\/api\/admin\/posts\/\d+$/.test(url.pathname)) && method === 'DELETE') {
			try {
				const currentUser = await authenticate(request);
				const parts = url.pathname.split('/');
				const postId = Number(parts[parts.length - 1]);

				const post = await db.prepare(`SELECT author_id FROM posts WHERE id = ?`).bind(postId).first<{ author_id: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);

				if (currentUser.role !== 'admin' && post.author_id !== currentUser.id) {
					return jsonResponse({ error: '无权删除他人帖子' }, 403);
				}

				await db.batch([
					db.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId),
					db.prepare('DELETE FROM likes WHERE post_id = ?').bind(postId),
					db.prepare('DELETE FROM posts WHERE id = ?').bind(postId)
				]);

				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/upload' && method === 'POST') {
			try {
				await authenticate(request);
				if (!bucket) return jsonResponse({ error: 'R2 存储尚未绑定' }, 503);

				const formData = await request.formData();
				const file = formData.get('file') as File | null;
				if (!file) return jsonResponse({ error: '请选择上传文件' }, 400);
				if (file.size > 10 * 1024 * 1024) return jsonResponse({ error: '上传文件不能超过 10MB' }, 400);

				const fileName = file.name || 'file';
				const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
				const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

				await bucket.put(key, await file.arrayBuffer(), {
					httpMetadata: { contentType: file.type || 'application/octet-stream' }
				});

				return jsonResponse({ url: `https://cforum.day86530.workers.dev/r2/${key}` });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname.startsWith('/r2/') && method === 'GET') {
			if (!bucket) return new Response('R2 not configured', { status: 503 });
			const key = url.pathname.slice(4);
			const object = await bucket.get(key);
			if (!object) return new Response('Not Found', { status: 404 });

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('ETag', object.httpEtag);
			headers.set('Cache-Control', 'public, max-age=31536000, immutable');
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('X-Content-Type-Options', 'nosniff');

			return new Response(object.body, { headers });
		}

		if (url.pathname === '/api/admin/stats' && method === 'GET') {
			try {
				await requireAdmin(request);
				const [userCount, postCount, commentCount] = await Promise.all([
					db.prepare(`SELECT COUNT(*) AS count FROM users WHERE username != '已注销用户' AND role != 'deleted'`).first<{ count: number }>(),
					db.prepare('SELECT COUNT(*) AS count FROM posts').first<{ count: number }>(),
					db.prepare('SELECT COUNT(*) AS count FROM comments').first<{ count: number }>()
				]);

				return jsonResponse({
					users: Number(userCount?.count || 0),
					posts: Number(postCount?.count || 0),
					comments: Number(commentCount?.count || 0)
				});
			} catch (error) {
				return handleError(error);
			}
		}

		/*
		 * 管理员用户管理列表（返回真实 IP）
		 */
		if (url.pathname === '/api/admin/users' && method === 'GET') {
			try {
				await requireAdmin(request);
				await ensureSchema();

				const result = await db.prepare(`SELECT id, email, username, role, verified, created_at, avatar_url, points, title, badges, COALESCE(last_ip, reg_ip) AS reg_ip FROM users ORDER BY id DESC`).all();
				return jsonResponse(result.results || []);
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/badges' && method === 'POST') {
			try {
				await requireAdmin(request);
				await ensureSchema();
				const body = (await request.json()) as any;
				const name = String(body.name || '').trim();
				const description = String(body.description || '').trim();
				const color = String(body.color || 'border-amber-500 bg-amber-500/10 text-amber-300').trim();

				if (!name || name.length > 32) return jsonResponse({ error: '勋章名称不能为空且不能超过 32 个字符' }, 400);

				await db.prepare(`INSERT INTO site_badges (name, description, color) VALUES (?, ?, ?)`).bind(name, description.slice(0, 100), color.slice(0, 200)).run();
				return jsonResponse({ success: true, name });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/badges\/\d+$/.test(url.pathname) && method === 'DELETE') {
			try {
				await requireAdmin(request);
				const badgeId = Number(url.pathname.split('/')[4]);
				await db.prepare('DELETE FROM site_badges WHERE id = ?').bind(badgeId).run();
				return jsonResponse({ success: true });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/ban-ip' && method === 'POST') {
			try {
				await requireAdmin(request);
				await ensureSchema();
				const body = (await request.json()) as any;
				const targetIp = String(body.ip || '').trim();
				const reason = String(body.reason || '站长手动封禁异常 IP').trim().slice(0, 200);

				if (!targetIp || targetIp === '127.0.0.1') return jsonResponse({ error: '无效的 IP 地址' }, 400);
				if (clientIp && targetIp === clientIp) return jsonResponse({ error: '为防止站长失去访问权限，不能封禁当前管理 IP' }, 400);

				await db.prepare(`INSERT OR IGNORE INTO banned_ips (ip, reason) VALUES (?, ?)`).bind(targetIp, reason).run();
				await db.prepare(`UPDATE users SET role = 'banned' WHERE (reg_ip = ? OR last_ip = ?) AND id != 1`).bind(targetIp, targetIp).run();

				return jsonResponse({ success: true, ip: targetIp });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/users/batch-delete' && method === 'POST') {
			try {
				await requireAdmin(request);
				const body = (await request.json()) as any;
				const userIds = Array.isArray(body.ids) ? Array.from(new Set(body.ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 1))) : [];
				if (!userIds.length) return jsonResponse({ error: '请选择要删除的用户' }, 400);

				for (let start = 0; start < userIds.length; start += 50) {
					const batchIds = userIds.slice(start, start + 50);
					const placeholders = batchIds.map(() => '?').join(',');

					await db.prepare(`DELETE FROM likes WHERE user_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});
					await db.prepare(`DELETE FROM checkins WHERE user_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});
					await db.prepare(`DELETE FROM sessions WHERE user_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});
					await db.prepare(`DELETE FROM comments WHERE author_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});
					await db.prepare(`DELETE FROM posts WHERE author_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});
					await db.prepare(`DELETE FROM users WHERE id IN (${placeholders}) AND id != 1`).bind(...batchIds).run();
				}

				return jsonResponse({ success: true, count: userIds.length });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/users/batch-banish' && method === 'POST') {
			try {
				await requireAdmin(request);
				const body = (await request.json()) as any;
				const userIds = Array.isArray(body.ids) ? Array.from(new Set(body.ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 1))) : [];
				if (!userIds.length) return jsonResponse({ error: '请选择要关押的用户' }, 400);

				const reason = String(body.reason || '站长批量处分异常账号').trim().slice(0, 200);
				const duration = String(body.duration || '永久封禁').trim().slice(0, 50);

				for (let start = 0; start < userIds.length; start += 50) {
					const batchIds = userIds.slice(start, start + 50);
					const placeholders = batchIds.map(() => '?').join(',');

					const selectedUsers = await db.prepare(`SELECT id, username FROM users WHERE id IN (${placeholders}) AND id != 1`).bind(...batchIds).all<{ id: number; username: string }>();
					await db.prepare(`UPDATE users SET role = 'banned' WHERE id IN (${placeholders}) AND id != 1`).bind(...batchIds).run();
					await db.prepare(`DELETE FROM sessions WHERE user_id IN (${placeholders})`).bind(...batchIds).run().catch(() => {});

					for (const selected of selectedUsers.results || []) {
						await db.prepare(`INSERT INTO blackhouse (user_id, username, reason, duration) VALUES (?, ?, ?, ?)`).bind(selected.id, selected.username, reason, duration).run();
					}
				}

				return jsonResponse({ success: true, count: userIds.length });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/users\/\d+\/banish$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const userId = Number(url.pathname.split('/')[4]);
				if (userId === 1) return jsonResponse({ error: '站长主账号受系统保护' }, 400);

				const body = (await request.json()) as any;
				const reason = String(body.reason || '违反社区规则').trim().slice(0, 200);
				const duration = String(body.duration || '永久封禁').trim().slice(0, 50);

				const target = await db.prepare(`SELECT username FROM users WHERE id = ?`).bind(userId).first<{ username: string }>();
				if (!target) return jsonResponse({ error: '用户不存在' }, 404);

				await db.prepare(`UPDATE users SET role = 'banned' WHERE id = ?`).bind(userId).run();
				await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run().catch(() => {});
				await db.prepare(`INSERT INTO blackhouse (user_id, username, reason, duration) VALUES (?, ?, ?, ?)`).bind(userId, target.username, reason, duration).run();

				return jsonResponse({ success: true, username: target.username });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/users\/\d+\/role$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const userId = Number(url.pathname.split('/')[4]);
				if (userId === 1) return jsonResponse({ error: '站长主账号角色不可更改' }, 400);

				const body = (await request.json()) as any;
				const role = String(body.role || '').trim();
				const allowedRoles = new Set(['user', 'moderator', 'elder', 'vip', 'pro', 'active', 'banned']);
				if (!allowedRoles.has(role)) return jsonResponse({ error: '无效的角色类型' }, 400);

				await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).bind(role, userId).run();
				return jsonResponse({ success: true, role });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/users\/\d+\/rename$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const userId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const username = normalizeUsername(body.username);

				if (!isValidUsername(username)) return jsonResponse({ error: '用户名须为 2 到 16 个中文、字母、数字、下划线、横线或小数点' }, 400);

				const duplicate = await db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?`).bind(username, userId).first();
				if (duplicate) return jsonResponse({ error: '该用户名已被占用' }, 409);

				await db.prepare(`UPDATE users SET username = ? WHERE id = ?`).bind(username, userId).run();
				return jsonResponse({ success: true, username });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/users\/\d+\/badges$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const userId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const badges = Array.isArray(body.badges) ? Array.from(new Set(body.badges.map((value: unknown) => String(value).trim()).filter(Boolean))).slice(0, 30) : [];

				await db.prepare(`UPDATE users SET badges = ? WHERE id = ?`).bind(JSON.stringify(badges), userId).run();
				return jsonResponse({ success: true, badges });
			} catch (error) {
				return handleError(error);
			}
		}

		if (url.pathname === '/api/admin/users/batch-badges' && method === 'POST') {
			try {
				await requireAdmin(request);
				await ensureSchema();
				const body = (await request.json()) as any;
				const badge = String(body.badge || '').trim();
				const scope = body.scope === 'top100' ? 'top100' : 'all';

				if (!badge || badge.length > 32) return jsonResponse({ error: '请选择有效勋章' }, 400);

				let query = `SELECT id, badges FROM users WHERE username != '已注销用户' AND role != 'banned' AND role != 'deleted'`;
				if (scope === 'top100') query += ' ORDER BY id ASC LIMIT 100';

				const targetUsers = await db.prepare(query).all<{ id: number; badges: string }>();
				let affected = 0;

				for (const target of targetUsers.results || []) {
					const badges = safeJsonArray(target.badges);
					if (!badges.includes(badge)) {
						badges.push(badge);
						await db.prepare(`UPDATE users SET badges = ? WHERE id = ?`).bind(JSON.stringify(badges), target.id).run();
						affected++;
					}
				}

				return jsonResponse({ success: true, affected, badge });
			} catch (error) {
				return handleError(error);
			}
		}

		if (/^\/api\/admin\/users\/\d+\/points$/.test(url.pathname) && method === 'POST') {
			try {
				await requireAdmin(request);
				const userId = Number(url.pathname.split('/')[4]);
				const body = (await request.json()) as any;
				const amount = Number(body.amount);

				if (!Number.isInteger(amount) || Math.abs(amount) > 100000) return jsonResponse({ error: '请输入有效的整数' }, 400);

				await db.prepare(`UPDATE users SET points = MAX(0, COALESCE(points, 0) + ?) WHERE id = ?`).bind(amount, userId).run();
				const updated = await db.prepare(`SELECT points FROM users WHERE id = ?`).bind(userId).first<{ points: number }>();

				return jsonResponse({ success: true, points: Number(updated?.points || 0) });
			} catch (error) {
				return handleError(error);
			}
		}

		return jsonResponse({ error: '接口不存在: ' + url.pathname }, 404);
	}
};
