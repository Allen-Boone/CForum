import * as React from 'react';
import { MessageSquare, Pin, Flame, Eye, Search, Plus, User as UserIcon, Award, Shield, Sparkles, Coffee, Code, HelpCircle } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, formatDate, type Category, type Post } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';

export function IndexPage() {
	const token = getToken();
	const user = React.useMemo(() => getUser(), [token]);
	const [categories, setCategories] = React.useState<Category[]>([]);
	const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
	const [posts, setPosts] = React.useState<Post[]>([]);
	const [loading, setLoading] = React.useState<boolean>(true);
	const [activeTab, setActiveTab] = React.useState<'comment' | 'post'>('comment');
	const [showEditor, setShowEditor] = React.useState<boolean>(false);
	const [newTitle, setNewTitle] = React.useState('');
	const [newContent, setNewContent] = React.useState('');
	const [newCategoryId, setNewCategoryId] = React.useState<string>('1');

	// 获取分类与帖子
	React.useEffect(() => {
		async function init() {
			try {
				const cats = await apiFetch<Category[]>('/categories');
				setCategories(cats || []);
			} catch (_) {}
			loadPosts();
		}
		init();
	}, []);

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

	async function handleCreatePost(e: React.FormEvent) {
		e.preventDefault();
		if (!newTitle.trim() || !newContent.trim()) return;
		try {
			await apiFetch('/posts', {
				method: 'POST',
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

	// 经典导航胶囊
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
			{/* 第二级胶囊分类栏（仿 lao1 核心样式） */}
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

			{/* 左右双栏结构 */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
				{/* 左侧帖子主体列表（占 9 格） */}
				<div className="lg:col-span-9 space-y-3">
					{/* 筛选小标签栏 */}
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

					{/* 展开的极简发帖面板 */}
					{showEditor && (
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
							<textarea
								rows={4}
								placeholder="正文内容（支持 Markdown 语法）..."
								value={newContent}
								onChange={e => setNewContent(e.target.value)}
								className="w-full bg-[#0d1117] border border-[#30363d] text-white text-sm rounded-md p-2.5 outline-none focus:border-blue-500"
							/>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="ghost" size="sm" onClick={() => setShowEditor(false)} className="text-xs text-gray-400">取消</Button>
								<Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">立即发布</Button>
							</div>
						</form>
					)}

					{/* 帖子列表容器 */}
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
									{/* 头像 */}
									<div className="w-10 h-10 rounded-md bg-[#21262d] flex-shrink-0 flex items-center justify-center font-bold text-gray-300 overflow-hidden border border-[#30363d]">
										{post.author_avatar ? (
											<img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
										) : (
											<span className="text-xs text-blue-400">{(post.author_name || 'U').slice(0, 2).toUpperCase()}</span>
										)}
									</div>

									{/* 标题与元数据 */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5 flex-wrap">
											{/* 置顶标 */}
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

										<div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
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

									{/* 回复气泡数 */}
									<div className="flex items-center gap-1 text-gray-400 group-hover:text-blue-400 bg-[#21262d] px-2 py-1 rounded-full text-xs font-semibold">
										<MessageSquare className="w-3.5 h-3.5" />
										<span>{post.comment_count || 0}</span>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				{/* 右侧侧边栏（占 3 格，仿 lao1 用户面板） */}
				<div className="lg:col-span-3 space-y-4">
					{/* 用户卡片 */}
					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-sm text-sm">
						{user ? (
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
										{user.username.slice(0, 1).toUpperCase()}
									</div>
									<div>
										<h4 className="font-bold text-white text-base leading-tight">{user.username}</h4>
										<p className="text-xs text-gray-400 mt-0.5">Lv1 • 自由论坛成员</p>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 text-xs text-gray-300 pt-2 border-t border-[#21262d]">
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
								<h4 className="font-bold text-white text-sm">自由论坛 - 自由极客社区</h4>
								<p className="text-xs text-gray-400">登录后畅享发帖、点赞与深度技术交流。</p>
								<div className="flex gap-2">
									<Button asChild size="sm" variant="outline" className="flex-1 text-xs border-gray-700">
										<a href="/login">登录</a>
									</Button>
									<Button asChild size="sm" className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
										<a href="/register">注册</a>
									</Button>
								</div>
							</div>
						)}
					</div>

					{/* 快捷功能清单 */}
					<div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3.5 shadow-sm text-xs space-y-2">
						<span className="font-bold text-gray-300 block mb-2">快捷功能</span>
						<div className="grid grid-cols-2 gap-y-2 text-gray-400">
							<span className="hover:text-white cursor-pointer">• 社区热榜</span>
							<span className="hover:text-white cursor-pointer">• 每日签到</span>
							<span className="hover:text-white cursor-pointer">• 用户榜单</span>
							<span className="hover:text-white cursor-pointer">• 站点地图</span>
							<span className="hover:text-white cursor-pointer">• 今日热点</span>
							<span className="hover:text-white cursor-pointer">• 精华列表</span>
						</div>
					</div>

					{/* 底部版权信息 */}
					<div className="text-[11px] text-gray-500 px-1 leading-relaxed">
						<p>© 2026 自由论坛 · 轻量极客生活社区</p>
						<p className="mt-1">Powered by Cloudflare Pages & D1 Edge</p>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
