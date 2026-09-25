import * as React from 'react';
import { MessageSquare, Plus, Coffee, CalendarCheck, Paperclip, Sparkles, Trophy, Lock, Pin, Trash2, Award, Clock, Send, Camera, Gift, Flame, Zap, FolderInput, Gavel, X } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, formatDate, getSecurityHeaders, type Category, type Post } from '@/lib/api';
import { getToken, getUser, logout, setUser } from '@/lib/auth';

const ALL_CATEGORIES: Category[] = [
	{ id: 1, name: '茶水间', created_at: '' },
	{ id: 2, name: '技术贴', created_at: '' },
	{ id: 3, name: '问与答', created_at: '' },
	{ id: 4, name: 'AI聊聊', created_at: '' },
	{ id: 5, name: '副业来了', created_at: '' },
	{ id: 6, name: '域名交流', created_at: '' },
	{ id: 7, name: '福利发放', created_at: '' },
	{ id: 8, name: '站长交流', created_at: '' },
	{ id: 9, name: '公告', created_at: '' }
];

const SMILEY_THEMES = [
	{ bg: '#4ade80', face: '🤩' },
	{ bg: '#c084fc', face: '😂' },
	{ bg: '#fde047', face: '😄' },
	{ bg: '#e879f9', face: '🥹' },
	{ bg: '#fbbf24', face: '🤨' },
	{ bg: '#facc15', face: '😑' },
	{ bg: '#22c55e', face: '🥲' },
	{ bg: '#38bdf8', face: '😮' },
	{ bg: '#fb923c', face: '😎' },
	{ bg: '#2dd4bf', face: '😁' }
];

function CuteCircleAvatar({ name, avatarUrl, index }: { name: string; avatarUrl?: string | null; index: number }) {
	const theme = SMILEY_THEMES[index % SMILEY_THEMES.length];
	return (
		<div className="flex flex-col items-center group cursor-pointer">
			<div className="relative w-11 h-11">
				{avatarUrl ? (
					<img src={avatarUrl} alt={name} className="w-11 h-11 rounded-full object-cover border border-[#30363d]" />
				) : (
					<div style={{ backgroundColor: theme.bg }} className="w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-inner select-none">
						{theme.face}
					</div>
				)}
				<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#3fb950] border-2 border-[#161b22]" />
			</div>
			<span className="mt-1.5 text-[11px] text-gray-300 group-hover:text-white truncate w-14 text-center">{name}</span>
		</div>
	);
}

