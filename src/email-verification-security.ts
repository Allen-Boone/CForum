type SecurityEnv = {
	TURNSTILE_SECRET_KEY?: string;
};

type GuardInput = {
	request: Request;
	env: SecurityEnv;
	db: D1Database;
	ip: string;
	email: string;
	turnstileToken: string;
};

type GuardResult =
	| { ok: true }
	| { ok: false; status: number; error: string };

async function recordAttempt(
	db: D1Database,
	ip: string,
	email: string,
	success: number,
	reason: string
) {
	await db
		.prepare(`
			INSERT INTO email_send_attempts (
				ip,
				email,
				success,
				reason
			)
			VALUES (?, ?, ?, ?)
		`)
		.bind(
			ip || 'unknown',
			email,
			success,
			reason.slice(0, 200)
		)
		.run()
		.catch(() => {});
}

export async function guardVerificationEmail({
	request,
	env,
	db,
	ip,
	email,
	turnstileToken
}: GuardInput): Promise<GuardResult> {
	const secret = String(
		env.TURNSTILE_SECRET_KEY || ''
	).trim();

	if (!secret) {
		return {
			ok: false,
			status: 503,
			error: '人机验证服务尚未配置'
		};
	}

	if (!turnstileToken) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'missing_turnstile_token'
		);

		return {
			ok: false,
			status: 403,
			error: '请先完成人机验证'
		};
	}

	const formData = new FormData();
	formData.set('secret', secret);
	formData.set('response', turnstileToken);

	if (ip) {
		formData.set('remoteip', ip);
	}

	let verification: any;

	try {
		const verifyResponse = await fetch(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				method: 'POST',
				body: formData
			}
		);

		verification = await verifyResponse.json();
	} catch {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'turnstile_service_error'
		);

		return {
			ok: false,
			status: 502,
			error: '人机验证服务暂时不可用，请稍后重试'
		};
	}

	if (!verification?.success) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'turnstile_failed'
		);

		return {
			ok: false,
			status: 403,
			error: '人机验证未通过，请刷新后重试'
		};
	}

	const hostname = String(
		verification.hostname || ''
	).toLowerCase();

	if (
		hostname &&
		hostname !== 'blog.t20.de5.net' &&
		hostname !== 'localhost'
	) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			`invalid_hostname:${hostname}`
		);

		return {
			ok: false,
			status: 403,
			error: '人机验证来源无效'
		};
	}

	const ip10Minutes = await db
		.prepare(`
			SELECT COUNT(*) AS count
			FROM email_send_attempts
			WHERE ip = ?
			  AND created_at > datetime('now', '-10 minutes')
		`)
		.bind(ip || 'unknown')
		.first<{ count: number }>();

	if (Number(ip10Minutes?.count || 0) >= 3) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'ip_10m_limit'
		);

		return {
			ok: false,
			status: 429,
			error: '当前网络请求过于频繁，请 10 分钟后再试'
		};
	}

	const ip24Hours = await db
		.prepare(`
			SELECT COUNT(*) AS count
			FROM email_send_attempts
			WHERE ip = ?
			  AND created_at > datetime('now', '-1 day')
		`)
		.bind(ip || 'unknown')
		.first<{ count: number }>();

	if (Number(ip24Hours?.count || 0) >= 10) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'ip_24h_limit'
		);

		return {
			ok: false,
			status: 429,
			error: '当前网络今日获取验证码次数已达上限'
		};
	}

	const email60Seconds = await db
		.prepare(`
			SELECT COUNT(*) AS count
			FROM email_send_attempts
			WHERE email = ?
			  AND created_at > datetime('now', '-60 seconds')
		`)
		.bind(email)
		.first<{ count: number }>();

	if (Number(email60Seconds?.count || 0) >= 1) {
		return {
			ok: false,
			status: 429,
			error: '该邮箱发送过于频繁，请 60 秒后再试'
		};
	}

	const email24Hours = await db
		.prepare(`
			SELECT COUNT(*) AS count
			FROM email_send_attempts
			WHERE email = ?
			  AND created_at > datetime('now', '-1 day')
		`)
		.bind(email)
		.first<{ count: number }>();

	if (Number(email24Hours?.count || 0) >= 5) {
		await recordAttempt(
			db,
			ip,
			email,
			0,
			'email_24h_limit'
		);

		return {
			ok: false,
			status: 429,
			error: '该邮箱今日获取验证码次数已达上限'
		};
	}

	return { ok: true };
}

export async function recordVerificationEmailResult(
	db: D1Database,
	ip: string,
	email: string,
	success: boolean,
	reason: string
) {
	await recordAttempt(
		db,
		ip,
		email,
		success ? 1 : 0,
		reason
	);
}
