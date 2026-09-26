type AuthUser = {
	id: number;
	role: string;
	email: string;
};

type Authenticate = (request: Request) => Promise<AuthUser>;

type EnvWithDb = {
	cforum_db: D1Database;
};

function response(data: any, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*'
		}
	});
}

function safeBadges(value: unknown): string[] {
	if (!value) return [];

	try {
		const parsed = JSON.parse(String(value));
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

export async function handleDirectMessageRoute(
	request: Request,
	env: EnvWithDb,
	authenticate: Authenticate
): Promise<Response | null> {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();
	const db = env.cforum_db;

	/*
	 * 公开用户资料
	 * 不返回邮箱、密码、注册 IP、最后活跃 IP
	 */
	const profileMatch = url.pathname.match(
		/^\/api\/users\/(\d+)\/profile$/
	);

	if (profileMatch && method === 'GET') {
		try {
			await authenticate(request);

			const userId = Number(profileMatch[1]);

			const user = await db
				.prepare(`
					SELECT
						id,
						username,
						avatar_url,
						role,
						title,
						badges,
						points,
						created_at
					FROM users
					WHERE id = ?
					  AND username != '已注销用户'
					  AND role != 'deleted'
				`)
				.bind(userId)
				.first<any>();

			if (!user) {
				return response({ error: '用户不存在' }, 404);
			}

			const [posts, comments] = await Promise.all([
				db
					.prepare(
						'SELECT COUNT(*) AS count FROM posts WHERE author_id = ?'
					)
					.bind(userId)
					.first<{ count: number }>(),
				db
					.prepare(
						'SELECT COUNT(*) AS count FROM comments WHERE author_id = ?'
					)
					.bind(userId)
					.first<{ count: number }>()
			]);

			return response({
				id: user.id,
				username: user.username,
				avatar_url: user.avatar_url,
				role: user.role || 'user',
				title: user.title || '🌱 初来乍到',
				badges: safeBadges(user.badges),
				points: Number(user.points || 0),
				created_at: user.created_at,
				stats: {
					posts_count: Number(posts?.count || 0),
					comments_count: Number(comments?.count || 0)
				}
			});
		} catch {
			return response(
				{ error: '登录状态无效，请重新登录' },
				401
			);
		}
	}

	/*
	 * 会话列表
	 */
	if (
		url.pathname === '/api/messages/conversations' &&
		method === 'GET'
	) {
		try {
			const me = await authenticate(request);

			const messages = await db
				.prepare(`
					SELECT
						id,
						sender_id,
						recipient_id,
						content,
						is_read,
						created_at
					FROM direct_messages
					WHERE sender_id = ? OR recipient_id = ?
					ORDER BY id DESC
					LIMIT 500
				`)
				.bind(me.id, me.id)
				.all<any>();

			const latest = new Map<number, any>();
			const unread = new Map<number, number>();

			for (const message of messages.results || []) {
				const partnerId =
					message.sender_id === me.id
						? message.recipient_id
						: message.sender_id;

				if (!latest.has(partnerId)) {
					latest.set(partnerId, message);
				}

				if (
					message.recipient_id === me.id &&
					Number(message.is_read) === 0
				) {
					unread.set(
						partnerId,
						(unread.get(partnerId) || 0) + 1
					);
				}
			}

			const partnerIds = Array.from(latest.keys());

			if (partnerIds.length === 0) {
				return response([]);
			}

			const placeholders = partnerIds
				.map(() => '?')
				.join(',');

			const users = await db
				.prepare(`
					SELECT id, username, avatar_url, role, title
					FROM users
					WHERE id IN (${placeholders})
					  AND username != '已注销用户'
					  AND role != 'deleted'
				`)
				.bind(...partnerIds)
				.all<any>();

			const userMap = new Map(
				(users.results || []).map((user: any) => [
					user.id,
					user
				])
			);

			return response(
				partnerIds
					.map(id => ({
						user: userMap.get(id),
						last_message:
							latest.get(id)?.content || '',
						last_message_at:
							latest.get(id)?.created_at || '',
						unread: unread.get(id) || 0
					}))
					.filter(item => item.user)
			);
		} catch {
			return response(
				{ error: '登录状态无效，请重新登录' },
				401
			);
		}
	}

	/*
	 * 私信历史
	 */
	const historyMatch = url.pathname.match(
		/^\/api\/messages\/(\d+)$/
	);

	if (historyMatch && method === 'GET') {
		try {
			const me = await authenticate(request);
			const otherId = Number(historyMatch[1]);

			const otherUser = await db
				.prepare(`
					SELECT id, username, avatar_url, role, title
					FROM users
					WHERE id = ?
					  AND username != '已注销用户'
					  AND role != 'deleted'
				`)
				.bind(otherId)
				.first<any>();

			if (!otherUser) {
				return response({ error: '用户不存在' }, 404);
			}

			const messages = await db
				.prepare(`
					SELECT
						id,
						sender_id,
						recipient_id,
						content,
						is_read,
						created_at
					FROM direct_messages
					WHERE
						(sender_id = ? AND recipient_id = ?)
						OR
						(sender_id = ? AND recipient_id = ?)
					ORDER BY id ASC
					LIMIT 200
				`)
				.bind(me.id, otherId, otherId, me.id)
				.all<any>();

			await db
				.prepare(`
					UPDATE direct_messages
					SET is_read = 1
					WHERE sender_id = ?
					  AND recipient_id = ?
				`)
				.bind(otherId, me.id)
				.run();

			return response({
				user: otherUser,
				messages: messages.results || []
			});
		} catch {
			return response(
				{ error: '登录状态无效，请重新登录' },
				401
			);
		}
	}

	/*
	 * 发送私信
	 */
	if (historyMatch && method === 'POST') {
		try {
			const me = await authenticate(request);

			if (me.role === 'banned') {
				return response(
					{ error: '封禁账号不能发送私信' },
					403
				);
			}

			const recipientId = Number(historyMatch[1]);

			if (!Number.isInteger(recipientId)) {
				return response(
					{ error: '收件用户编号无效' },
					400
				);
			}

			if (recipientId === me.id) {
				return response(
					{ error: '不能给自己发送私信' },
					400
				);
			}

			const recipient = await db
				.prepare(`
					SELECT id
					FROM users
					WHERE id = ?
					  AND username != '已注销用户'
					  AND role != 'deleted'
				`)
				.bind(recipientId)
				.first();

			if (!recipient) {
				return response(
					{ error: '收件用户不存在' },
					404
				);
			}

			const body = (await request.json()) as any;
			const content = String(body.content || '').trim();

			if (!content) {
				return response(
					{ error: '私信内容不能为空' },
					400
				);
			}

			if (content.length > 1000) {
				return response(
					{ error: '单条私信不能超过 1000 个字符' },
					400
				);
			}

			const recent = await db
				.prepare(`
					SELECT created_at
					FROM direct_messages
					WHERE sender_id = ?
					ORDER BY id DESC
					LIMIT 1
				`)
				.bind(me.id)
				.first<{ created_at: string }>();

			if (recent?.created_at) {
				const previousTime = new Date(
					recent.created_at.endsWith('Z')
						? recent.created_at
						: `${recent.created_at}Z`
				).getTime();

				if (Date.now() - previousTime < 1500) {
					return response(
						{ error: '发送过于频繁，请稍后再试' },
						429
					);
				}
			}

			const result = await db
				.prepare(`
					INSERT INTO direct_messages
						(sender_id, recipient_id, content)
					VALUES (?, ?, ?)
				`)
				.bind(me.id, recipientId, content)
				.run();

			return response({
				success: true,
				id: result.meta.last_row_id
			});
		} catch {
			return response(
				{ error: '登录状态无效，请重新登录' },
				401
			);
		}
	}

	/*
	 * 标记已读
	 */
	const readMatch = url.pathname.match(
		/^\/api\/messages\/(\d+)\/read$/
	);

	if (readMatch && method === 'POST') {
		try {
			const me = await authenticate(request);
			const otherId = Number(readMatch[1]);

			await db
				.prepare(`
					UPDATE direct_messages
					SET is_read = 1
					WHERE sender_id = ?
					  AND recipient_id = ?
				`)
				.bind(otherId, me.id)
				.run();

			return response({ success: true });
		} catch {
			return response(
				{ error: '登录状态无效，请重新登录' },
				401
			);
		}
	}

	return null;
}