function TimeGreetingBanner() {
	const [timeText, setTimeText] = React.useState('');
	const [isNight, setIsNight] = React.useState(false);
	const [hour, setHour] = React.useState(19);

	React.useEffect(() => {
		function update() {
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			const hours = now.getHours();
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
			const weekDay = weekDays[now.getDay()];

			setHour(hours);
			setTimeText(`${year}年${month}月${day}日 ${weekDay} ${String(hours).padStart(2, '0')}:${minutes}:${seconds}`);
			setIsNight(hours >= 19 || hours < 6);
		}

		update();
		const timer = setInterval(update, 1000);
		return () => clearInterval(timer);
	}, []);

	function renderGreetingContent() {
		if (hour >= 0 && hour < 6) {
			return (
				<span className="leading-tight text-gray-100">
					夜深了，极客们也要 <strong className="text-yellow-300 font-bold underline decoration-yellow-400/50 underline-offset-2">早点休息 🌙</strong>，熬夜最伤身，<strong className="text-amber-400 font-bold">代码与搞钱</strong> 的事留给明天吧！
				</span>
			);
		} else if (hour >= 6 && hour < 9) {
			return (
				<span className="leading-tight text-gray-100">
					清晨好！新的一天充满无限可能，来自由论坛开启 <strong className="text-emerald-400 font-bold">元气满满 🌅</strong> 的 <strong className="text-amber-400 font-bold">搞钱日常</strong> 吧！
				</span>
			);
		} else if (hour >= 9 && hour < 12) {
			return (
				<span className="leading-tight text-gray-100">
					上午好！忙碌折腾之余，记得 <strong className="text-cyan-300 font-bold">喝口温水 🥛</strong>、伸个懒腰，生活不止代码与屏幕。
				</span>
			);
		} else if (hour >= 12 && hour < 14) {
			return (
				<span className="leading-tight text-gray-100">
					干饭时间到！<strong className="text-amber-400 font-bold">🍱 吃饱睡个小午觉</strong>，养足精神，下午思路才会更敏捷。
				</span>
			);
		} else if (hour >= 14 && hour < 19) {
			return (
				<span className="leading-tight text-gray-100">
					下午好！来杯 <strong className="text-amber-400 font-bold">☕ 咖啡</strong> 提提神，去 <strong className="text-yellow-300 font-bold underline decoration-yellow-400/60 underline-offset-2">【茶水间】</strong> 摸鱼吹水，劳逸结合效率更高！
				</span>
			);
		} else {
			return (
				<span className="leading-tight text-gray-100">
					晚上好！卸下一天的疲惫，自由论坛是属于你的 <strong className="text-yellow-300 font-bold underline decoration-yellow-400/60 underline-offset-2">数字避风港 ⛵</strong>，静心交流吧。
				</span>
			);
		}
	}

	function getTagInfo() {
		if (hour >= 0 && hour < 6) return { icon: '🌙', tag: '夜深了' };
		if (hour >= 6 && hour < 9) return { icon: '🌅', tag: '早安' };
		if (hour >= 9 && hour < 12) return { icon: '☀️', tag: '上午好' };
		if (hour >= 12 && hour < 14) return { icon: '🍱', tag: '干饭啦' };
		if (hour >= 14 && hour < 19) return { icon: '☕', tag: '下午茶' };
		return { icon: '🌆', tag: '晚上好' };
	}

	const tag = getTagInfo();

	return (
		<div
			className={`mb-4 rounded-lg px-3.5 py-2.5 shadow-md transition-all flex flex-wrap items-center gap-3 text-xs ${
				isNight
					? 'bg-[#161b22] border border-amber-500/40 shadow-amber-950/20'
					: 'bg-[#161b22] border border-sky-500/40 shadow-sky-950/20'
			}`}
		>
			<div className="flex items-center gap-1.5 flex-shrink-0">
				<Clock className={`w-3.5 h-3.5 ${isNight ? 'text-amber-400' : 'text-sky-400'}`} />
				<span className={`font-mono font-bold tracking-wide text-[13px] ${isNight ? 'text-[#facc15]' : 'text-[#38bdf8]'}`}>
					{timeText}
				</span>
			</div>
			<span className="hidden sm:inline-block text-gray-600 select-none">|</span>
			<div className="flex items-center gap-2 flex-wrap">
				<span className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold text-[11px] shadow-sm select-none bg-amber-500/20 text-[#fde047] border border-amber-500/50">
					<span>{tag.icon}</span>
					<span>{tag.tag}</span>
				</span>
				{renderGreetingContent()}
			</div>
		</div>
	);
}

export function IndexPage() {
	const token = getToken();
	const [user, setCurrentUser] = React.useState(() => getUser());
	const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
	const [posts, setPosts] = React.useState<Array<Post & { badge?: string | null; reward_points?: number; author_badges?: string }>>([]);
	const [loading, setLoading] = React.useState<boolean>(true);

	const [activeTab, setActiveTab] = React.useState<'latest_reply' | 'latest_post' | 'featured' | 'recommend' | 'original'>('latest_reply');

	const [showEditor, setShowEditor] = React.useState<boolean>(false);
	const [newTitle, setNewTitle] = React.useState('');
	const [newContent, setNewContent] = React.useState('');
	const [newCategoryId, setNewCategoryId] = React.useState<string>(() => user?.role === 'admin' ? '9' : '1');
	const [pinOnCreate, setPinOnCreate] = React.useState<boolean>(false);

	const [points, setPoints] = React.useState<number>(() => (user as any)?.points ?? 0);
	const [userTitle, setUserTitle] = React.useState<string>(() => {
		const raw = (user as any)?.title;
		if (user?.role === 'admin') return '👑 站长';
		if (!raw || raw.includes('站长')) return '🌱 初来乍到';
		return raw;
	});
	const [userBadges, setUserBadges] = React.useState<string[]>(() => {
		const raw = (user as any)?.badges;
		if (Array.isArray(raw)) return raw;
		try { return raw ? JSON.parse(raw) : []; } catch (_) { return []; }
	});

	const [checkedIn, setCheckedIn] = React.useState<boolean>(() => Boolean((user as any)?.checked_in_today));
	const [uploading, setUploading] = React.useState<boolean>(false);
	const [avatarUploading, setAvatarUploading] = React.useState<boolean>(false);
	const [uploadNotice, setUploadNotice] = React.useState<string>('');
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const avatarInputRef = React.useRef<HTMLInputElement>(null);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	// 小黑屋前台弹窗状态
	const [blackhouseOpen, setBlackhouseOpen] = React.useState(false);
	const [blackhouseList, setBlackhouseList] = React.useState<Array<{ id: number; username: string; reason: string; duration: string; created_at: string }>>([]);

	const [commStats, setCommStats] = React.useState<{
		topics: number;
		replies: number;
		users: number;
		latest_users: Array<{ id: number; username: string; avatar_url?: string | null }>;
	}>({ topics: 0, replies: 0, users: 0, latest_users: [] });

	const loadStats = React.useCallback(async () => {
		try {
			const st = await apiFetch<any>('/community-stats');
			if (st) setCommStats(st);
		} catch (_) {}
	}, []);

	React.useEffect(() => {
		loadStats();

		if (token) {
			(async () => {
				try {
					const fresh = await apiFetch<any>('/me', { headers: getSecurityHeaders('GET') });
					if (fresh && fresh.id) {
						const fixedTitle = fresh.role === 'admin' ? '👑 站长' : (fresh.title?.includes('站长') ? '🌱 初来乍到' : fresh.title);
						setPoints(fresh.points ?? 0);
						setUserTitle(fixedTitle);
						setUserBadges(Array.isArray(fresh.badges) ? fresh.badges : []);
						setCheckedIn(Boolean(fresh.checked_in_today));
						const merged = { ...fresh, title: fixedTitle };
						setUser(merged);
						setCurrentUser(merged);
					}
				} catch (_) {}
				loadPosts();
			})();
		} else {
			setLoading(false);
		}
	}, [token, loadStats]);

	async function loadPosts() {
		setLoading(true);
		try {
			const res = await apiFetch<{ items: any[]; total: number }>('/posts?limit=50&offset=0');
			setPosts(res.items || []);
		} catch (_) {
		} finally {
			setLoading(false);
		}
	}

	async function handleCheckin() {
		if (checkedIn) return;
		try {
			const res = await apiFetch<{ success: boolean; reward: number; points: number }>('/checkin', {
				method: 'POST',
				headers: getSecurityHeaders('POST')
			});
			if (res.success) {
				setPoints(res.points);
				setCheckedIn(true);
				if (user) {
					const updated = { ...user, points: res.points, checked_in_today: true } as any;
					setUser(updated);
					setCurrentUser(updated);
				}
				alert(`🎉 签到成功！获得 +${res.reward} 论坛积分！当前总积分：${res.points}`);
			}
		} catch (err: any) {
			alert(err.message || '今日已经签过到啦！');
			setCheckedIn(true);
		}
	}

	async function handleOpenBlackhouse() {
		try {
			const list = await apiFetch<any[]>('/blackhouse');
			setBlackhouseList(list || []);
			setBlackhouseOpen(true);
		} catch (e: any) {
			alert('读取小黑屋名单失败: ' + e.message);
		}
	}

	async function handleSwitchTitle() {
		const isAdmin = user?.role === 'admin';
		const availableTitles = isAdmin
			? ['👑 站长', '🐉 传说之龙', '⭐ 论坛之星', '🌏 正式成员', '🌱 初来乍到']
			: ['🐉 传说之龙', '⭐ 论坛之星', '🌏 正式成员', '🌱 初来乍到'];

		const next = prompt(`请选择或输入你想佩戴的称号：\n${availableTitles.join('、')}`, userTitle);
		if (next) {
			const trimmed = next.trim();
			if (!isAdmin && (trimmed.includes('站长') || trimmed.includes('管理员') || trimmed.includes('官方'))) {
				alert('❌ 站长与官方专属称号仅限总管理员佩戴！');
				return;
			}
			setUserTitle(trimmed);
			if (user) {
				const updated = { ...user, title: trimmed } as any;
				setUser(updated);
				setCurrentUser(updated);
				await apiFetch('/user/avatar', {
					method: 'POST',
					headers: getSecurityHeaders('POST'),
					body: JSON.stringify({ title: trimmed })
				}).catch(() => {});
			}
		}
	}

	async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !user) return;
		setAvatarUploading(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('https://cforum.day86530.workers.dev/api/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});
			const data = await res.json() as any;
			if (data.url) {
				await apiFetch('/user/avatar', {
					method: 'POST',
					headers: getSecurityHeaders('POST'),
					body: JSON.stringify({ avatar_url: data.url })
				});
				const updated = { ...user, avatar_url: data.url };
				setUser(updated);
				setCurrentUser(updated);
				loadPosts();
				loadStats();
				alert('🎉 专属个性头像更换成功！全站已实时生效！');
			} else {
				alert('头像上传失败：' + (data.error || '请重试'));
			}
		} catch (err: any) {
			alert('上传异常：' + err.message);
		} finally {
			setAvatarUploading(false);
		}
	}

	async function handleDeleteOwnAccount() {
		if (!user) return;
		if (user.role === 'admin') {
			alert('👑 站长主账号受系统保护，不可注销！普通会员可使用此功能随时无痕注销。');
			return;
		}
		const confirmText = prompt(
			`【自由论坛 · 来去自由无痕注销】\n\n我们尊重每一位成员来去自由的权利。\n注销后，您的账号、邮箱、发布的所有帖子、评论及积分将被【物理级彻底抹除】，不留任何痕迹，且不可恢复。\n\n如确定离开，请在下方输入「确认注销」四个字：`,
			''
		);
		if (confirmText !== '确认注销') {
			if (confirmText !== null) alert('输入内容不一致，已取消注销操作。');
			return;
		}

		try {
			await apiFetch('/user/self', {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			logout();
			alert('🚪 您的账号已注销完毕，感谢相伴！\n\n自由论坛随时欢迎您再次归来！');
			window.location.href = '/';
		} catch (err: any) {
			alert('注销失败：' + err.message);
		}
	}

	async function uploadSingleFile(file: File) {
		setUploading(true);
		setUploadNotice('正在秒传文件至云端...');
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('https://cforum.day86530.workers.dev/api/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});
			const data = await res.json() as any;
			if (data.url) {
				const isImg = file.type.startsWith('image/');
				const markdownInsert = isImg
					? `\n\n![${file.name || '图片'}](${data.url})\n\n`
					: `\n\n📎 [下载附件: ${file.name || '文件'}](${data.url})\n\n`;

				setNewContent(prev => prev + markdownInsert);
				setUploadNotice(isImg ? '✅ 截图已自动粘贴成功！' : '✅ 附件上传成功！');
				setTimeout(() => setUploadNotice(''), 3000);
			} else {
				alert('上传失败：' + (data.error || '未知错误'));
			}
		} catch (err: any) {
			alert('上传异常：' + err.message);
		} finally {
			setUploading(false);
		}
	}

	function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf('image') !== -1) {
				const file = items[i].getAsFile();
				if (file) {
					e.preventDefault();
					uploadSingleFile(file);
					return;
				}
			}
		}
	}

	function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) uploadSingleFile(files[0]);
	}

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) uploadSingleFile(file);
	}

	async function handleCreatePost(e: React.FormEvent) {
		e.preventDefault();
		if (!newTitle.trim() || !newContent.trim()) return;
		try {
			const res = await apiFetch<{ success: boolean; id: number }>('/posts', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ title: newTitle, content: newContent, category_id: Number(newCategoryId) || 1 })
			});
			if (pinOnCreate && res?.id && user?.role === 'admin') {
				await apiFetch(`/posts/${res.id}/pin`, { method: 'POST', headers: getSecurityHeaders('POST') }).catch(() => {});
			}
			setNewTitle('');
			setNewContent('');
			setPinOnCreate(false);
			setShowEditor(false);
			setSelectedCategory('all');
			loadPosts();
			loadStats();
		} catch (err: any) {
			alert(err.message || '发布失败');
		}
	}

	async function handleTogglePin(postId: number) {
		try {
			await apiFetch(`/posts/${postId}/pin`, { method: 'POST', headers: getSecurityHeaders('POST') });
			loadPosts();
		} catch (err: any) {
			alert('操作失败: ' + err.message);
		}
	}

	async function handleSetBadgeOnly(postId: number, authorName: string) {
		const choice = prompt(
			`【站长帖子授勋】（纯勋章标识，不增加积分）\n正在为作者【${authorName}】设置荣誉标识：\n\n1 = 💎 精华\n2 = 🔥 推荐\n3 = 🏆 神帖\n4 = ✨ 原创\n0 = 取消勋章\n\n请输入数字：`,
			'1'
		);
		if (choice === null) return;
		const map: Record<string, string | null> = {
			'1': '精华',
			'2': '推荐',
			'3': '神帖',
			'4': '原创',
			'0': null
		};
		const badge = map[choice.trim()];
		if (badge === undefined) return alert('请输入 0 ~ 4 之间的数字！');
		try {
			await apiFetch(`/posts/${postId}/badge`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ badge })
			});
			loadPosts();
		} catch (err: any) {
			alert('操作失败: ' + err.message);
		}
	}

	async function handleRewardPost(postId: number, authorName: string) {
		const input = prompt(
			`【站长打赏优质帖子】\n作者：${authorName}\n\n请输入要奖励给作者的积分数值（如 20、50、100）：`,
			'50'
		);
		if (!input) return;
		const amount = parseInt(input.trim());
		if (isNaN(amount) || amount <= 0) return alert('请输入大于 0 的有效整数！');

		try {
			const res = await apiFetch<{ success: boolean; total_reward: number }>(`/posts/${postId}/reward`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ amount })
			});
			if (res.success) {
				alert(`🎉 打赏成功！已向作者【${authorName}】发放 +${amount} 论坛积分！该帖累计获赏：${res.total_reward}分`);
				loadPosts();
			}
		} catch (err: any) {
			alert('打赏失败: ' + err.message);
		}
	}

	async function handleMoveCategory(postId: number, currentTitle: string) {
		const menu = ALL_CATEGORIES.map(c => `${c.id} = ${c.name}`).join('\n');
		const input = prompt(
			`【站长移动帖子板块】\n当前帖子：《${currentTitle}》\n\n请选择要移入的新板块编号：\n${menu}`,
			'1'
		);
		if (!input) return;
		const targetCatId = parseInt(input.trim());
		if (isNaN(targetCatId) || targetCatId < 1 || targetCatId > 9) {
			alert('请输入 1 ~ 9 之间的有效板块编号！');
			return;
		}

		try {
			await apiFetch(`/admin/posts/${postId}/move`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ category_id: targetCatId })
			});
			const targetName = ALL_CATEGORIES.find(c => c.id === targetCatId)?.name;
			alert(`🎉 移动成功！帖子已成功移入【${targetName}】板块！`);
			loadPosts();
		} catch (err: any) {
			alert('移动失败: ' + err.message);
		}
	}

	async function handleDeletePost(postId: number, title: string) {
		if (!confirm(`确定要删除《${title}》吗？`)) return;
		try {
			await apiFetch(`/posts/${postId}`, { method: 'DELETE', headers: getSecurityHeaders('DELETE') });
			loadPosts();
			loadStats();
		} catch (err: any) {
			alert('删除失败: ' + err.message);
		}
	}

	function renderBadge(badge?: string | null) {
		if (!badge) return null;
		if (badge === '精华') return <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">💎 精华</span>;
		if (badge === '推荐') return <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">🔥 推荐</span>;
		if (badge === '神帖') return <span className="bg-amber-500 text-black text-xs font-extrabold px-2 py-0.5 rounded shadow-sm">🏆 神帖</span>;
		if (badge === '原创') return <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">✨ 原创</span>;
		return <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">{badge}</span>;
	}

	function parseBadges(badgesStr?: string): string[] {
		if (!badgesStr) return [];
		try {
			return JSON.parse(badgesStr);
		} catch (_) {
			return [];
		}
	}

	const isAdmin = user?.role === 'admin';
	const selectableCategories = isAdmin
		? ALL_CATEGORIES
		: ALL_CATEGORIES.filter(c => c.id !== 9);

	const navPills = [{ id: 'all', name: '全部主题' }, ...ALL_CATEGORIES.map(c => ({ id: String(c.id), name: c.name }))];

	const filteredPosts = posts.filter(p => {
		if (activeTab === 'featured' && p.badge !== '精华' && p.badge !== '神帖') return false;
		if (activeTab === 'recommend' && p.badge !== '推荐') return false;
		if (activeTab === 'original' && p.badge !== '原创') return false;
		if (selectedCategory === 'all') return true;
		return String(p.category_id) === selectedCategory;
	});

	function getCategoryName(catId: number | null | undefined, fallback?: string | null) {
		if (fallback) return fallback;
		return ALL_CATEGORIES.find(c => c.id === Number(catId))?.name || '茶水间';
	}

	const allRealUsers = commStats.latest_users || [];
	const displayLatestUsers = allRealUsers.slice(0, 8);
	const displayOnlineUsers = allRealUsers.slice(0, Math.min(8, allRealUsers.length));
	const onlineCount = Math.min(commStats.users || 1, Math.max(1, Math.floor((commStats.users || 1) * 0.4) + 1));

	return (
		<PageShell>
			<div className="flex flex-wrap items-center gap-2 mb-3">
				{navPills.map(pill => (
					<button
						key={pill.id}
						onClick={() => setSelectedCategory(pill.id)}
						className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
							selectedCategory === pill.id ? 'bg-[#21262d] text-white border border-[#30363d]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#161b22]'
						}`}
					>
						{pill.name}
					</button>
				))}
			</div>

			<TimeGreetingBanner />

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
				<div className="lg:col-span-9 space-y-4">
					<div className="flex items-center justify-between border-b border-[#30363d] pb-2 flex-wrap gap-2">
						<div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
							<button
								onClick={() => setActiveTab('latest_reply')}
								className={`pb-1 flex items-center gap-1 transition-colors ${
									activeTab === 'latest_reply' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'
								}`}
							>
								<MessageSquare className="w-3.5 h-3.5 text-blue-400" /> 最新回复
							</button>

							<button
								onClick={() => setActiveTab('latest_post')}
								className={`pb-1 flex items-center gap-1 transition-colors ${
									activeTab === 'latest_post' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'
								}`}
							>
								<Zap className="w-3.5 h-3.5 text-yellow-400" /> 最新发布
							</button>

							<button
								onClick={() => setActiveTab('recommend')}
								className={`pb-1 flex items-center gap-1 transition-colors ${
									activeTab === 'recommend' ? 'text-rose-400 border-b-2 border-rose-500' : 'text-gray-400 hover:text-rose-300'
								}`}
							>
								<Flame className="w-3.5 h-3.5 text-rose-500" /> 站长推荐
							</button>

							<button
								onClick={() => setActiveTab('featured')}
								className={`pb-1 flex items-center gap-1 transition-colors ${
									activeTab === 'featured' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-purple-300'
								}`}
							>
								💎 精华神帖
							</button>

							<button
								onClick={() => setActiveTab('original')}
								className={`pb-1 flex items-center gap-1 transition-colors ${
									activeTab === 'original' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-emerald-300'
								}`}
							>
								✨ 原创专区
							</button>
						</div>

						{user && (
							<button onClick={() => setShowEditor(!showEditor)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium shadow-sm">
								<Plus className="w-3.5 h-3.5" /> 发帖
							</button>
						)}
					</div>

					{showEditor && user && (
						<form onSubmit={handleCreatePost} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
							<div className="flex gap-2">
								<select
									value={newCategoryId}
									onChange={e => setNewCategoryId(e.target.value)}
									className="bg-[#0d1117] border border-[#30363d] text-white text-xs rounded px-2.5 py-1.5 font-medium"
								>
									{selectableCategories.map(c => (
										<option key={c.id} value={c.id}>
											{c.id === 9 ? '📢 公告（官方专属）' : c.name}
										</option>
									))}
								</select>
								<Input placeholder="标题：请用一句话说清你的主题" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-[#0d1117] border-[#30363d] text-white text-sm" />
							</div>

							<div className="relative">
								<textarea
									ref={textareaRef}
									rows={7}
									onPaste={handlePaste}
									onDrop={handleDrop}
									placeholder="正文内容（支持截图直接 Ctrl+V 粘贴、拖拽图片进框、支持 Markdown 语法）..."
									value={newContent}
									onChange={e => setNewContent(e.target.value)}
									className="w-full bg-[#0d1117] border border-[#30363d] text-white text-sm rounded-md p-3 outline-none focus:border-blue-500 leading-relaxed font-sans"
								/>
								{uploadNotice && (
									<div className="absolute bottom-3 right-3 text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-700 px-2.5 py-1 rounded shadow-lg animate-pulse">
										{uploadNotice}
									</div>
								)}
							</div>

							<div className="flex items-center justify-between pt-1 flex-wrap gap-2">
								<div className="flex items-center gap-3">
									<input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
									<Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="border-[#30363d] text-gray-300 text-xs h-7">
										<Paperclip className="w-3.5 h-3.5 mr-1" /> {uploading ? '上传中...' : '📎 上传文件/附件'}
									</Button>
									<span className="text-[11px] text-gray-400 hidden sm:inline">
										💡 提示：截图后直接在正文框按 <strong>Ctrl + V</strong> 即可秒贴图片！
									</span>
									{isAdmin && (
										<label className="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer">
											<input type="checkbox" checked={pinOnCreate} onChange={e => setPinOnCreate(e.target.checked)} /> 📌 直接设为全站置顶帖
										</label>
									)}
								</div>
								<div className="flex gap-2">
									<Button type="button" variant="ghost" size="sm" onClick={() => setShowEditor(false)} className="text-xs text-gray-400">取消</Button>
									<Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">立即发布</Button>
								</div>
							</div>
						</form>
					)}

					{!user ? (
						<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center space-y-4">
							<div className="w-14 h-14 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
								<Lock className="w-7 h-7" />
							</div>
							<h3 className="text-lg font-bold text-white">会员专属私密社区 · 仅限注册用户查看</h3>
							<p className="text-xs text-gray-400 max-w-md mx-auto">自由论坛仅对注册会员开放浏览。10 秒免费注册即可解锁全部板块并领取每日签到积分！</p>
							<div className="flex items-center justify-center gap-3 pt-2">
								<Button asChild className="bg-blue-600 hover:bg-blue-700 text-white px-6"><a href="/register">立即免费注册</a></Button>
								<Button asChild variant="outline" className="border-gray-700 text-gray-200 px-6"><a href="/login">已有账号登录</a></Button>
							</div>
						</div>
					) : (
						<div className="bg-[#161b22] border border-[#30363d] rounded-lg divide-y divide-[#21262d] overflow-hidden shadow-sm">
							{loading ? (
								<div className="p-8 text-center text-gray-500 text-sm">正在加载自由论坛内容...</div>
							) : filteredPosts.length === 0 ? (
								<div className="p-12 text-center text-gray-400 space-y-2">
									<Coffee className="w-8 h-8 mx-auto text-gray-500 stroke-1" />
									<p className="text-sm">该专区暂无主题，快来发布第一帖吧！</p>
								</div>
							) : (
								filteredPosts.map(post => {
									const postAuthorBadges = parseBadges(post.author_badges);
									return (
										<div key={post.id} className="p-4 hover:bg-[#1c2128] transition-colors flex items-start gap-3.5 group">
											<div className="w-11 h-11 rounded-lg bg-[#21262d] flex-shrink-0 flex items-center justify-center font-bold text-gray-300 border border-[#30363d] overflow-hidden shadow-sm">
												{post.author_avatar ? (
													<img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
												) : (
													<span className="text-xs text-blue-400 font-extrabold tracking-wider">
														{(post.author_name || 'U').slice(0, 2).toUpperCase()}
													</span>
												)}
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap leading-normal">
													{post.is_pinned === 1 && (
														<span className="bg-[#b35900] text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">
															置顶
														</span>
													)}
													{renderBadge(post.badge)}

													<a
														href={`/post?id=${post.id}`}
														className={`text-[16.5px] font-semibold leading-relaxed tracking-normal group-hover:text-blue-400 transition-colors ${
															post.is_pinned === 1
																? 'text-[#ff7b72]'
																: post.badge
																? 'text-amber-200'
																: 'text-[#f0f6fc]'
														}`}
													>
														{post.title}
													</a>

													{(post.reward_points ?? 0) > 0 && (
														<span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] px-2 py-0.5 rounded-full font-bold">
															🎁 已赏 +{post.reward_points}分
														</span>
													)}
												</div>

												<div className="flex items-center gap-2.5 mt-2 text-[12px] text-gray-400 flex-wrap">
													<span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
														{post.author_role === 'admin' ? '👑 站长' : (post.author_title || '🌱 初来乍到')}
													</span>

													{postAuthorBadges.map((b, bi) => (
														<span key={bi} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
															{b}
														</span>
													))}

													<span className="font-semibold text-gray-300">{post.author_name || '会员'}</span>
													<span>•</span>
													<span>{formatDate(post.created_at)}</span>
													<span>•</span>
													<span className="bg-[#21262d] text-gray-300 px-2 py-0.5 rounded text-[11px] border border-[#30363d] font-medium">
														{getCategoryName(post.category_id, post.category_name)}
													</span>

													{isAdmin && (
														<span className="ml-auto flex items-center gap-2.5 flex-wrap">
															<button
																type="button"
																onClick={() => handleMoveCategory(post.id, post.title)}
																className="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
															>
																<FolderInput className="w-3 h-3" /> 移板块
															</button>

															<button
																type="button"
																onClick={() => handleSetBadgeOnly(post.id, post.author_name || '会员')}
																className="text-[11px] text-purple-400 hover:underline flex items-center gap-0.5 font-medium"
															>
																<Award className="w-3 h-3" /> 授勋
															</button>

															<button
																type="button"
																onClick={() => handleRewardPost(post.id, post.author_name || '会员')}
																className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5 font-medium"
															>
																<Gift className="w-3 h-3" /> 打赏积分
															</button>

															<button
																type="button"
																onClick={() => handleTogglePin(post.id)}
																className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5 font-medium"
															>
																<Pin className="w-3 h-3" /> {post.is_pinned === 1 ? '取消置顶' : '置顶'}
															</button>
															<button
																type="button"
																onClick={() => handleDeletePost(post.id, post.title)}
																className="text-[11px] text-red-400 hover:underline flex items-center gap-0.5 font-medium"
															>
																<Trash2 className="w-3 h-3" /> 删除
															</button>
														</span>
													)}
												</div>
											</div>

											<div className="flex items-center gap-1 text-gray-400 group-hover:text-blue-400 bg-[#21262d] px-2.5 py-1 rounded-full text-xs font-bold border border-[#30363d]/60">
												<MessageSquare className="w-3.5 h-3.5" /> <span>{post.comment_count || 0}</span>
											</div>
										</div>
									);
								})
							)}
						</div>
					)}

					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 text-center space-y-3 shadow-md">
						<div className="flex items-center justify-center gap-2 text-sm font-bold text-white">
							<Send className="w-4 h-4 text-sky-400" />
							<span>自由论坛官方 Telegram 防失联与福利矩阵</span>
						</div>
						<div className="flex flex-wrap items-center justify-center gap-4 text-xs">
							<a
								href="https://t.me/eziyuan_1"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 px-4 py-1.5 rounded-full font-semibold transition-all"
							>
								📢 关注TG频道：<span className="text-yellow-300 underline">@eziyuan_1</span>
							</a>
							<a
								href="https://t.me/eziyuan_2"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-1.5 rounded-full font-semibold transition-all"
							>
								💬 加入TG群组：<span className="text-yellow-300 underline">@eziyuan_2</span>
							</a>
						</div>
						<p className="text-[11px] text-gray-500 pt-1">
							© 2026 自由论坛 · 轻量极客生活社区 · 来去自由 · 规则共决
						</p>
					</div>
				</div>

				<div className="lg:col-span-3 space-y-4">
					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm">
						{user ? (
							<div className="space-y-3">
								<input
									type="file"
									ref={avatarInputRef}
									onChange={handleAvatarUpload}
									accept="image/*"
									className="hidden"
								/>
								<div className="flex items-center gap-3">
									<div
										onClick={() => avatarInputRef.current?.click()}
										title="点击上传更换您的专属个性头像"
										className="relative w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 cursor-pointer overflow-hidden group"
									>
										{user.avatar_url ? (
											<img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
										) : (
											<span>{user.username.slice(0, 1).toUpperCase()}</span>
										)}
										<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
											<Camera className="w-4 h-4 text-white" />
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<h4 className="font-bold text-white text-base truncate">{user.username}</h4>
											<button
												type="button"
												onClick={() => avatarInputRef.current?.click()}
												className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5"
											>
												<Camera className="w-3 h-3" />
												{avatarUploading ? '上传中' : '换头像'}
											</button>
										</div>
										<button onClick={handleSwitchTitle} className="mt-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1">
											<Trophy className="w-3 h-3 text-yellow-500" /> {userTitle}
										</button>
									</div>
								</div>

								{userBadges.length > 0 && (
									<div className="bg-[#0d1117] p-2 rounded-md border border-[#21262d] flex flex-wrap gap-1.5">
										{userBadges.map((b, bi) => (
											<span key={bi} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
												{b}
											</span>
										))}
									</div>
								)}

								<div className="bg-[#0d1117] p-2.5 rounded-md border border-[#21262d] flex items-center justify-between">
									<div>
										<span className="text-[11px] text-gray-400 block">论坛积分</span>
										<span className="text-base font-bold text-yellow-400 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> {points}</span>
									</div>
									<Button size="sm" onClick={handleCheckin} disabled={checkedIn} className={`text-xs h-7 px-3 ${checkedIn ? 'bg-gray-700 text-gray-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
										<CalendarCheck className="w-3.5 h-3.5 mr-1" /> {checkedIn ? '今日已签' : '每日签到'}
									</Button>
								</div>
								<Button onClick={() => setShowEditor(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8">
									+ 发布新主题
								</Button>
							</div>
						) : (
							<div className="text-center py-2 space-y-3">
								<h4 className="font-bold text-white text-sm">自由论坛 - 私密极客社区</h4>
								<div className="flex gap-2">
									<Button asChild size="sm" variant="outline" className="flex-1 text-xs border-gray-700"><a href="/login">登录</a></Button>
									<Button asChild size="sm" className="flex-1 text-xs bg-blue-600 text-white"><a href="/register">免费注册</a></Button>
								</div>
							</div>
						)}
					</div>

					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3.5 text-xs space-y-2">
						<span className="font-bold text-gray-200 block mb-2">快捷功能</span>
						<div className="grid grid-cols-2 gap-y-2 text-gray-400">
							<span onClick={handleCheckin} className="hover:text-emerald-400 cursor-pointer text-emerald-500 font-medium">• 每日签到（领积分）</span>
							<span onClick={() => avatarInputRef.current?.click()} className="hover:text-sky-400 cursor-pointer text-sky-400 font-medium">• 📷 更换个性头像</span>
							<span onClick={handleOpenBlackhouse} className="hover:text-rose-400 cursor-pointer text-rose-400 font-bold flex items-center gap-1">• <Gavel className="w-3 h-3" /> 社区小黑屋</span>
							<span onClick={handleSwitchTitle} className="hover:text-blue-400 cursor-pointer">• 我的称号仓库</span>
							<span onClick={() => setActiveTab('featured')} className="hover:text-purple-400 cursor-pointer text-purple-400 font-medium">• 💎 精华神帖列表</span>
							<span onClick={handleDeleteOwnAccount} className="hover:text-rose-400 cursor-pointer text-rose-400/90 font-medium">• 🚪 账号注销(自由)</span>
						</div>
					</div>

					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
						<div>
							<h4 className="font-bold text-white text-sm">站点统计</h4>
							<p className="text-xs text-gray-400 mt-1">主题 {commStats.topics} · 回复 {commStats.replies} · 用户 {commStats.users}</p>
						</div>
						<div className="pt-1">
							<h4 className="font-bold text-white text-sm mb-3">最新用户</h4>
							<div className="grid grid-cols-4 gap-y-3 gap-x-2">
								{displayLatestUsers.map((u, idx) => (
									<CuteCircleAvatar key={`latest-${u.id}-${idx}`} name={u.username} avatarUrl={u.avatar_url} index={idx} />
								))}
							</div>
						</div>
					</div>

					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
						<div className="flex items-center justify-between">
							<h4 className="font-bold text-white text-sm">当前在线</h4>
							<span className="bg-[#0f2d1e] text-[#3fb950] border border-[#238636]/40 text-xs font-bold px-2.5 py-0.5 rounded-full">{onlineCount} 人</span>
						</div>
						<div className="grid grid-cols-4 gap-y-3 gap-x-2 pt-1">
							{displayOnlineUsers.map((u, idx) => (
								<CuteCircleAvatar key={`online-${u.id}-${idx}`} name={u.username} avatarUrl={u.avatar_url} index={idx + 3} />
							))}
						</div>
					</div>
				</div>
			</div>

			{/* 社区小黑屋公示大弹窗 */}
			{blackhouseOpen && (
				<div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-rose-500/40 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Gavel className="w-5 h-5 text-rose-500" />
								<h3 className="font-bold text-base text-rose-400">自由论坛 · 社区小黑屋公示墙</h3>
							</div>
							<button onClick={() => setBlackhouseOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<p className="text-xs text-gray-400 leading-relaxed">
							为维护纯粹、友善、不被欺诈的极客交流秩序，以下违规账号已被站长关入小黑屋反省，处分期间剥夺发言与活动权限：
						</p>

						<div className="max-h-60 overflow-y-auto divide-y divide-[#21262d] border border-[#30363d] rounded-lg bg-[#0d1117]">
							{blackhouseList.length === 0 ? (
								<div className="py-8 text-center text-xs text-gray-500">
									🕊️ 天朗气清，当前暂无被关押的违规人员。
								</div>
							) : (
								blackhouseList.map((item) => (
									<div key={item.id} className="p-3 text-xs flex items-center justify-between gap-3">
										<div>
											<span className="font-bold text-rose-300 block">{item.username}</span>
											<span className="text-[11px] text-gray-400 block mt-0.5">罪由：{item.reason}</span>
										</div>
										<div className="text-right flex-shrink-0">
											<span className="bg-rose-950/60 text-rose-400 border border-rose-800/60 px-2 py-0.5 rounded text-[10px] font-bold block">
												{item.duration}
											</span>
											<span className="text-[10px] text-gray-500 block mt-1">{formatDate(item.created_at)}</span>
										</div>
									</div>
								))
							)}
						</div>

						<div className="flex justify-end pt-2 border-t border-[#30363d]">
							<Button size="sm" onClick={() => setBlackhouseOpen(false)} className="bg-gray-800 hover:bg-gray-700 text-xs">
								关闭公示窗口
							</Button>
						</div>
					</div>
				</div>
			)}
		</PageShell>
	);
}
