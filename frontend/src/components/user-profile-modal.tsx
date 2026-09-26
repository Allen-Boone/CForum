import * as React from 'react';
import { apiFetch, formatDate } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
	CalendarDays,
	FileText,
	MessageCircle,
	MessagesSquare,
	Sparkles,
	X
} from 'lucide-react';

type PublicProfile = {
	id: number;
	username: string;
	avatar_url?: string | null;
	role?: string;
	title?: string | null;
	badges?: string[];
	points: number;
	created_at?: string;
	stats: {
		posts_count: number;
		comments_count: number;
	};
};

export function UserProfileModal({
	userId,
	onClose
}: {
	userId: number | null;
	onClose: () => void;
}) {
	const token = getToken();
	const currentUser = getUser();

	const [profile, setProfile] =
		React.useState<PublicProfile | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState('');

	React.useEffect(() => {
		if (!userId) {
			setProfile(null);
			setError('');
			return;
		}

		if (!token) {
			setError('请先登录后查看用户资料');
			return;
		}

		let cancelled = false;

		async function loadProfile() {
			setLoading(true);
			setError('');
			setProfile(null);

			try {
				const result = await apiFetch<PublicProfile>(
					`/users/${userId}/profile`
				);

				if (!cancelled) {
					setProfile(result);
				}
			} catch (err: any) {
				if (!cancelled) {
					setError(err.message || '读取用户资料失败');
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadProfile();

		return () => {
			cancelled = true;
		};
	}, [userId, token]);

	React.useEffect(() => {
		if (!userId) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener(
				'keydown',
				handleKeyDown
			);
		};
	}, [userId, onClose]);

	if (!userId) return null;

	const isSelf = currentUser?.id === userId;

	function startPrivateChat() {
		if (!token) {
			window.location.href = '/login';
			return;
		}

		if (isSelf) return;

		window.location.href =
			`/messages?userId=${userId}`;
	}

	return (
		<div
			className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
			onMouseDown={event => {
				if (event.currentTarget === event.target) {
					onClose();
				}
			}}
		>
			<div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden text-white">
				<div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
					<h2 className="font-bold text-base">
						用户公开资料
					</h2>

					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d]"
						title="关闭"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{loading ? (
					<div className="py-16 text-center text-sm text-gray-500">
						正在读取用户资料...
					</div>
				) : error ? (
					<div className="p-6">
						<div className="p-3 rounded-lg border border-red-800 bg-red-950/50 text-red-200 text-xs">
							{error}
						</div>
					</div>
				) : profile ? (
					<div className="p-5 space-y-5">
						<div className="flex items-center gap-4">
							<div className="w-16 h-16 rounded-full overflow-hidden border border-[#30363d] bg-blue-600/20 text-blue-300 flex items-center justify-center text-xl font-bold flex-shrink-0">
								{profile.avatar_url ? (
									<img
										src={profile.avatar_url}
										alt={profile.username}
										className="w-full h-full object-cover"
									/>
								) : (
									<span>
										{profile.username
											.slice(0, 1)
											.toUpperCase()}
									</span>
								)}
							</div>

							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 flex-wrap">
									<h3 className="text-lg font-black text-white truncate">
										{profile.username}
									</h3>

									{profile.role === 'admin' && (
										<span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold">
											👑 站长
										</span>
									)}
								</div>

								<p className="text-xs text-blue-300 mt-1">
									{profile.role === 'admin'
										? '👑 站长'
										: profile.title ||
											'🌱 初来乍到'}
								</p>

								{profile.created_at && (
									<p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
										<CalendarDays className="w-3 h-3" />
										加入于{' '}
										{formatDate(
											profile.created_at
										)}
									</p>
								)}
							</div>
						</div>

						{Array.isArray(profile.badges) &&
							profile.badges.length > 0 && (
								<div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-[#21262d] bg-[#0d1117]">
									{profile.badges.map(
										(badge, index) => (
											<span
												key={`${badge}-${index}`}
												className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-bold"
											>
												{badge}
											</span>
										)
									)}
								</div>
							)}

						<div className="grid grid-cols-3 gap-2">
							<div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-center">
								<FileText className="w-4 h-4 mx-auto text-sky-400" />
								<div className="text-lg font-black text-white mt-1">
									{profile.stats.posts_count}
								</div>
								<div className="text-[10px] text-gray-500">
									主题帖
								</div>
							</div>

							<div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-center">
								<MessagesSquare className="w-4 h-4 mx-auto text-emerald-400" />
								<div className="text-lg font-black text-white mt-1">
									{profile.stats.comments_count}
								</div>
								<div className="text-[10px] text-gray-500">
									回复
								</div>
							</div>

							<div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-center">
								<Sparkles className="w-4 h-4 mx-auto text-amber-400" />
								<div className="text-lg font-black text-white mt-1">
									{profile.points}
								</div>
								<div className="text-[10px] text-gray-500">
									积分
								</div>
							</div>
						</div>

						<div className="pt-1 flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								className="flex-1 border-[#30363d] text-gray-300 text-xs"
							>
								关闭
							</Button>

							<Button
								type="button"
								onClick={startPrivateChat}
								disabled={isSelf}
								className={`flex-1 text-xs ${
									isSelf
										? 'bg-gray-700 text-gray-400'
										: 'bg-blue-600 hover:bg-blue-700 text-white'
								}`}
							>
								<MessageCircle className="w-3.5 h-3.5 mr-1.5" />
								{isSelf
									? '这是我自己'
									: '发起私聊'}
							</Button>
						</div>

						<p className="text-[10px] text-gray-600 text-center">
							公开资料不会显示邮箱、注册 IP 或登录 IP
						</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
