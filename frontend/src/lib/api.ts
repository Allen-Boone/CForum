import { getToken, logout } from '@/lib/auth';

export type ForumConfig = {
	turnstile_enabled: boolean;
	turnstile_site_key: string;
	user_count?: number;
	jwt_secret_configured?: boolean;
};

export type Category = {
	id: number;
	name: string;
	created_at: string;
};

export type Post = {
	id: number;
	author_id: number;
	title: string;
	content: string;
	category_id: number | null;
	category_name?: string | null;
	is_pinned?: number;
	is_public?: number;
	allow_index?: number;
	view_count?: number;
	created_at: string;
	author_name?: string;
	author_avatar?: string | null;
	author_role?: 'admin' | 'user';
	author_title?: string | null;
	like_count?: number;
	comment_count?: number;
	liked?: boolean;
};

export type Comment = {
	id: number;
	post_id: number;
	parent_id: number | null;
	author_id: number;
	username: string;
	avatar_url?: string | null;
	role?: 'admin' | 'user';
	content: string;
	created_at: string;
};

const API_BASE = 'https://cforum.day86530.workers.dev/api';

function generateSafeNonce(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSecurityHeaders(method: string, contentType: string | null = 'application/json') {
	const headers: Record<string, string> = {};
	const token = getToken();
	if (token) headers.Authorization = `Bearer ${token}`;
	if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
		headers['X-Timestamp'] = Math.floor(Date.now() / 1000).toString();
		headers['X-Nonce'] = generateSafeNonce();
	}
	if (contentType) headers['Content-Type'] = contentType;
	return headers;
}

// 核心升级：全站任何请求自动携带登录 Token，绝不再漏传导致过期！
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const method = init?.method || 'GET';
	const autoHeaders = getSecurityHeaders(method);
	const mergedHeaders = {
		...autoHeaders,
		...(init?.headers as Record<string, string> || {})
	};

	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: mergedHeaders
	});

	if (res.status === 401) {
		logout();
		throw new Error('登录已过期，请重新登录');
	}
	const text = await res.text();
	const data = text ? (JSON.parse(text) as any) : null;
	if (!res.ok) {
		throw new Error(data?.error || `请求失败 (${res.status})`);
	}
	return data as T;
}

export function formatDate(dateString: string | null | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString.endsWith('Z') ? dateString : `${dateString}Z`);
	return date.toLocaleString('zh-CN', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
