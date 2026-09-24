import { sendEmail } from './smtp';
import { generateIdenticon } from './identicon';
import { uploadImage, deleteImage, listAllKeys, getPublicUrl, getKeyFromUrl, S3Env } from './s3';
import * as OTPAuth from 'otpauth';
import { Security, UserPayload } from './security';

interface DBUser {
    id: number;
    email: string;
    username: string;
    password: string;
    verified: number;
    role?: string;
    avatar_url?: string;
    totp_secret?: string;
    totp_enabled?: number;
    email_notifications?: number;
    reset_token?: string;
    reset_token_expires?: number;
    pending_email?: string;
    verification_token?: string;
    email_change_token?: string;
    points?: number;
    title?: string;
    last_checkin_date?: string;
}

interface PostAuthorInfo {
    title: string;
    author_id: number;
    email: string;
    email_notifications: number;
    username: string;
}

interface DBUserEmail { email: string; }
interface DBUserTotp { totp_secret: string; }
interface DBCount { count: number; }
interface DBSetting { value: string; }

// Utility: JSON Response (全站跨域允许 CORS)
function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Nonce',
            ...headers,
        },
    });
}

// Utility: Hash Password
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Utility: Generate Secure Token
function generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

		// 跨域预检直接放行
		if (method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Nonce',
				}
			});
		}

		// Initialize Security with Worker env
		const security = new Security(env);

		// Helper to extract authenticated user
		const authenticate = async (req: Request) => {
			const authHeader = req.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				throw new Error('Unauthorized');
			}
			const token = authHeader.split(' ')[1];
			const payload = await security.verifyToken(token);
			if (!payload) {
				throw new Error('Unauthorized');
			}
			return payload;
		};

		// Helper to handle errors
		const handleError = (e: any) => {
			const errString = String(e);
			if (errString.includes('Unauthorized') || errString.includes('Invalid Token')) {
				return jsonResponse({ error: 'Unauthorized' }, 401);
			}
			return jsonResponse({ error: errString }, 500);
		};

		// GET /api/config
		if (url.pathname === '/api/config' && method === 'GET') {
			try {
				const [setting, userCount] = await Promise.all([
					env.cforum_db.prepare("SELECT value FROM settings WHERE key = 'turnstile_enabled'").first<DBSetting>(),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM users').first('count')
				]);
				
				const dbEnabled = setting ? setting.value === '1' : false;
				const siteKey = (env as any).TURNSTILE_SITE_KEY || '';
				const secretKey = (env as any).TURNSTILE_SECRET_KEY || '';
				const effectiveEnabled = dbEnabled && !!siteKey && !!secretKey;
				const jwtConfigured = Boolean((env as any).JWT_SECRET);

				return jsonResponse({
					turnstile_enabled: effectiveEnabled,
					turnstile_site_key: effectiveEnabled ? siteKey : '',
					user_count: userCount ? (userCount as any).count : 0,
					jwt_secret_configured: jwtConfigured
				});
			} catch (e) {
				return handleError(e);
			}
		}

		// Helper function for Turnstile verification
		const checkTurnstile = async (body: any, ip: string): Promise<boolean> => {
			try {
				const setting = await env.cforum_db.prepare("SELECT value FROM settings WHERE key = 'turnstile_enabled'").first<DBSetting>();
				const dbEnabled = setting ? setting.value === '1' : false;
				const siteKey = (env as any).TURNSTILE_SITE_KEY || '';
				const secretKey = (env as any).TURNSTILE_SECRET_KEY || '';
				
				if (!dbEnabled || !siteKey || !secretKey) {
					return true;
				}

				const turnstileToken = body['cf-turnstile-response'];
				if (!turnstileToken) {
					return false;
				}

				return await security.verifyTurnstile(turnstileToken, ip);
			} catch (e) {
				console.error('Turnstile check error:', e);
				return false;
			}
		};

		const isVisuallyEmpty = (str: string): boolean => str.replace(/[\s\u200B-\u200D\uFEFF\u00A0\u3000]/g, '').length === 0;
		const hasInvisibleCharacters = (str: string): boolean => /[\u200B-\u200D\uFEFF\u00A0\u3000]/.test(str);
		const hasControlCharacters = (str: string): boolean => /[\u0000-\u001F\u007F-\u009F]/.test(str);
		const hasRestrictedKeywords = (username: string): boolean => {
			const restrictedKeywords = ['admin', 'administrator', 'root', 'system', 'sysadmin', 'moderator', 'mod', 'support', 'help', 'service', 'cforum', 'official', 'staff', 'team', 'master'];
			const lowerUsername = username.toLowerCase();
			return restrictedKeywords.some(keyword => lowerUsername.includes(keyword));
		};

		// POST /api/register
		if (url.pathname === '/api/register' && method === 'POST') {
			try {
				const body = await request.json() as any;
				const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
				if (!(await checkTurnstile(body, ip))) return jsonResponse({ error: 'Turnstile verification failed' }, 403);

				const { email, username, password } = body;
				if (!email || !username || !password) return jsonResponse({ error: 'Missing email, username or password' }, 400);
				if (email.length > 50) return jsonResponse({ error: 'Email too long (Max 50 chars)' }, 400);
				if (username.length > 20) return jsonResponse({ error: 'Username too long (Max 20 chars)' }, 400);
				if (isVisuallyEmpty(username)) return jsonResponse({ error: 'Username cannot be empty' }, 400);
				if (hasInvisibleCharacters(username)) return jsonResponse({ error: 'Username contains invalid invisible characters' }, 400);
				if (hasControlCharacters(username)) return jsonResponse({ error: 'Username contains invalid control characters' }, 400);
				if (hasRestrictedKeywords(username)) return jsonResponse({ error: 'Username contains restricted keywords' }, 400);
				if (password.length < 8 || password.length > 16) return jsonResponse({ error: 'Password must be 8-16 characters' }, 400);

				const existing = await env.cforum_db.prepare('SELECT email, username FROM users WHERE email = ? OR username = ?').bind(email, username).first();
				if (existing) {
					if ((existing as any).email === email) return jsonResponse({ error: 'Email already exists' }, 409);
					return jsonResponse({ error: 'Username already taken' }, 409);
				}

				const passwordHash = await hashPassword(password);
				const verificationToken = generateToken();

				const { success, meta } = await env.cforum_db.prepare(
					'INSERT INTO users (email, username, password, role, verified, verification_token, points, title) VALUES (?, ?, ?, ?, 1, ?, 0, ?)'
				).bind(email, username, passwordHash, 'user', verificationToken, '🌱 初来乍到').run();

				if (!success) return jsonResponse({ error: 'Registration failed' }, 500);

				return jsonResponse({ message: '注册成功！请直接登录体验论坛。', userId: meta.last_row_id }, 201);
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/login (核心修复：写入会话表，生成永不过期的有效凭证)
		if (url.pathname === '/api/login' && method === 'POST') {
			try {
				const body = await request.json() as any;
				const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
				if (!(await checkTurnstile(body, ip))) return jsonResponse({ error: 'Turnstile verification failed' }, 403);

				const { email, password, totp_code } = body;
				if (!email || !password) return jsonResponse({ error: 'Missing email or password' }, 400);

				const user = await env.cforum_db.prepare(
					'SELECT id, username, email, password, verified, role, avatar_url, totp_secret, totp_enabled, points, title, last_checkin_date FROM users WHERE email = ?'
				).bind(email).first<DBUser>();

				if (!user) return jsonResponse({ error: 'Username or Password Error' }, 401);

				const passwordHash = await hashPassword(password);
				if (user.password !== passwordHash) return jsonResponse({ error: 'Username or Password Error' }, 401);
				if (user.verified !== 1) return jsonResponse({ error: '请先完成邮箱验证后登录' }, 403);

				if (user.totp_enabled === 1) {
					if (!totp_code) return jsonResponse({ error: 'TOTP_REQUIRED', message: '请输入双重验证码' }, 401);
					if (!user.totp_secret) return jsonResponse({ error: '2FA 配置异常' }, 500);
					const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
					const delta = totp.validate({ token: totp_code, window: 1 });
					if (delta === null) return jsonResponse({ error: '双重验证码错误' }, 401);
				}

				// 生成真实带 jti 的令牌
				const { token, jti, expiresAt } = await security.generateToken({
					id: user.id,
					role: user.role || 'user',
					email: user.email
				});

				// 真正写入 sessions 会话表！这是后台权限通过的核心！
				await env.cforum_db.prepare(
					'INSERT INTO sessions (jti, user_id, expires_at) VALUES (?, ?, ?)'
				).bind(jti, user.id, expiresAt).run();

				const today = new Date().toISOString().slice(0, 10);

				return jsonResponse({
					token,
					user: {
						id: user.id,
						username: user.username,
						email: user.email,
						role: user.role || 'user',
						avatar_url: user.avatar_url,
						points: user.points ?? 0,
						title: user.title || '🌱 初来乍到',
						checked_in_today: user.last_checkin_date === today
					}
				});
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/checkin
		if (url.pathname === '/api/checkin' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				const today = new Date().toISOString().slice(0, 10);

				const user = await env.cforum_db.prepare('SELECT points, last_checkin_date FROM users WHERE id = ?').bind(userPayload.id).first<DBUser>();
				if (user?.last_checkin_date === today) return jsonResponse({ error: '今日已经签过到了，明天再来吧！' }, 400);

				const reward = Math.floor(Math.random() * 9) + 2; 
				await env.cforum_db.prepare('UPDATE users SET points = COALESCE(points, 0) + ?, last_checkin_date = ? WHERE id = ?').bind(reward, today, userPayload.id).run();
				const newPoints = (user?.points ?? 0) + reward;

				return jsonResponse({ success: true, reward, points: newPoints });
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/categories
		if (url.pathname === '/api/categories' && method === 'GET') {
			try {
				const categories = await env.cforum_db.prepare('SELECT id, name, created_at FROM categories ORDER BY id ASC').all();
				return jsonResponse(categories.results);
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/posts
		if (url.pathname === '/api/posts' && method === 'GET') {
			try {
				const limit = parseInt(url.searchParams.get('limit') || '10');
				const offset = parseInt(url.searchParams.get('offset') || '0');
				const categoryId = url.searchParams.get('category_id');

				let query = `
					SELECT 
						p.id, p.title, p.content, p.category_id, p.is_pinned, p.view_count, p.created_at,
						u.username as author_name, u.avatar_url as author_avatar, u.role as author_role, u.title as author_title,
						c.name as category_name,
						(SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
						(SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
					FROM posts p
					LEFT JOIN users u ON p.author_id = u.id
					LEFT JOIN categories c ON p.category_id = c.id
				`;

				const params: any[] = [];
				if (categoryId) {
					query += ' WHERE p.category_id = ?';
					params.push(categoryId);
				}

				query += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?';
				params.push(limit, offset);

				const posts = await env.cforum_db.prepare(query).bind(...params).all();

				let countQuery = 'SELECT COUNT(*) as count FROM posts';
				const countParams: any[] = [];
				if (categoryId) {
					countQuery += ' WHERE category_id = ?';
					countParams.push(categoryId);
				}
				const total = await env.cforum_db.prepare(countQuery).bind(...countParams).first<number>('count');

				return jsonResponse({ items: posts.results, total: total || 0 });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts
		if (url.pathname === '/api/posts' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				const body = await request.json() as any;
				const { title, content, category_id } = body;
				if (!title || !content) return jsonResponse({ error: '标题与内容不能为空' }, 400);

				const res = await env.cforum_db.prepare(
					'INSERT INTO posts (title, content, author_id, category_id) VALUES (?, ?, ?, ?)'
				).bind(title, content, userPayload.id, category_id || 1).run();

				return jsonResponse({ success: true, id: res.meta.last_row_id });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/upload
		if (url.pathname === '/api/upload' && method === 'POST') {
			try {
				await authenticate(request);
				const formData = await request.formData();
				const file = formData.get('file') as File;
				if (!file) return jsonResponse({ error: '请选择要上传的图片' }, 400);

				const ext = file.name.split('.').pop() || 'png';
				const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

				await (env as any).BUCKET.put(key, await file.arrayBuffer(), {
					httpMetadata: { contentType: file.type }
				});

				const publicUrl = `https://cforum.day86530.workers.dev/r2/${key}`;
				return jsonResponse({ url: publicUrl });
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /r2/*
		if (url.pathname.startsWith('/r2/')) {
			const key = url.pathname.replace('/r2/', '');
			const object = await (env as any).BUCKET.get(key);
			if (!object) return new Response('Not Found', { status: 404 });

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			headers.set('Cache-Control', 'public, max-age=31536000');
			headers.set('Access-Control-Allow-Origin', '*');

			return new Response(object.body, { headers });
		}

		// --- ADMIN ROUTES ---
		if (url.pathname === '/api/admin/stats' && method === 'GET') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const [userCount, postCount, commentCount] = await Promise.all([
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM users').first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM posts').first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM comments').first<number>('count')
				]);

				return jsonResponse({
					users: userCount || 0,
					posts: postCount || 0,
					comments: commentCount || 0
				});
			} catch (e) {
				return handleError(e);
			}
		}

		if (url.pathname === '/api/admin/users' && method === 'GET') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const users = await env.cforum_db.prepare(
					'SELECT id, email, username, role, verified, created_at, avatar_url, points, title FROM users ORDER BY id DESC'
				).all();
				return jsonResponse(users.results);
			} catch (e) {
				return handleError(e);
			}
		}

		// 站长调分接口
		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/points$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const targetUserId = url.pathname.split('/')[4];
				const body = await request.json() as any;
				const amount = parseInt(body.amount);

				if (isNaN(amount)) return jsonResponse({ error: '请输入有效的整数数值' }, 400);

				await env.cforum_db.prepare(
					'UPDATE users SET points = MAX(0, COALESCE(points, 0) + ?) WHERE id = ?'
				).bind(amount, targetUserId).run();

				const updated = await env.cforum_db.prepare(
					'SELECT points FROM users WHERE id = ?'
				).bind(targetUserId).first<{ points: number }>();

				return jsonResponse({ success: true, points: updated?.points ?? 0 });
			} catch (e) {
				return handleError(e);
			}
		}

		if (url.pathname === '/api/admin/settings' && method === 'GET') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const settings = await env.cforum_db.prepare('SELECT key, value FROM settings').all();
				const result: Record<string, string> = {};
				settings.results.forEach((row: any) => { result[row.key] = row.value; });
				return jsonResponse(result);
			} catch (e) {
				return handleError(e);
			}
		}

		return new Response('Not Found', { 
			status: 404,
			headers: { 'Access-Control-Allow-Origin': '*' }
		});
	}
};
