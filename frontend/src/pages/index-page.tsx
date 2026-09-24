import * as React from 'react';
import { MessageSquare, Plus, Coffee, CalendarCheck, Paperclip, Sparkles, Trophy, Lock, Pin, Trash2, Award, Clock, Send } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, formatDate, getSecurityHeaders, type Category, type Post } from '@/lib/api';
import { getToken, getUser, setUser } from '@/lib/auth';

const DEFAULT_CATEGORIES: Category[] = [
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
	const [categories, setCategories] = React.useState<Category[]>(DEFAULT_CATEGORIES);
	const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
	const [posts, setPosts] = React.useState<Array<Post & { badge?: string | null; reward_points?: number }>>([]);
	const [loading, setLoading] = React.useState<boolean>(true);
	const [activeTab, setActiveTab] = React.useState<'comment' | 'post' | 'featured'>('comment');
	const [showEditor, setShowEditor] = React.useState<boolean>(false);
	const [newTitle, setNewTitle] = React.useState('');
	const [newContent, setNewContent] = React.useState('');
	const [newCategoryId, setNewCategoryId] = React.useState<string>('9');
	const [pinOnCreate, setPinOnCreate] = React.useState<boolean>(false);

	const [points, setPoints] = React.useState<number>(() => (user as any)?.points ?? 0);
	const [userTitle, setUserTitle] = React.useState<string>(() => {
		const raw = (user as any)?.title;
		if (!raw || raw.includes('创始站长')) return user?.role === 'admin' ? '👑 站长' : '🌱 初来乍到';
		return raw;
	});
	const [checkedIn, setCheckedIn] = React.useState<boolean>(() => Boolean((user as any)?.checked_in_today));
	const [uploading, setUploading] = React.useState<boolean>(false);
	const [uploadNotice, setUploadNotice] = React.useState<string>('');
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	const [commStats, setCommStats] = React.useState<{
		topics: number;
		replies: number;
		users: number;
		latest_users: Array<{ id: number; username: string; avatar_url?: string | null }>;
	}>({ topics: 0, replies: 0, users: 0, latest_users: [] });

	React.useEffect(() => {
		async function init() {
			try {
				const cats = await apiFetch<Category[]>('/categories');
				if (cats && cats.length >= 5) setCategories(cats);
			} catch (_) {}

			try {
				const st = await apiFetch<any>('/community-stats');
				if (st) setCommStats(st);
			} catch (_) {}

			if (token) {
				try {
					const fresh = await apiFetch<any>('/me', { headers: getSecurityHeaders('GET') });
					if (fresh && fresh.id) {
						const fixedTitle = (!fresh.title || fresh.title.includes('创始站长'))
							? (fresh.role === 'admin' ? '👑 站长' : '🌱 初来乍到')
							: fresh.title;
						setPoints(fresh.points ?? 0);
						setUserTitle(fixedTitle);
						setCheckedIn(Boolean(fresh.checked_in_today));
						const merged = { ...fresh, title: fixedTitle };
						setUser(merged);
						setCurrentUser(merged);
					}
				} catch (_) {}
				loadPosts();
			} else {
				setLoading(false);
			}
		}
		init();
	}, [token]);

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

	function handleSwitchTitle() {
		const titles = ['👑 站长', '🐉 传说之龙', '⭐ 论坛之星', '🌏 正式成员', '🌱 初来乍到'];
		const next = prompt('请选择或输入你想佩戴的称号：\n' + titles.join('、'), userTitle);
		if (next) {
			const trimmed = next.trim();
			setUserTitle(trimmed);
			if (user) setUser({ ...user, title: trimmed } as any);
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

	async function handleSetBadgeAndReward(postId: number, authorName: string) {
		const choice = prompt(
			`【站长好帖授勋 & 自动发奖】\n正在为作者【${authorName}】授勋：\n1 = 💎 精华（+50积分）\n2 = 🔥 推荐（+20积分）\n3 = 🏆 神帖（+100积分）\n4 = ✨ 原创（+30积分）\n0 = 取消勋章`,
			'1'
		);
		if (choice === null) return;
		const map: Record<string, { badge: string | null; bonus: number }> = {
			'1': { badge: '精华', bonus: 50 },
			'2': { badge: '推荐', bonus: 20 },
			'3': { badge: '神帖', bonus: 100 },
			'4': { badge: '原创', bonus: 30 },
			'0': { badge: null, bonus: 0 }
		};
		const selected = map[choice.trim()];
		if (!selected) return alert('请输入 0 ~ 4 之间的数字！');
		try {
			await apiFetch(`/posts/${postId}/badge`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify(selected)
			});
			loadPosts();
		} catch (err: any) {
			alert('操作失败: ' + err.message);
		}
	}

	async function handleDeletePost(postId: number, title: string) {
		if (!confirm(`确定要删除《${title}》吗？`)) return;
		try {
			await apiFetch(`/posts/${postId}`, { method: 'DELETE', headers: getSecurityHeaders('DELETE') });
			loadPosts();
		} catch (err: any) {
			alert('删除失败: ' + err.message);
		}
	}

	function renderBadge(badge?: string | null) {
		if (!badge) return null;
		if (badge === '精华') return <span className="bg-purple-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded">💎 精华</span>;
		if (badge === '推荐') return <span className="bg-rose-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded">🔥 推荐</span>;
		if (badge === '神帖') return <span className="bg-amber-500 text-black text-[11px] font-extrabold px-1.5 py-0.2 rounded">🏆 神帖</span>;
		if (badge === '原创') return <span className="bg-emerald-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded">✨ 原创</span>;
		return <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded">{badge}</span>;
	}

	const navPills = [{ id: 'all', name: '全部主题' }, ...DEFAULT_CATEGORIES.map(c => ({ id: String(c.id), name: c.name }))];
	const filteredPosts = posts.filter(p => {
		if (activeTab === 'featured' && !p.badge) return false;
		if (selectedCategory === 'all') return true;
		return String(p.category_id) === selectedCategory;
	});

	function getCategoryName(catId: number | null | undefined, fallback?: string | null) {
		if (fallback) return fallback;
		return DEFAULT_CATEGORIES.find(c => c.id === Number(catId))?.name || '茶水间';
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
					<div className="flex items-center justify-between border-b border-[#30363d] pb-2">
						<div className="flex items-center gap-4 text-xs font-semibold">
							<button onClick={() => setActiveTab('comment')} className={`pb-1 ${activeTab === 'comment' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>
								全部动态
							</button>
							<button onClick={() => setActiveTab('featured')} className={`pb-1 flex items-center gap-1 ${activeTab === 'featured' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-400'}`}>
								💎 精华神帖区
							</button>
						</div>
						{user && (
							<button onClick={() => setShowEditor(!showEditor)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium">
								<Plus className="w-3.5 h-3.5" /> 发帖
							</button>
						)}
					</div>

					{showEditor && user && (
						<form onSubmit={handleCreatePost} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
							<div className="flex gap-2">
								<select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className="bg-[#0d1117] border border-[#30363d] text-white text-xs rounded px-2.5 py-1.5">
									{DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
									{user.role === 'admin' && (
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
						<div className="bg-[#161b22] border border-[#30363d] rounded-lg divide-y divide-[#21262d] overflow-hidden">
							{loading ? (
								<div className="p-8 text-center text-gray-500 text-sm">正在加载自由论坛内容...</div>
							) : filteredPosts.length === 0 ? (
								<div className="p-12 text-center text-gray-400 space-y-2">
									<Coffee className="w-8 h-8 mx-auto text-gray-500 stroke-1" />
									<p className="text-sm">该分类下暂无主题，快来发布第一帖吧！</p>
								</div>
							) : (
								filteredPosts.map(post => (
									<div key={post.id} className="p-3.5 hover:bg-[#1c2128] transition-colors flex items-start gap-3 group">
										<div className="w-10 h-10 rounded-md bg-[#21262d] flex-shrink-0 flex items-center justify-center font-bold text-gray-300 border border-[#30363d]">
											<span className="text-xs text-blue-400">{(post.author_name || 'U').slice(0, 2).toUpperCase()}</span>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 flex-wrap">
												{post.is_pinned === 1 && <span className="bg-[#b35900] text-white text-[11px] font-bold px-1.5 py-0.2 rounded">置顶</span>}
												{renderBadge(post.badge)}
												<a href={`/post?id=${post.id}`} className={`text-[15px] font-medium group-hover:text-blue-400 ${post.is_pinned === 1 ? 'text-[#ff7b72] font-semibold' : 'text-gray-100'}`}>
													{post.title}
												</a>
												{(post.reward_points ?? 0) > 0 && (
													<span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
														🎁 已赏 +{post.reward_points}分
													</span>
												)}
											</div>
											<div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 flex-wrap">
												<span className="text-[11px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
													{post.author_role === 'admin' ? '👑 站长' : (post.author_title || '🌱 初来乍到')}
												</span>
												<span className="font-medium text-gray-300">{post.author_name || '会员'}</span>
												<span>•</span>
												<span>{formatDate(post.created_at)}</span>
												<span>•</span>
												<span className="bg-[#21262d] text-gray-300 px-1.5 py-0.5 rounded text-[11px] border border-[#30363d]">
													{getCategoryName(post.category_id, post.category_name)}
												</span>
												{user.role === 'admin' && (
													<span className="ml-auto flex items-center gap-2.5">
														<button type="button" onClick={() => handleSetBadgeAndReward(post.id, post.author_name || '会员')} className="text-[11px] text-purple-400 hover:underline flex items-center gap-0.5">
															<Award className="w-3 h-3" /> 加精/发奖
														</button>
														<button type="button" onClick={() => handleTogglePin(post.id)} className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5">
															<Pin className="w-3 h-3" /> {post.is_pinned === 1 ? '取消置顶' : '置顶'}
														</button>
														<button type="button" onClick={() => handleDeletePost(post.id, post.title)} className="text-[11px] text-red-400 hover:underline flex items-center gap-0.5">
															<Trash2 className="w-3 h-3" /> 删除
														</button>
													</span>
												)}
											</div>
										</div>
										<div className="flex items-center gap-1 text-gray-400 bg-[#21262d] px-2 py-1 rounded-full text-xs font-semibold">
											<MessageSquare className="w-3.5 h-3.5" /> <span>{post.comment_count || 0}</span>
										</div>
									</div>
								))
							)}
						</div>
					)}

					{/* 新增：箭头指向的正中央底部黄金引流卡片！看完帖子视线直接落在这里 */}
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
							© 2026 自由论坛 · 轻量极客生活社区 · 规则共决 · 资源共享
						</p>
					</div>
				</div>

				{/* 右侧边栏 */}
				<div className="lg:col-span-3 space-y-4">
					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm">
						{user ? (
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
										{user.username.slice(0, 1).toUpperCase()}
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="font-bold text-white text-base truncate">{user.username}</h4>
										<button onClick={handleSwitchTitle} className="mt-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1">
											<Trophy className="w-3 h-3 text-yellow-500" /> {userTitle}
										</button>
									</div>
								</div>
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
							<span onClick={handleSwitchTitle} className="hover:text-blue-400 cursor-pointer">• 我的称号仓库</span>
							<span onClick={() => setActiveTab('featured')} className="hover:text-purple-400 cursor-pointer text-purple-400 font-medium">• 💎 精华神帖列表</span>
							<span className="hover:text-white cursor-pointer">• 社区热榜</span>
							<span className="hover:text-white cursor-pointer">• 用户榜单</span>
							<span className="hover:text-white cursor-pointer">• 站点地图</span>
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
		</PageShell>
	);
}
