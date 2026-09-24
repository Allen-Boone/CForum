import * as React from 'react';
import { MessageSquare, Plus, Coffee, CalendarCheck, Image as ImageIcon, Sparkles, Trophy, Lock } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, formatDate, getSecurityHeaders, type Category, type Post } from '@/lib/api';
import { getToken, getUser, setUser } from '@/lib/auth';

export function IndexPage() {
	const token = getToken();
	const [user, setCurrentUser] = React.useState(() => getUser());
	const [categories, setCategories] = React.useState<Category[]>([]);
	const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
	const [posts, setPosts] = React.useState<Post[]>([]);
	const [loading, setLoading] = React.useState<boolean>(true);
	const [activeTab, setActiveTab] = React.useState<'comment' | 'post'>('comment');
	const [showEditor, setShowEditor] = React.useState<boolean>(false);
	const [newTitle, setNewTitle] = React.useState('');
	const [newContent, setNewContent] = React.useState('');
	const [newCategoryId, setNewCategoryId] = React.useState<string>('1');

	const [points, setPoints] = React.useState<number>(() => (user as any)?.points ?? 0);
	const [userTitle, setUserTitle] = React.useState<string>(() => (user as any)?.title || (user?.role === 'admin' ? '👑 创始站长' : '🌱 初来乍到'));
	const [checkedIn, setCheckedIn] = React.useState<boolean>(() => Boolean((user as any)?.checked_in_today));
	const [uploading, setUploading] = React.useState<boolean>(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	// 页面打开时，自动从数据库同步最新积分与签到状态
	React.useEffect(() => {
		async function init() {
			try {
				const cats = await apiFetch<Category[]>('/categories');
				setCategories(cats || []);
			} catch (_) {}

			if (token) {
				try {
					const freshUser = await apiFetch<any>('/me', { headers: getSecurityHeaders('GET') });
					if (freshUser && freshUser.id) {
						setPoints(freshUser.points ?? 0);
						setUserTitle(freshUser.title || '🌱 初来乍到');
						setCheckedIn(Boolean(freshUser.checked_in_today));
						setUser(freshUser);
						setCurrentUser(freshUser);
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
			const res = await apiFetch<{ items: Post[]; total: number }>('/posts?limit=30&offset=0');
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
		const titles = ['👑 创始站长', '🐉 传说之龙', '⭐ 论坛之星', '🌏 正式成员', '🌱 初来乍到'];
		const next = prompt('请选择或输入你想佩戴的称号：\n' + titles.join('、'), userTitle);
		if (next) {
			const trimmed = next.trim();
			setUserTitle(trimmed);
			if (user) {
				setUser({ ...user, title: trimmed } as any);
			}
		}
	}

	async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
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
				setNewContent(prev => prev + `\n\n![图片](${data.url})\n`);
				alert('图片上传成功！已自动插入到正文中');
			} else {
				alert('上传失败：' + (data.error || '未知错误'));
			}
		} catch (err: any) {
			alert('上传异常：' + err.message);
		} finally {
			setUploading(false);
		}
	}

	async function handleCreatePost(e: React.FormEvent) {
		e.preventDefault();
		if (!newTitle.trim() || !newContent.trim()) return;
		try {
			await apiFetch('/posts', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					title: newTitle,
					content: newContent,
					category_id: Number(newCategoryId) || 1
				})
			});
			setNewTitle('');
			setNewContent('');
			setShowEditor(false);
			loadPosts();
		} catch (err: any) {
			alert(err.message || '发布失败');
		}
	}

	const navPills = [
		{ id: 'all', name: '全部主题' },
		{ id: '1', name: '茶水间' },
		{ id: '2', name: '技术贴' },
		{ id: '3', name: '问与答' },
		{ id: 'ai', name: 'AI聊聊' },
		{ id: 'side', name: '副业来了' },
		{ id: 'domain', name: '域名交流' },
		{ id: 'welfare', name: '福利发放' },
		{ id: 'notice', name: '公告' }
	];

	const filteredPosts = posts.filter(p => {
		if (selectedCategory === 'all') return true;
		return String(p.category_id) === selectedCategory;
	});

	return (
		<PageShell>
			<div className="flex flex-wrap items-center gap-2 mb-4">
				{navPills.map(pill => (
					<button
						key={pill.id}
						onClick={() => setSelectedCategory(pill.id)}
						className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
							selectedCategory === pill.id
								? 'bg-[#21262d] text-white border border-[#30363d] shadow-sm'
								: 'text-gray-400 hover:text-gray-200 hover:bg-[#161b22]'
						}`}
					>
						{pill.name}
					</button>
				))}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
				<div className="lg:col-span-9 space-y-3">
					<div className="flex items-center justify-between border-b border-[#30363d] pb-2">
						<div className="flex items-center gap-4 text-xs font-semibold">
							<button
								onClick={() => setActiveTab('comment')}
								className={`pb-1 ${activeTab === 'comment' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}`}
							>
								新评论
							</button>
							<button
								onClick={() => setActiveTab('post')}
								className={`pb-1 ${activeTab === 'post' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}`}
							>
								新帖子
							</button>
						</div>
						{user && (
							<button
								onClick={() => setShowEditor(!showEditor)}
								className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium transition-colors"
							>
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
									className="bg-[#0d1117] border border-[#30363d] text-white text-xs rounded px-2 py-1"
								>
									{categories.map(c => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
								<Input
									placeholder="标题：请用一句话说清你的主题"
									value={newTitle}
									onChange={e => setNewTitle(e.target.value)}
									className="bg-[#0d1117] border-[#30363d] text-white text-sm"
								/>
							</div>

							<div className="relative">
								<textarea
									rows={5}
									placeholder="正文内容（支持 Markdown 语法，可以点击下方按钮上传图片）..."
									value={newContent}
									onChange={e => setNewContent(e.target.value)}
									className="w-full bg-[#0d1117] border border-[#30363d] text-white text-sm rounded-md p-2.5 outline-none focus:border-blue-500"
								/>
							</div>

							<div className="flex items-center justify-between pt-1">
								<div>
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImageUpload}
										accept="image/*"
										className="hidden"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => fileInputRef.current?.click()}
										disabled={uploading}
										className="border-[#30363d] text-gray-300 hover:text-white text-xs h-7"
									>
										<ImageIcon className="w-3.5 h-3.5 mr-1" />
										{uploading ? '上传中...' : '插入图片'}
									</Button>
								</div>

								<div className="flex gap-2">
									<Button type="button" variant="ghost" size="sm" onClick={() => setShowEditor(false)} className="text-xs text-gray-400">取消</Button>
									<Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">立即发布</Button>
								</div>
							</div>
						</form>
					)}

					{/* 核心权限锁：未登录游客禁止查看论坛内容！ */}
					{!user ? (
						<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center space-y-4 shadow-lg">
							<div className="w-14 h-14 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
								<Lock className="w-7 h-7" />
							</div>
							<div className="space-y-1.5">
								<h3 className="text-lg font-bold text-white">会员专属私密社区 · 仅限注册用户查看</h3>
								<p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
									为保护社区内部极客资源与深度交流内容，自由论坛仅对注册会员开放浏览。10 秒免费注册即可解锁全部板块并领取每日签到积分！
								</p>
							</div>
							<div className="flex items-center justify-center gap-3 pt-2">
								<Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6">
									<a href="/register">立即免费注册</a>
								</Button>
								<Button asChild variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800 px-6">
									<a href="/login">已有账号登录</a>
								</Button>
							</div>
						</div>
					) : (
						<div className="bg-[#161b22] border border-[#30363d] rounded-lg divide-y divide-[#21262d] overflow-hidden shadow-sm">
							{loading ? (
								<div className="p-8 text-center text-gray-500 text-sm">正在加载自由论坛内容...</div>
							) : filteredPosts.length === 0 ? (
								<div className="p-12 text-center text-gray-400 space-y-2">
									<Coffee className="w-8 h-8 mx-auto text-gray-500 stroke-1" />
									<p className="text-sm">暂无主题，快来发布自由论坛第一帖吧！</p>
								</div>
							) : (
								filteredPosts.map(post => (
									<div key={post.id} className="p-3.5 hover:bg-[#1c2128] transition-colors flex items-start gap-3 group">
										<div className="w-10 h-10 rounded-md bg-[#21262d] flex-shrink-0 flex items-center justify-center font-bold text-gray-300 overflow-hidden border border-[#30363d]">
											{post.author_avatar ? (
												<img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
											) : (
												<span className="text-xs text-blue-400">{(post.author_name || 'U').slice(0, 2).toUpperCase()}</span>
											)}
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 flex-wrap">
												{post.is_pinned === 1 && (
													<span className="bg-[#b35900] text-white text-[11px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
														置顶
													</span>
												)}
												<a
													href={`/post?id=${post.id}`}
													className={`text-[15px] font-medium leading-snug group-hover:text-blue-400 transition-colors ${
														post.is_pinned === 1 ? 'text-[#ff7b72] font-semibold' : 'text-gray-100'
													}`}
												>
													{post.title}
												</a>
												{post.is_pinned === 1 && (
													<span className="bg-[#bd561d]/30 text-[#f0883e] text-[10px] px-1 rounded font-bold">热</span>
												)}
											</div>

											<div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
												<span className="text-[11px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
													{post.author_title || '🌱 初来乍到'}
												</span>
												<span className="font-medium text-gray-300">{post.author_name || '会员'}</span>
												<span>•</span>
												<span>{formatDate(post.created_at)}</span>
												{post.category_name && (
													<>
														<span>•</span>
														<span className="bg-[#21262d] text-gray-300 px-1.5 py-0.5 rounded text-[11px] border border-[#30363d]">
															{post.category_name}
														</span>
													</>
												)}
											</div>
										</div>

										<div className="flex items-center gap-1 text-gray-400 group-hover:text-blue-400 bg-[#21262d] px-2 py-1 rounded-full text-xs font-semibold">
											<MessageSquare className="w-3.5 h-3.5" />
											<span>{post.comment_count || 0}</span>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>

				<div className="lg:col-span-3 space-y-4">
					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-sm text-sm">
						{user ? (
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
										{user.username.slice(0, 1).toUpperCase()}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<h4 className="font-bold text-white text-base leading-tight truncate">{user.username}</h4>
										</div>
										<button
											onClick={handleSwitchTitle}
											title="点击切换装备的称号"
											className="mt-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 hover:bg-blue-900/60 flex items-center gap-1 transition-colors"
										>
											<Trophy className="w-3 h-3 text-yellow-500" />
											{userTitle}
										</button>
									</div>
								</div>

								<div className="bg-[#0d1117] p-2.5 rounded-md border border-[#21262d] flex items-center justify-between">
									<div>
										<span className="text-[11px] text-gray-400 block">论坛积分</span>
										<span className="text-base font-bold text-yellow-400 flex items-center gap-1">
											<Sparkles className="w-3.5 h-3.5" />
											{points}
										</span>
									</div>
									<Button
										size="sm"
										onClick={handleCheckin}
										disabled={checkedIn}
										className={`text-xs h-7 px-3 font-semibold ${
											checkedIn
												? 'bg-gray-700 text-gray-400 cursor-not-allowed'
												: 'bg-emerald-600 hover:bg-emerald-700 text-white'
										}`}
									>
										<CalendarCheck className="w-3.5 h-3.5 mr-1" />
										{checkedIn ? '今日已签' : '每日签到'}
									</Button>
								</div>

								<div className="grid grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
									<a href="/settings" className="hover:text-blue-400">目 我的主题</a>
									<a href="/settings" className="hover:text-blue-400">💬 我的回帖</a>
									<a href="/settings" className="hover:text-blue-400">☆ 我的收藏</a>
									<a href="/settings" className="hover:text-blue-400">⚙️ 个人设置</a>
								</div>

								<Button
									onClick={() => setShowEditor(true)}
									className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 mt-2"
								>
									+ 发布新主题
								</Button>
							</div>
						) : (
							<div className="text-center py-2 space-y-3">
								<h4 className="font-bold text-white text-sm">自由论坛 - 私密极客社区</h4>
								<p className="text-xs text-gray-400">仅限注册会员访问。立即注册畅享资源、每日签到与发帖交流。</p>
								<div className="flex gap-2">
									<Button asChild size="sm" variant="outline" className="flex-1 text-xs border-gray-700">
										<a href="/login">登录</a>
									</Button>
									<Button asChild size="sm" className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
										<a href="/register">免费注册</a>
									</Button>
								</div>
							</div>
						)}
					</div>

					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3.5 shadow-sm text-xs space-y-2">
						<span className="font-bold text-gray-300 block mb-2">快捷功能</span>
						<div className="grid grid-cols-2 gap-y-2 text-gray-400">
							<span onClick={handleCheckin} className="hover:text-emerald-400 cursor-pointer text-emerald-500 font-medium">• 每日签到（领积分）</span>
							<span onClick={handleSwitchTitle} className="hover:text-blue-400 cursor-pointer">• 我的称号仓库</span>
							<span className="hover:text-white cursor-pointer">• 社区热榜</span>
							<span className="hover:text-white cursor-pointer">• 用户榜单</span>
							<span className="hover:text-white cursor-pointer">• 站点地图</span>
							<span className="hover:text-white cursor-pointer">• 精华列表</span>
						</div>
					</div>

					<div className="text-[11px] text-gray-400 px-1 leading-relaxed space-y-1">
						<p>© 2026 自由论坛 · 轻量极客生活社区</p>
						<p className="text-gray-300 font-medium">
							关注TG频道：
							<a href="https://t.me/eziyuan_1" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline mr-2">
								@eziyuan_1
							</a>
							TG群组：
							<a href="https://t.me/eziyuan_2" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
								@eziyuan_2
							</a>
						</p>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
