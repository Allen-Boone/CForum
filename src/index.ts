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
    last_checkin_date?: string;
    created_at?: string;
}

const MASTER_SECRET_KEY = new TextEncoder().encode('cforum_master_jwt_secret_key_2026_forever_valid');

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

async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password.trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

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

		const authenticate = async (req: Request) => {
			const authHeader = req.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				throw new Error('Unauthorized');
			}
			const token = authHeader.split(' ')[1];
			try {
				const { payload } = await jwtVerify(token, MASTER_SECRET_KEY);
				return {
					id: Number((payload as any).id),
					role: String((payload as any).role || 'user'),
					email: String((payload as any).email || '')
				};
			} catch (_) {
				throw new Error('Unauthorized');
			}
		};

		const handleError = (e: any) => {
			const errString = String(e);
			if (errString.includes('Unauthorized') || errString.includes('Invalid Token')) {
				return jsonResponse({ error: 'Unauthorized' }, 401);
			}
			return jsonResponse({ error: errString }, 500);
		};

		const ensureColumns = async () => {
			await env.cforum_db.prepare('ALTER TABLE posts ADD COLUMN badge TEXT').run().catch(() => {});
			await env.cforum_db.prepare('ALTER TABLE posts ADD COLUMN reward_points INTEGER DEFAULT 0').run().catch(() => {});
			await env.cforum_db.prepare("ALTER TABLE users ADD COLUMN badges TEXT DEFAULT '[]'").run().catch(() => {});
			await env.cforum_db.prepare("CREATE TABLE IF NOT EXISTS blackhouse (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, reason TEXT, duration TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)").run().catch(() => {});
		};

		const hasRestrictedKeywords = (username: string): boolean => {
			const restrictedKeywords = [
				'admin', 'administrator', 'root', 'system', 'sysadmin',
				'moderator', 'mod', 'support', 'help', 'service',
				'official', 'staff', 'team', 'master',
				'官方', '客服', '站长', '管理', '系统', '总管'
			];
			const lower = username.toLowerCase();
			return restrictedKeywords.some(k => lower.includes(k));
		};

		const ALLOWED_EMAIL_DOMAINS = [
			'qq.com', '163.com', '126.com', '139.com', '189.com', 'aliyun.com', 'sina.com', 'sina.cn', 'foxmail.com', 'yeah.net',
			'gmail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com'
		];

		const isValidEmailDomain = (email: string): boolean => {
			const parts = email.toLowerCase().split('@');
			if (parts.length !== 2) return false;
			const domain = parts[1].trim();
			return ALLOWED_EMAIL_DOMAINS.includes(domain);
		};

		// GET /api/config
		if (url.pathname === '/api/config' && method === 'GET') {
			try {
				const userCount = await env.cforum_db.prepare("SELECT COUNT(*) as count FROM users WHERE username != '已注销用户'").first('count');
				return jsonResponse({
					turnstile_enabled: false,
					turnstile_site_key: '',
					user_count: userCount ? (userCount as any).count : 0,
					jwt_secret_configured: true
				});
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/blackhouse
		if (url.pathname === '/api/blackhouse' && method === 'GET') {
			try {
				await ensureColumns();
				const list = await env.cforum_db.prepare("SELECT id, user_id, username, reason, duration, created_at FROM blackhouse ORDER BY id DESC LIMIT 50").all();
				return jsonResponse(list.results || []);
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/community-stats
		if (url.pathname === '/api/community-stats' && method === 'GET') {
			try {
				await ensureColumns();
				const [userCount, postCount, commentCount, latestUsers] = await Promise.all([
					env.cforum_db.prepare("SELECT COUNT(*) as count FROM users WHERE username != '已注销用户' AND role != 'banned'").first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM posts').first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM comments').first<number>('count'),
					env.cforum_db.prepare("SELECT id, username, avatar_url, role, title, badges FROM users WHERE username != '已注销用户' AND role != 'banned' ORDER BY id DESC LIMIT 16").all()
				]);

				return jsonResponse({
					topics: postCount || 0,
					replies: commentCount || 0,
					users: userCount || 0,
					latest_users: latestUsers.results || []
				});
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/me (返回信任等级统计数据)
		if (url.pathname === '/api/me' && method === 'GET') {
			try {
				await ensureColumns();
				const userPayload = await authenticate(request);
				const user = await env.cforum_db.prepare(
					'SELECT id, username, email, role, avatar_url, points, title, badges, last_checkin_date, created_at FROM users WHERE id = ?'
				).bind(userPayload.id).first<DBUser>();

				if (!user) return jsonResponse({ error: 'User not found' }, 404);
				const today = new Date().toISOString().slice(0, 10);

				// 统计该用户的发帖数、回帖数
				const [postCountRes, commentCountRes] = await Promise.all([
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_id = ?').bind(user.id).first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM comments WHERE author_id = ?').bind(user.id).first<number>('count')
				]);

				const postsCount = postCountRes || 0;
				const commentsCount = commentCountRes || 0;
				const userPoints = user.points ?? 0;

				// 信任等级计算算法 (TL0 ~ TL4)
				let trustLevel = 0; // TL0 新访客
				if (user.role === 'admin' || user.role === 'moderator') {
					trustLevel = 4; // TL4 领袖/管理员
				} else if (user.role === 'elder' || (postsCount >= 4 && commentsCount >= 8 && userPoints >= 50)) {
					trustLevel = 3; // TL3 社区骨干
				} else if (postsCount >= 2 && commentsCount >= 3) {
					trustLevel = 2; // TL2 正式成员
				} else if (commentsCount >= 1 || userPoints >= 5) {
					trustLevel = 1; // TL1 见习
				}

				return jsonResponse({
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role || 'user',
					avatar_url: user.avatar_url,
					points: userPoints,
					title: user.title || '🌱 初来乍到',
					badges: user.badges ? JSON.parse(user.badges) : [],
					checked_in_today: user.last_checkin_date === today,
					trust_level: trustLevel,
					stats: {
						posts_count: postsCount,
						comments_count: commentsCount,
						points: userPoints
					}
				});
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/user/avatar
		if (url.pathname === '/api/user/avatar' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				const body = await request.json() as any;

				if (body.avatar_url !== undefined) {
					await env.cforum_db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(body.avatar_url, userPayload.id).run();
				}
				if (body.title !== undefined) {
					const requestedTitle = String(body.title || '').trim();
					if (userPayload.role !== 'admin' && (requestedTitle.includes('站长') || requestedTitle.includes('管理员') || requestedTitle.includes('官方') || requestedTitle.toLowerCase().includes('admin'))) {
						return jsonResponse({ error: '权限不足：【站长】与【官方】专属称号仅限总管理员佩戴！' }, 403);
					}
					await env.cforum_db.prepare('UPDATE users SET title = ? WHERE id = ?').bind(requestedTitle, userPayload.id).run();
				}

				return jsonResponse({ success: true, avatar_url: body.avatar_url, title: body.title });
			} catch (e) {
				return handleError(e);
			}
		}

		// DELETE /api/user/self
		if (url.pathname === '/api/user/self' && method === 'DELETE') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role === 'admin' || userPayload.id === 1) {
					return jsonResponse({ error: '站长创始管理账号受系统保护，不可注销！' }, 400);
				}

				const uid = userPayload.id;
				await env.cforum_db.prepare('DELETE FROM likes WHERE user_id = ?').bind(uid).run().catch(() => {});
				await env.cforum_db.prepare('DELETE FROM checkins WHERE user_id = ?').bind(uid).run().catch(() => {});
				await env.cforum_db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid).run().catch(() => {});
				
				await env.cforum_db.prepare("UPDATE users SET username = '已注销用户', email = ? WHERE id = ?")
					.bind(`deleted_${uid}_${Date.now()}@free.com`, uid).run();

				return jsonResponse({ success: true, message: '账号已注销，感谢相伴！' });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/register
		if (url.pathname === '/api/register' && method === 'POST') {
			try {
				await ensureColumns();
				const body = await request.json() as any;
				const email = String(body.email || '').trim().toLowerCase();
				const username = String(body.username || '').trim();
				const password = String(body.password || '').trim();

				if (!email || !username || !password) return jsonResponse({ error: '请填写完整用户名、邮箱和密码' }, 400);
				if (username.length < 2 || username.length > 16) {
					return jsonResponse({ error: '用户名长度须在 2 到 16 个字符之间！' }, 400);
				}
				if (password.length < 6 || password.length > 64) {
					return jsonResponse({ error: '密码长度须在 6 到 64 位之间！' }, 400);
				}

				if (hasRestrictedKeywords(username)) {
					return jsonResponse({ error: '该用户名包含系统官方保留词（如客服、站长、管理等），禁止注册！' }, 400);
				}

				if (!isValidEmailDomain(email)) {
					return jsonResponse({
						error: '为杜绝机器人恶意批量注册，本站仅支持主流常用邮箱（如 QQ、163、126、Gmail、Outlook、iCloud、Proton 等）注册！'
					}, 400);
				}

				const existing = await env.cforum_db.prepare(
					'SELECT email, username FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)'
				).bind(email, username).first();

				if (existing) {
					return jsonResponse({ error: '该用户名或邮箱已被注册，请直接登录或换一个' }, 409);
				}

				const passwordHash = await hashPassword(password);

				const { success, meta } = await env.cforum_db.prepare(
					"INSERT INTO users (email, username, password, role, verified, points, title, badges) VALUES (?, ?, ?, 'user', 1, 0, ?, '[]')"
				).bind(email, username, passwordHash, '🌱 初来乍到').run();

				if (!success) return jsonResponse({ error: '注册失败' }, 500);

				const newUserId = Number(meta.last_row_id);
				const token = await new SignJWT({
					id: newUserId,
					role: 'user',
					email: email
				})
					.setProtectedHeader({ alg: 'HS256' })
					.setIssuedAt()
					.setExpirationTime('30d')
					.sign(MASTER_SECRET_KEY);

				return jsonResponse({
					message: '注册成功！',
					token,
					user: {
						id: newUserId,
						username,
						email,
						role: 'user',
						points: 0,
						title: '🌱 初来乍到',
						badges: [],
						checked_in_today: false,
						trust_level: 0
					}
				}, 201);
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/login
		if (url.pathname === '/api/login' && method === 'POST') {
			try {
				await ensureColumns();
				const body = await request.json() as any;
				const account = String(body.email || body.username || '').trim();
				const password = String(body.password || '').trim();

				if (!account || !password) return jsonResponse({ error: '请输入账号和密码' }, 400);

				const user = await env.cforum_db.prepare(
					'SELECT id, username, email, password, verified, role, avatar_url, points, title, badges, last_checkin_date FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)'
				).bind(account, account).first<DBUser>();

				if (!user || user.username === '已注销用户') return jsonResponse({ error: '账号不存在或已注销' }, 401);
				if (user.role === 'banned') {
					return jsonResponse({ error: '⚖️ 您的账号已被站长关入小黑屋反省，禁止登录与访问！' }, 403);
				}

				const passwordHash = await hashPassword(password);
				if (user.password !== passwordHash) return jsonResponse({ error: '密码不正确，请重新输入' }, 401);

				const token = await new SignJWT({
					id: user.id,
					role: user.role || 'user',
					email: user.email
				})
					.setProtectedHeader({ alg: 'HS256' })
					.setIssuedAt()
					.setExpirationTime('30d')
					.sign(MASTER_SECRET_KEY);

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
						badges: user.badges ? JSON.parse(user.badges) : [],
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
				if (userPayload.role === 'banned') return jsonResponse({ error: '您已被关入小黑屋，禁止签到！' }, 403);

				const today = new Date().toISOString().slice(0, 10);
				const user = await env.cforum_db.prepare('SELECT points, last_checkin_date FROM users WHERE id = ?').bind(userPayload.id).first<DBUser>();
				if (user?.last_checkin_date === today) {
					return jsonResponse({ error: '今日已经签过到了，明天再来领积分吧！', points: user?.points ?? 0 }, 400);
				}

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
				await ensureColumns();
				const limit = parseInt(url.searchParams.get('limit') || '50');
				const offset = parseInt(url.searchParams.get('offset') || '0');
				const categoryId = url.searchParams.get('category_id');

				let query = `
					SELECT 
						p.id, p.author_id, p.title, p.content, p.category_id, COALESCE(p.is_pinned, 0) as is_pinned,
						p.badge, COALESCE(p.reward_points, 0) as reward_points,
						COALESCE(p.views, 0) as view_count, p.created_at,
						u.username as author_name, u.avatar_url as author_avatar, u.role as author_role, u.title as author_title, u.badges as author_badges,
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

				query += ' ORDER BY COALESCE(p.is_pinned, 0) DESC, p.created_at DESC LIMIT ? OFFSET ?';
				params.push(limit, offset);

				const posts = await env.cforum_db.prepare(query).bind(...params).all();
				return jsonResponse({ items: posts.results, total: posts.results.length });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts
		if (url.pathname === '/api/posts' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role === 'banned') return jsonResponse({ error: '⚖️ 您的账号已被关入小黑屋，禁止发帖！' }, 403);

				const body = await request.json() as any;
				const { title, content, category_id } = body;
				const catId = Number(category_id) || 1;

				if (!title || !content) return jsonResponse({ error: '标题与内容不能为空' }, 400);

				if (catId === 9 && userPayload.role !== 'admin') {
					return jsonResponse({ error: '权限不足：【公告】板块为官方权威专区，仅限站长发布！' }, 403);
				}

				const res = await env.cforum_db.prepare(
					'INSERT INTO posts (title, content, author_id, category_id) VALUES (?, ?, ?, ?)'
				).bind(title, content, userPayload.id, catId).run();

				return jsonResponse({ success: true, id: res.meta.last_row_id });
			} catch (e) {
				return handleError(e);
			}
		}

		// PUT /api/posts/:id
		if (url.pathname.match(/^\/api\/posts\/\d+$/) && method === 'PUT') {
			try {
				const userPayload = await authenticate(request);
				const postId = url.pathname.split('/')[3];
				const body = await request.json() as any;
				const title = String(body.title || '').trim();
				const content = String(body.content || '').trim();
				const categoryId = Number(body.category_id);

				if (!title || !content) return jsonResponse({ error: '标题与内容不能为空' }, 400);

				const post = await env.cforum_db.prepare('SELECT author_id, category_id FROM posts WHERE id = ?').bind(postId).first<{ author_id: number; category_id: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);
				if (userPayload.role !== 'admin' && post.author_id !== userPayload.id) {
					return jsonResponse({ error: '无权修改他人帖子' }, 403);
				}

				if ((categoryId === 9 || post.category_id === 9) && userPayload.role !== 'admin') {
					return jsonResponse({ error: '权限不足：【公告】板块仅限站长操作！' }, 403);
				}

				await env.cforum_db.prepare(
					'UPDATE posts SET title = ?, content = ?, category_id = COALESCE(?, category_id) WHERE id = ?'
				).bind(title, content, categoryId || null, postId).run();

				return jsonResponse({ success: true });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts/:id/badge
		if (url.pathname.match(/^\/api\/posts\/\d+\/badge$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				await ensureColumns();
				const postId = url.pathname.split('/')[3];
				const body = await request.json() as any;
				const badge = body.badge || null;

				await env.cforum_db.prepare('UPDATE posts SET badge = ? WHERE id = ?').bind(badge, postId).run();
				return jsonResponse({ success: true, badge });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts/:id/reward
		if (url.pathname.match(/^\/api\/posts\/\d+\/reward$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				await ensureColumns();
				const postId = url.pathname.split('/')[3];
				const body = await request.json() as any;
				const amount = parseInt(body.amount);

				if (isNaN(amount) || amount <= 0) return jsonResponse({ error: '请输入大于0的奖励积分' }, 400);

				const post = await env.cforum_db.prepare('SELECT author_id, reward_points FROM posts WHERE id = ?').bind(postId).first<{ author_id: number; reward_points: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);

				await env.cforum_db.prepare('UPDATE posts SET reward_points = COALESCE(reward_points, 0) + ? WHERE id = ?').bind(amount, postId).run();
				await env.cforum_db.prepare('UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?').bind(amount, post.author_id).run();

				const updated = await env.cforum_db.prepare('SELECT reward_points FROM posts WHERE id = ?').bind(postId).first<{ reward_points: number }>();
				return jsonResponse({ success: true, total_reward: updated?.reward_points ?? 0 });
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/posts/:id
		if (url.pathname.match(/^\/api\/posts\/\d+$/) && method === 'GET') {
			try {
				await ensureColumns();
				const postId = url.pathname.split('/')[3];
				await env.cforum_db.prepare('UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = ?').bind(postId).run();

				const post = await env.cforum_db.prepare(`
					SELECT 
						p.id, p.author_id, p.title, p.content, p.category_id, COALESCE(p.is_pinned, 0) as is_pinned,
						p.badge, COALESCE(p.reward_points, 0) as reward_points,
						COALESCE(p.views, 0) as view_count, p.created_at,
						u.username as author_name, u.avatar_url as author_avatar, u.role as author_role, u.title as author_title, u.badges as author_badges,
						c.name as category_name,
						(SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
						(SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
					FROM posts p
					LEFT JOIN users u ON p.author_id = u.id
					LEFT JOIN categories c ON p.category_id = c.id
					WHERE p.id = ?
				`).bind(postId).first();

				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);
				return jsonResponse(post);
			} catch (e) {
				return handleError(e);
			}
		}

		// GET /api/posts/:id/comments
		if (url.pathname.match(/^\/api\/posts\/\d+\/comments$/) && method === 'GET') {
			try {
				const postId = url.pathname.split('/')[3];
				const comments = await env.cforum_db.prepare(`
					SELECT 
						c.id, c.post_id, c.parent_id, c.author_id, c.content, c.created_at,
						u.username, u.avatar_url, u.role, u.title, u.badges
					FROM comments c
					LEFT JOIN users u ON c.author_id = u.id
					WHERE c.post_id = ?
					ORDER BY c.created_at ASC
				`).bind(postId).all();

				return jsonResponse(comments.results);
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts/:id/comments
		if (url.pathname === '/api/posts/:id/comments' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role === 'banned') return jsonResponse({ error: '⚖️ 您的账号已被关入小黑屋，禁止发表评论！' }, 403);

				const postId = url.pathname.split('/')[3];
				const body = await request.json() as any;
				const content = String(body.content || '').trim();
				const parentId = body.parent_id || null;

				if (!content) return jsonResponse({ error: '评论内容不能为空' }, 400);

				const res = await env.cforum_db.prepare(
					'INSERT INTO comments (post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?)'
				).bind(postId, userPayload.id, parentId, content).run();

				return jsonResponse({ success: true, id: res.meta.last_row_id });
			} catch (e) {
				return handleError(e);
			}
		}

		// DELETE /api/comments/:id
		if (url.pathname.match(/^\/api\/comments\/\d+$/) && method === 'DELETE') {
			try {
				const userPayload = await authenticate(request);
				const commentId = url.pathname.split('/')[3];

				const comment = await env.cforum_db.prepare('SELECT author_id FROM comments WHERE id = ?').bind(commentId).first<{ author_id: number }>();
				if (!comment) return jsonResponse({ error: '评论不存在' }, 404);
				if (userPayload.role !== 'admin' && comment.author_id !== userPayload.id) {
					return jsonResponse({ error: '无权删除他人评论' }, 403);
				}

				await env.cforum_db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
				return jsonResponse({ success: true });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts/:id/like
		if (url.pathname.match(/^\/api\/posts\/\d+\/like$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				const postId = url.pathname.split('/')[3];

				const existing = await env.cforum_db.prepare(
					'SELECT id FROM likes WHERE post_id = ? AND user_id = ?'
				).bind(postId, userPayload.id).first();

				if (existing) {
					await env.cforum_db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(postId, userPayload.id).run();
					return jsonResponse({ liked: false });
				} else {
					await env.cforum_db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').bind(postId, userPayload.id).run();
					return jsonResponse({ liked: true });
				}
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/posts/:id/pin
		if ((url.pathname.match(/^\/api\/posts\/\d+\/pin$/) || url.pathname.match(/^\/api\/admin\/posts\/\d+\/pin$/)) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);
				const parts = url.pathname.split('/');
				const postId = parts[parts.length - 2] || parts[parts.length - 1];

				const body = await request.json().catch(() => ({})) as any;
				let targetWeight: number;

				if (body && body.weight !== undefined) {
					targetWeight = parseInt(body.weight) || 0;
				} else {
					const post = await env.cforum_db.prepare('SELECT is_pinned FROM posts WHERE id = ?').bind(postId).first<{ is_pinned: number }>();
					targetWeight = (post?.is_pinned && post.is_pinned > 0) ? 0 : 1;
				}

				await env.cforum_db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').bind(targetWeight, postId).run();
				return jsonResponse({ success: true, weight: targetWeight });
			} catch (e) {
				return handleError(e);
			}
		}

		// POST /api/admin/posts/:id/move
		if (url.pathname.match(/^\/api\/admin\/posts\/\d+\/move$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);
				const postId = url.pathname.split('/')[4];
				const body = await request.json() as any;

				await env.cforum_db.prepare('UPDATE posts SET category_id = ? WHERE id = ?').bind(body.category_id || 1, postId).run();
				return jsonResponse({ success: true });
			} catch (e) {
				return handleError(e);
			}
		}

		// DELETE /api/posts/:id
		if ((url.pathname.match(/^\/api\/posts\/\d+$/) || url.pathname.match(/^\/api\/admin\/posts\/\d+$/)) && method === 'DELETE') {
			try {
				const userPayload = await authenticate(request);
				const parts = url.pathname.split('/');
				const postId = parts[parts.length - 1];

				const post = await env.cforum_db.prepare('SELECT author_id FROM posts WHERE id = ?').bind(postId).first<{ author_id: number }>();
				if (!post) return jsonResponse({ error: '帖子不存在' }, 404);
				if (userPayload.role !== 'admin' && post.author_id !== userPayload.id) {
					return jsonResponse({ error: '无权删除他人帖子' }, 403);
				}

				await env.cforum_db.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
				await env.cforum_db.prepare('DELETE FROM likes WHERE post_id = ?').bind(postId).run();
				await env.cforum_db.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

				return jsonResponse({ success: true });
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
				if (!file) return jsonResponse({ error: '请选择图片' }, 400);

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
					env.cforum_db.prepare("SELECT COUNT(*) as count FROM users WHERE username != '已注销用户' AND role != 'banned'").first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM posts').first<number>('count'),
					env.cforum_db.prepare('SELECT COUNT(*) as count FROM comments').first<number>('count')
				]);

				return jsonResponse({ users: userCount || 0, posts: postCount || 0, comments: commentCount || 0 });
			} catch (e) {
				return handleError(e);
			}
		}

		if (url.pathname === '/api/admin/users' && method === 'GET') {
			try {
				await ensureColumns();
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const users = await env.cforum_db.prepare(
					'SELECT id, email, username, role, verified, created_at, avatar_url, points, title, badges FROM users ORDER BY id DESC'
				).all();
				return jsonResponse(users.results);
			} catch (e) {
				return handleError(e);
			}
		}

		// 站长神权：一键打入小黑屋并公开示众
		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/banish$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				await ensureColumns();
				const targetUserId = Number(url.pathname.split('/')[4]);
				if (targetUserId === 1) return jsonResponse({ error: '总站长主账号受系统保护，不可关押！' }, 400);

				const body = await request.json() as any;
				const reason = String(body.reason || '严重违反社区规则').trim();
				const duration = String(body.duration || '永久封禁').trim();

				const user = await env.cforum_db.prepare('SELECT username FROM users WHERE id = ?').bind(targetUserId).first<{ username: string }>();
				if (!user) return jsonResponse({ error: '用户不存在' }, 404);

				await env.cforum_db.prepare("UPDATE users SET role = 'banned' WHERE id = ?").bind(targetUserId).run();
				await env.cforum_db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetUserId).run().catch(() => {});
				await env.cforum_db.prepare("INSERT INTO blackhouse (user_id, username, reason, duration) VALUES (?, ?, ?, ?)").bind(targetUserId, user.username, reason, duration).run();

				return jsonResponse({ success: true, username: user.username });
			} catch (e) {
				return handleError(e);
			}
		}

		// 站长设置角色等级
		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/role$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const targetUserId = Number(url.pathname.split('/')[4]);
				if (targetUserId === 1) return jsonResponse({ error: '总站长主账号受系统保护，不可更改角色！' }, 400);

				const body = await request.json() as any;
				const newRole = String(body.role || 'user').trim();

				await env.cforum_db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, targetUserId).run();
				return jsonResponse({ success: true, role: newRole });
			} catch (e) {
				return handleError(e);
			}
		}

		// 站长强制改名
		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/rename$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const targetUserId = url.pathname.split('/')[4];
				const body = await request.json() as any;
				const newName = String(body.username || '').trim();

				if (!newName) return jsonResponse({ error: '用户名不能为空' }, 400);

				const exists = await env.cforum_db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(newName, targetUserId).first();
				if (exists) return jsonResponse({ error: '该用户名已被占用，请换一个' }, 409);

				await env.cforum_db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(newName, targetUserId).run();
				return jsonResponse({ success: true, username: newName });
			} catch (e) {
				return handleError(e);
			}
		}

		// 单人授勋
		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/badges$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				await ensureColumns();
				const targetUserId = url.pathname.split('/')[4];
				const body = await request.json() as any;
				const badgesArray = Array.isArray(body.badges) ? body.badges : [];

				await env.cforum_db.prepare(
					'UPDATE users SET badges = ? WHERE id = ?'
				).bind(JSON.stringify(badgesArray), targetUserId).run();

				return jsonResponse({ success: true, badges: badgesArray });
			} catch (e) {
				return handleError(e);
			}
		}

		// 全员一键大授勋
		if (url.pathname === '/api/admin/users/batch-badges' && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				await ensureColumns();
				const body = await request.json() as any;
				const badge = String(body.badge || '').trim();
				const targetScope = body.scope || 'all';

				if (!badge) return jsonResponse({ error: '请选择或输入要授予的勋章' }, 400);

				let query = "SELECT id, badges FROM users WHERE username != '已注销用户' AND role != 'banned'";
				if (targetScope === 'top100') {
					query += " ORDER BY id ASC LIMIT 100";
				}
				const usersList = await env.cforum_db.prepare(query).all();

				let affected = 0;
				for (const u of (usersList.results as any[])) {
					let list: string[] = [];
					try { list = u.badges ? JSON.parse(u.badges) : []; } catch (_) {}
					if (!list.includes(badge)) {
						list.push(badge);
						await env.cforum_db.prepare('UPDATE users SET badges = ? WHERE id = ?').bind(JSON.stringify(list), u.id).run();
						affected++;
					}
				}

				return jsonResponse({ success: true, affected, badge });
			} catch (e) {
				return handleError(e);
			}
		}

		if (url.pathname.match(/^\/api\/admin\/users\/\d+\/points$/) && method === 'POST') {
			try {
				const userPayload = await authenticate(request);
				if (userPayload.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 403);

				const targetUserId = url.pathname.split('/')[4];
				const body = await request.json() as any;
				const amount = parseInt(body.amount);
				if (isNaN(amount)) return jsonResponse({ error: '请输入有效的整数' }, 400);

				await env.cforum_db.prepare(
					'UPDATE users SET points = MAX(0, COALESCE(points, 0) + ?) WHERE id = ?'
				).bind(amount, targetUserId).run();

				const updated = await env.cforum_db.prepare('SELECT points FROM users WHERE id = ?').bind(targetUserId).first<{ points: number }>();
				return jsonResponse({ success: true, points: updated?.points ?? 0 });
			} catch (e) {
				return handleError(e);
			}
		}

		return jsonResponse({ error: '接口不存在: ' + url.pathname }, 404);
	}
};
