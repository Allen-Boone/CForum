import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, getSecurityHeaders, type Category } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Coins, RefreshCw, Shield, Users, Medal, X, Check, Sparkles, Pencil, Crown, ArrowUpDown, Gavel, Hammer, Plus, Trash2, FolderKanban, ChevronLeft, ChevronRight } from 'lucide-react';

interface SiteBadge {
	id: number;
	name: string;
	description: string;
	color: string;
}

export function AdminPage() {
	const token = getToken();
	const user = React.useMemo(() => getUser(), [token]);
	const [error, setError] = React.useState('');
	const [loading, setLoading] = React.useState(false);

	const [stats, setStats] = React.useState<{ users: number; posts: number; comments: number } | null>(null);
	const [users, setUsers] = React.useState<
		Array<{ id: number; email: string; username: string; role: string; verified: number; created_at: string; points?: number; title?: string; badges?: string }>
	>([]);

	// 动态板块分类与排序管理
	const [categories, setCategories] = React.useState<Array<Category & { sort_order?: number }>>([]);
	const [newCatName, setNewCatName] = React.useState('');

	// 勋章军械库
	const [badgeList, setBadgeList] = React.useState<SiteBadge[]>([]);
	const [forgeModalOpen, setForgeModalOpen] = React.useState(false);
	const [newBadgeName, setNewBadgeName] = React.useState('');
	const [newBadgeDesc, setNewBadgeDesc] = React.useState('');
	const [newBadgeColor, setNewBadgeColor] = React.useState('border-cyan-500 bg-cyan-500/10 text-cyan-300');

	const [sortOrder, setSortOrder] = React.useState<'desc' | 'asc'>('desc');

	// 单人授勋弹窗
	const [badgeModalOpen, setBadgeModalOpen] = React.useState(false);
	const [targetUser, setTargetUser] = React.useState<{ id: number; username: string } | null>(null);
	const [selectedBadges, setSelectedBadges] = React.useState<string[]>([]);
	const [customBadgeInput, setCustomBadgeInput] = React.useState('');

	// 全员一键授勋
	const [batchModalOpen, setBatchModalOpen] = React.useState(false);
	const [batchBadge, setBatchBadge] = React.useState('🥮 中秋月圆');
	const [batchScope, setBatchScope] = React.useState<'all' | 'top100'>('all');
	const [batchLoading, setBatchLoading] = React.useState(false);

	React.useEffect(() => {
		if (!token) window.location.href = '/login';
	}, [token]);

	const loadBadges = React.useCallback(async () => {
		try {
			const b = await apiFetch<SiteBadge[]>('/badges');
			if (b && b.length > 0) {
				setBadgeList(b);
				if (!b.some(item => item.name === batchBadge)) {
					setBatchBadge(b[0].name);
				}
			}
		} catch (_) {}
	}, [batchBadge]);

	const loadCategories = React.useCallback(async () => {
		try {
			const cats = await apiFetch<any[]>('/categories');
			if (cats) setCategories(cats);
		} catch (_) {}
	}, []);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [s, u] = await Promise.all([
				apiFetch<{ users: number; posts: number; comments: number }>('/admin/stats', {
					headers: getSecurityHeaders('GET')
				}),
				apiFetch<any[]>('/admin/users', {
					headers: getSecurityHeaders('GET')
				})
			]);
			setStats(s);
			setUsers(u || []);
			await Promise.all([loadBadges(), loadCategories()]);
		} catch (e: any) {
			setError(e.message || '加载后台数据失败');
		} finally {
			setLoading(false);
		}
	}, [loadBadges, loadCategories]);

	React.useEffect(() => {
		refresh();
	}, [refresh]);

	async function handleMoveOrder(index: number, direction: 'left' | 'right') {
		const targetIndex = direction === 'left' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= categories.length) return;

		const current = categories[index];
		const neighbor = categories[targetIndex];

		const currentOrder = current.sort_order ?? current.id;
		const neighborOrder = neighbor.sort_order ?? neighbor.id;

		const newCurrentOrder = neighborOrder;
		const newNeighborOrder = currentOrder === neighborOrder ? neighborOrder + 1 : currentOrder;

		try {
			await Promise.all([
				apiFetch(`/admin/categories/${current.id}/sort`, {
					method: 'POST',
					headers: getSecurityHeaders('POST'),
					body: JSON.stringify({ sort_order: newCurrentOrder })
				}),
				apiFetch(`/admin/categories/${neighbor.id}/sort`, {
					method: 'POST',
					headers: getSecurityHeaders('POST'),
					body: JSON.stringify({ sort_order: newNeighborOrder })
				})
			]);
			loadCategories();
		} catch (err: any) {
			alert('调整排序失败: ' + err.message);
		}
	}

	async function handleCustomSort(catId: number, catName: string, currentOrder: number) {
		const input = prompt(
			`【自定义板块排序编号】\n板块：《${catName}》\n当前排序编号：${currentOrder}\n\n请输入新的排序序号（数字越小越靠前，如输入 1 排在最前面）：`,
			String(currentOrder)
		);
		if (!input) return;
		const orderNum = parseInt(input.trim());
		if (isNaN(orderNum)) return alert('请输入有效的整数序号！');

		try {
			await apiFetch(`/admin/categories/${catId}/sort`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ sort_order: orderNum })
			});
			loadCategories();
		} catch (err: any) {
			alert('调整失败: ' + err.message);
		}
	}

	async function handleCreateCategory(e: React.FormEvent) {
		e.preventDefault();
		if (!newCatName.trim()) return alert('请输入板块名称！');
		try {
			await apiFetch('/admin/categories', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ name: newCatName.trim() })
			});
			setNewCatName('');
			alert('🎉 新板块创建成功！全站导航栏已实时同步！');
			loadCategories();
		} catch (err: any) {
			alert('创建失败: ' + err.message);
		}
	}

	async function handleRenameCategory(catId: number, oldName: string) {
		const next = prompt(`【修改板块名称】\n当前名称：${oldName}\n\n请输入新的板块名称：`, oldName);
		if (!next || next.trim() === oldName) return;
		try {
			await apiFetch(`/admin/categories/${catId}`, {
				method: 'PUT',
				headers: getSecurityHeaders('PUT'),
				body: JSON.stringify({ name: next.trim() })
			});
			alert('🎉 板块名称修改成功！');
			loadCategories();
		} catch (err: any) {
			alert('修改失败: ' + err.message);
		}
	}

	async function handleDeleteCategory(catId: number, catName: string) {
		if (catId === 9) return alert('【公告】板块为官方专区，不可删除！');
		if (!confirm(`确定要删除板块【${catName}】吗？\n（该板块下的帖子会自动安全移入【茶水间】）`)) return;
		try {
			await apiFetch(`/admin/categories/${catId}`, {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			alert('板块已删除！');
			loadCategories();
		} catch (err: any) {
			alert('删除失败: ' + err.message);
		}
	}

	async function handleForgeNewBadge(e: React.FormEvent) {
		e.preventDefault();
		if (!newBadgeName.trim()) return alert('请输入勋章名称与图标！');
		try {
			const res = await apiFetch<{ success: boolean; name: string }>('/admin/badges', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					name: newBadgeName.trim(),
					description: newBadgeDesc.trim() || '自由论坛专属稀缺特权荣誉',
					color: newBadgeColor
				})
			});
			if (res.success) {
				alert(`🎉 铸造成功！专属勋章【${res.name}】已永久收入自由论坛勋章军械库！`);
				setNewBadgeName('');
				setNewBadgeDesc('');
				setForgeModalOpen(false);
				loadBadges();
			}
		} catch (err: any) {
			alert('铸造失败: ' + err.message);
		}
	}

	async function handleDeleteBadge(badgeId: number, name: string) {
		if (!confirm(`确定要从军械库销毁勋章【${name}】吗？`)) return;
		try {
			await apiFetch(`/admin/badges/${badgeId}`, {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			loadBadges();
		} catch (err: any) {
			alert('删除失败: ' + err.message);
		}
	}

	async function handleBanishToBlackhouse(userId: number, username: string) {
		if (userId === 1) return alert('👑 站长主账号受系统保护，不可关押！');

		const menu = `【站长执法 · 关入社区小黑屋公示】\n目标违规用户：${username}\n\n请选择违规处分类型：\n1 = 冒充官方与客服欺诈（关押 30 天）\n2 = 恶意引战辱骂他人（关押 7 天）\n3 = 恶意广告与灌水刷屏（关押 3 天）\n4 = 严重破坏社区安全（永久封禁）\n\n请输入数字编号：`;
		const choice = prompt(menu, '1');
		if (choice === null) return;

		const banMap: Record<string, { reason: string; duration: string }> = {
			'1': { reason: '冒充官方机构与客服欺诈', duration: '30 天' },
			'2': { reason: '恶意引战、开盒与辱骂他人', duration: '7 天' },
			'3': { reason: '恶意灌水刷屏与引流广告', duration: '3 天' },
			'4': { reason: '严重危害社区安全秩序', duration: '永久封禁' }
		};

		const plan = banMap[choice.trim()];
		if (!plan) return alert('请输入 1 ~ 4 之间的有效数字！');

		try {
			const res = await apiFetch<{ success: boolean; username: string }>(`/admin/users/${userId}/banish`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify(plan)
			});
			if (res.success) {
				alert(`⚖️ 执法完成！已将违规用户【${res.username}】关入小黑屋！\n罪由：${plan.reason}\n刑期：${plan.duration}\n已自动同步全站小黑屋名单公示！`);
				refresh();
			}
		} catch (err: any) {
			alert('关押失败: ' + err.message);
		}
	}

	async function handleSetRole(userId: number, username: string, currentRole: string) {
		if (userId === 1) return alert('👑 站长主账号受系统保护，角色不可更改！');

		const menu = `【站长设置角色等级】\n正在为【${username}】授予角色：\n\n1 = 🛡️ 社区版主 (moderator)\n2 = 🔥 核心元老 (elder)\n3 = 💎 尊贵VIP (vip)\n4 = 💻 认证极客 (pro)\n5 = ⭐ 活跃会员 (active)\n6 = 🌱 普通会员 (user)\n7 = 🚫 封禁禁言 (banned)\n\n请输入数字编号：`;
		const choice = prompt(menu, '6');
		if (choice === null) return;

		const roleMap: Record<string, string> = {
			'1': 'moderator',
			'2': 'elder',
			'3': 'vip',
			'4': 'pro',
			'5': 'active',
			'6': 'user',
			'7': 'banned'
		};

		const newRole = roleMap[choice.trim()];
		if (!newRole) return alert('请输入 1 ~ 7 之间的有效编号！');

		try {
			const res = await apiFetch<{ success: boolean; role: string }>(`/admin/users/${userId}/role`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ role: newRole })
			});
			if (res.success) {
				alert(`🎉 角色等级设置成功！已将【${username}】身份更新！`);
				refresh();
			}
		} catch (err: any) {
			alert('设置角色失败: ' + err.message);
		}
	}

	async function handleRenameUser(userId: number, currentName: string) {
		const input = prompt(
			`【站长强制修改用户名】\n当前用户名：${currentName}\n\n请输入新的合规用户名：`,
			`坛友_${userId}`
		);
		if (!input) return;
		const newName = input.trim();
		if (!newName || newName === currentName) return;

		try {
			const res = await apiFetch<{ success: boolean; username: string }>(`/admin/users/${userId}/rename`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ username: newName })
			});
			if (res.success) {
				alert(`🎉 修改成功！原用户【${currentName}】已被更名为：【${res.username}】`);
				refresh();
			}
		} catch (err: any) {
			alert('改名失败: ' + err.message);
		}
	}

	async function handleAdjustPoints(userId: number, username: string, currentPoints: number) {
		const input = prompt(
			`【站长调分中心】\n用户：${username}\n当前积分：${currentPoints || 0}\n\n请输入要调整的积分数值：\n（输入正数如 100 为充值；输入负数如 -50 为扣除）`,
			'100'
		);
		if (!input) return;
		const amount = parseInt(input.trim());
		if (isNaN(amount) || amount === 0) {
			alert('请输入有效的非零整数！');
			return;
		}

		try {
			const res = await apiFetch<{ success: boolean; points: number }>(`/admin/users/${userId}/points`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ amount })
			});
			if (res.success) {
				alert(`🎉 调整成功！用户【${username}】最新积分：${res.points}`);
				refresh();
			}
		} catch (err: any) {
			alert('调整失败: ' + err.message);
		}
	}

	function openBadgeModal(userId: number, username: string, currentBadgesStr?: string) {
		let list: string[] = [];
		try {
			list = currentBadgesStr ? JSON.parse(currentBadgesStr) : [];
		} catch (_) {}
		setTargetUser({ id: userId, username });
		setSelectedBadges(list);
		setCustomBadgeInput('');
		setBadgeModalOpen(true);
	}

	function toggleBadge(name: string) {
		setSelectedBadges(prev =>
			prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name]
		);
	}

	function handleAddCustomBadge() {
		if (!customBadgeInput.trim()) return;
		const badge = customBadgeInput.trim();
		if (!selectedBadges.includes(badge)) {
			setSelectedBadges(prev => [...prev, badge]);
		}
		setCustomBadgeInput('');
	}

	async function saveBadges() {
		if (!targetUser) return;
		try {
			const res = await apiFetch<{ success: boolean; badges: string[] }>(`/admin/users/${targetUser.id}/badges`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ badges: selectedBadges })
			});
			if (res.success) {
				alert(`🎉 授勋成功！已为【${targetUser.username}】更新荣誉勋章！`);
				setBadgeModalOpen(false);
				refresh();
			}
		} catch (err: any) {
			alert('授勋失败: ' + err.message);
		}
	}

	async function handleExecuteBatchBadge() {
		if (!confirm(`确定要为【${batchScope === 'all' ? '全站所有注册会员' : '前 100 位创站元老'}】一键批量佩戴【${batchBadge}】勋章吗？`)) return;
		setBatchLoading(true);
		try {
			const res = await apiFetch<{ success: boolean; affected: number; badge: string }>('/admin/users/batch-badges', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					badge: batchBadge,
					scope: batchScope
				})
			});
			if (res.success) {
				alert(`👑 全员大授勋完成！已成功为 ${res.affected} 位会员一键佩戴【${res.badge}】专属荣誉！`);
				setBatchModalOpen(false);
				refresh();
			}
		} catch (err: any) {
			alert('批量授勋失败: ' + err.message);
		} finally {
			setBatchLoading(false);
		}
	}

	function parseUserBadges(badgesStr?: string): string[] {
		if (!badgesStr) return [];
		try {
			return JSON.parse(badgesStr);
		} catch (_) {
			return [];
		}
	}

	function renderRoleBadge(role: string) {
		switch (role) {
			case 'admin':
				return <span className="bg-amber-900/40 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">👑 站长管理员</span>;
			case 'moderator':
				return <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">🛡️ 社区版主</span>;
			case 'elder':
				return <span className="bg-orange-900/40 text-orange-300 border border-orange-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">🔥 核心元老</span>;
			case 'vip':
				return <span className="bg-yellow-900/40 text-yellow-300 border border-yellow-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">💎 尊贵VIP</span>;
			case 'pro':
				return <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">💻 认证极客</span>;
			case 'active':
				return <span className="bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">⭐ 活跃会员</span>;
			case 'banned':
				return <span className="bg-red-900/50 text-red-300 border border-red-700 px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap">⚖️ 小黑屋服刑</span>;
			default:
				return <span className="bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">🌱 普通会员</span>;
		}
	}

	const sortedUsers = React.useMemo(() => {
		const list = [...users];
		if (sortOrder === 'asc') {
			list.sort((a, b) => a.id - b.id);
		} else {
			list.sort((a, b) => b.id - a.id);
		}
		return list;
	}, [users, sortOrder]);

	return (
		<PageShell>
			<div className="space-y-6">
				<div className="flex items-center justify-between border-b border-[#30363d] pb-4 flex-wrap gap-3">
					<div>
						<h1 className="text-xl font-bold text-white flex items-center gap-2">
							<Shield className="w-5 h-5 text-blue-500" />
							自由论坛 · 管理控制台
						</h1>
						<p className="text-xs text-gray-400 mt-1">站点统计、板块管理、全站用户、勋章铸造、全员大授勋与快捷充值中心</p>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						<Button
							size="sm"
							onClick={() => setForgeModalOpen(true)}
							className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 px-3 shadow-md"
						>
							<Hammer className="w-3.5 h-3.5 mr-1" />
							🛠️ 铸造专属勋章
						</Button>

						<Button
							size="sm"
							onClick={() => setBatchModalOpen(true)}
							className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-black font-extrabold text-xs h-8 px-3 shadow-md"
						>
							<Sparkles className="w-3.5 h-3.5 mr-1" />
							👑 全员一键大授勋
						</Button>

						<Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="text-xs border-[#30363d] h-8">
							<RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> 刷新
						</Button>
					</div>
				</div>

				{error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 text-xs rounded">{error}</div>}

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">注册会员总数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.users ?? 0}</div>
						</CardContent>
					</Card>
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">全站主题帖数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.posts ?? 0}</div>
						</CardContent>
					</Card>
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">交流回帖总数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.comments ?? 0}</div>
						</CardContent>
					</Card>
				</div>

				{/* 社区板块分类与自由排序管理 */}
				<Card className="bg-[#161b22] border-[#30363d]">
					<CardHeader className="py-3 px-4 border-b border-[#30363d] flex flex-row items-center justify-between">
						<CardTitle className="text-sm text-white flex items-center gap-1.5">
							<FolderKanban className="w-4 h-4 text-emerald-400" />
							社区板块分类与自由排序管理（支持左右箭头一键调序、改名、删除）
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 space-y-4">
						<form onSubmit={handleCreateCategory} className="flex gap-2 max-w-md">
							<input
								type="text"
								placeholder="如：🛠️ 极客硬件、💰 掘金项目、📦 资源分享"
								value={newCatName}
								onChange={e => setNewCatName(e.target.value)}
								className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
							/>
							<Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4">
								<Plus className="w-3.5 h-3.5 mr-1" /> 添加板块
							</Button>
						</form>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
							{categories.map((c, idx) => (
								<div key={c.id} className="p-3 rounded-lg border border-[#30363d] bg-[#0d1117] flex items-center justify-between gap-2 text-xs">
									<div className="flex items-center gap-2 min-w-0">
										<button
											type="button"
											onClick={() => handleCustomSort(c.id, c.name, c.sort_order ?? c.id)}
											className="bg-[#161b22] hover:bg-[#21262d] text-gray-400 hover:text-amber-400 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-[#30363d] transition-colors"
											title="点击直接输入排序编号"
										>
											#{idx + 1}
										</button>
										<span className="font-bold text-gray-200 truncate">{c.name}</span>
									</div>

									<div className="flex items-center gap-1 flex-shrink-0">
										<button
											type="button"
											disabled={idx === 0}
											onClick={() => handleMoveOrder(idx, 'left')}
											className="text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none p-1 bg-[#161b22] rounded border border-[#30363d]"
											title="向前移动一位"
										>
											<ChevronLeft className="w-3.5 h-3.5" />
										</button>

										<button
											type="button"
											disabled={idx === categories.length - 1}
											onClick={() => handleMoveOrder(idx, 'right')}
											className="text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none p-1 bg-[#161b22] rounded border border-[#30363d]"
											title="向后移动一位"
										>
											<ChevronRight className="w-3.5 h-3.5" />
										</button>

										<button
											type="button"
											onClick={() => handleRenameCategory(c.id, c.name)}
											className="text-gray-400 hover:text-sky-400 p-1"
											title="修改名称"
										>
											<Pencil className="w-3.5 h-3.5" />
										</button>

										{c.id !== 9 && (
											<button
												type="button"
												onClick={() => handleDeleteCategory(c.id, c.name)}
												className="text-gray-400 hover:text-red-400 p-1"
												title="删除板块"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* 会员列表与管理操作（核心加固：采用 table-auto 与强制截断，杜绝任何超长字符串撑爆表格！） */}
				<Card className="bg-[#161b22] border-[#30363d]">
					<CardHeader className="py-3 px-4 border-b border-[#30363d] flex flex-row items-center justify-between">
						<CardTitle className="text-sm text-white flex items-center gap-1.5">
							<Users className="w-4 h-4 text-blue-400" />
							会员管理列表（共 {users.length} 位成员）
						</CardTitle>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
							className="text-xs text-sky-400 hover:text-sky-300 h-7 px-2"
						>
							<ArrowUpDown className="w-3.5 h-3.5 mr-1" />
							{sortOrder === 'desc' ? '当前：最新注册在前' : '当前：最早元老在前'}
						</Button>
					</CardHeader>
					<CardContent className="p-0 overflow-x-auto">
						<table className="w-full text-xs text-left text-gray-300 min-w-[700px]">
							<thead className="bg-[#0d1117] text-gray-400 border-b border-[#30363d]">
								<tr>
									<th className="py-2.5 px-4 w-16 text-center">序号</th>
									<th className="py-2.5 px-4 max-w-[180px]">用户名</th>
									<th className="py-2.5 px-4 max-w-[200px]">邮箱</th>
									<th className="py-2.5 px-4">称号与勋章</th>
									<th className="py-2.5 px-4 w-20">当前积分</th>
									<th className="py-2.5 px-4 w-28">角色等级身份</th>
									<th className="py-2.5 px-4 text-right">站长管理操作</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#21262d]">
								{sortedUsers.map((u, index) => {
									const userBadges = parseUserBadges(u.badges);
									const sequenceNumber = sortOrder === 'desc' ? users.length - index : index + 1;

									return (
										<tr key={u.id} className="hover:bg-[#1c2128]">
											<td className="py-3 px-4 text-center font-mono font-bold text-gray-400">
												#{sequenceNumber}
											</td>
											{/* 核心防护：设置最大宽度和强制截断，超过 15 个字符自动省略号，彻底杜绝撑破表格！ */}
											<td className="py-3 px-4 font-bold text-white max-w-[180px]">
												<span
													title={u.username}
													className={`block truncate max-w-[160px] ${u.username === '已注销用户' ? 'text-gray-500 italic' : ''}`}
												>
													{u.username}
												</span>
											</td>
											<td className="py-3 px-4 text-gray-400 font-mono max-w-[200px]">
												<span title={u.email} className="block truncate max-w-[180px]">
													{u.email}
												</span>
											</td>
											<td className="py-3 px-4 space-y-1.5">
												<div>
													<span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
														{u.title || '🌱 初来乍到'}
													</span>
												</div>
												{userBadges.length > 0 && (
													<div className="flex flex-wrap gap-1">
														{userBadges.map((b, bi) => (
															<span key={bi} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold whitespace-nowrap">
																{b}
															</span>
														))}
													</div>
												)}
											</td>
											<td className="py-3 px-4 font-bold text-yellow-400 whitespace-nowrap">
												✨ {u.points ?? 0}
											</td>
											<td className="py-3 px-4 whitespace-nowrap">
												<button
													type="button"
													onClick={() => handleSetRole(u.id, u.username, u.role)}
													title="点击可直接更改该用户的角色等级身份"
													className="hover:scale-105 transition-transform"
												>
													{renderRoleBadge(u.role)}
												</button>
											</td>
											<td className="py-3 px-4 text-right whitespace-nowrap">
												<div className="flex items-center justify-end gap-1.5 flex-nowrap">
													{u.id !== 1 && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleBanishToBlackhouse(u.id, u.username)}
															className="border-rose-500/50 text-rose-300 hover:bg-rose-500/20 text-xs h-6 px-2"
														>
															<Gavel className="w-3 h-3 mr-1" />
															关小黑屋
														</Button>
													)}

													{u.id !== 1 && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleSetRole(u.id, u.username, u.role)}
															className="border-purple-500/40 text-purple-300 hover:bg-purple-500/20 text-xs h-6 px-2"
														>
															<Crown className="w-3 h-3 mr-1" />
															设角色
														</Button>
													)}

													{u.role !== 'admin' && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleRenameUser(u.id, u.username)}
															className="border-sky-500/40 text-sky-300 hover:bg-sky-500/20 text-xs h-6 px-2"
														>
															<Pencil className="w-3 h-3 mr-1" />
															改名
														</Button>
													)}
													<Button
														size="sm"
														variant="outline"
														onClick={() => openBadgeModal(u.id, u.username, u.badges)}
														className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs h-6 px-2"
													>
														<Medal className="w-3 h-3 mr-1" />
														授勋
													</Button>
													<Button
														size="sm"
														onClick={() => handleAdjustPoints(u.id, u.username, u.points ?? 0)}
														className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-6 px-2"
													>
														<Coins className="w-3 h-3 mr-1" />
														调分
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</CardContent>
				</Card>
			</div>

			{/* 弹窗 A：勋章铸造军械库 */}
			{forgeModalOpen && (
				<div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-purple-500/50 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Hammer className="w-5 h-5 text-purple-400" />
								<h3 className="font-bold text-base text-purple-300">自由论坛 · 勋章铸造军械库</h3>
							</div>
							<button onClick={() => setForgeModalOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<form onSubmit={handleForgeNewBadge} className="bg-[#0d1117] p-4 rounded-xl border border-[#21262d] space-y-3">
							<span className="text-xs font-bold text-gray-200 block">铸造全新专属稀缺勋章：</span>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="text-[11px] text-gray-400 block mb-1">勋章名称（推荐带 Emoji 图标）：</label>
									<input
										type="text"
										placeholder="如：💻 认证极客、🔥 核心元老"
										value={newBadgeName}
										onChange={e => setNewBadgeName(e.target.value)}
										className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
										required
									/>
								</div>
								<div>
									<label className="text-[11px] text-gray-400 block mb-1">发光主题色彩：</label>
									<select
										value={newBadgeColor}
										onChange={e => setNewBadgeColor(e.target.value)}
										className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
									>
										<option value="border-cyan-500 bg-cyan-500/10 text-cyan-300">电光赛博蓝 (极客技术)</option>
										<option value="border-orange-500 bg-orange-500/10 text-orange-300">炽热琥珀橙 (元老专属)</option>
										<option value="border-purple-500 bg-purple-500/10 text-purple-300">高贵神秘紫 (特权贡献)</option>
										<option value="border-amber-500 bg-amber-500/10 text-amber-300">璀璨流光金 (创始人/先驱)</option>
										<option value="border-emerald-500 bg-emerald-500/10 text-emerald-300">生机翡翠绿 (活跃全勤)</option>
										<option value="border-rose-500 bg-rose-500/10 text-rose-300">炽烈朱砂红 (节日/荣誉)</option>
									</select>
								</div>
							</div>
							<div>
								<label className="text-[11px] text-gray-400 block mb-1">勋章描述与授予寓意：</label>
								<input
									type="text"
									placeholder="如：分享优质原创技术、精通架构与代码"
									value={newBadgeDesc}
									onChange={e => setNewBadgeDesc(e.target.value)}
									className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
								/>
							</div>
							<div className="flex justify-end pt-1">
								<Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-7 px-4">
									<Plus className="w-3.5 h-3.5 mr-1" /> 立即铸造成型
								</Button>
							</div>
						</form>

						<div>
							<span className="text-xs font-bold text-gray-400 block mb-2">当前军械库在册的全部勋章（{badgeList.length} 枚）：</span>
							<div className="max-h-48 overflow-y-auto space-y-2 pr-1">
								{badgeList.map(b => (
									<div key={b.id} className="p-2.5 rounded-lg border border-[#30363d] bg-[#0d1117] flex items-center justify-between gap-3 text-xs">
										<div className="flex items-center gap-2.5">
											<span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${b.color}`}>
												{b.name}
											</span>
											<span className="text-[11px] text-gray-400">{b.description}</span>
										</div>
										<button
											type="button"
											onClick={() => handleDeleteBadge(b.id, b.name)}
											className="text-gray-500 hover:text-red-400 p-1 transition-colors"
											title="从军械库销毁"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
							</div>
						</div>

						<div className="flex justify-end border-t border-[#30363d] pt-3">
							<Button size="sm" variant="ghost" onClick={() => setForgeModalOpen(false)} className="text-xs text-gray-400">
								完成并关闭
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* 弹窗 B：单人授勋面板 */}
			{badgeModalOpen && targetUser && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Medal className="w-5 h-5 text-amber-400" />
								<h3 className="font-bold text-sm">站长授勋中心 · 为【{targetUser.username}】颁发荣誉</h3>
							</div>
							<button onClick={() => setBadgeModalOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<div>
							<span className="text-xs text-gray-400 block mb-2 font-medium">点击勋章直接佩戴 / 摘下（实时同步军械库）：</span>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
								{badgeList.map((b, i) => {
									const isSelected = selectedBadges.includes(b.name);
									return (
										<div
											key={i}
											onClick={() => toggleBadge(b.name)}
											className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between select-none ${
												isSelected
													? `${b.color} border-2 shadow-md`
													: 'border-[#30363d] bg-[#0d1117]/60 hover:bg-[#0d1117] text-gray-400'
											}`}
										>
											<div>
												<span className="font-bold text-xs block text-white">{b.name}</span>
												<span className="text-[10px] text-gray-400 leading-tight block mt-0.5">{b.description}</span>
											</div>
											<div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-gray-600'}`}>
												{isSelected && <Check className="w-3 h-3 stroke-[3]" />}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className="space-y-1.5 pt-1 border-t border-[#21262d]">
							<span className="text-xs text-gray-400">临时手打新勋章：</span>
							<div className="flex gap-2">
								<input
									type="text"
									placeholder="如：🔥 活跃领袖、🚀 运维大佬"
									value={customBadgeInput}
									onChange={e => setCustomBadgeInput(e.target.value)}
									className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 text-white text-xs h-8 outline-none focus:border-blue-500"
								/>
								<Button type="button" size="sm" onClick={handleAddCustomBadge} className="bg-blue-600 hover:bg-blue-700 text-xs h-8 px-3">
									添加
								</Button>
							</div>
						</div>

						<div className="bg-[#0d1117] p-2.5 rounded-md border border-[#21262d]">
							<span className="text-[11px] text-gray-400 block mb-1.5">最终授予佩戴的勋章：</span>
							{selectedBadges.length === 0 ? (
								<span className="text-xs text-gray-500 italic">（未选择任何勋章，保存将收回该用户所有勋章）</span>
							) : (
								<div className="flex flex-wrap gap-1.5">
									{selectedBadges.map((b, i) => (
										<span key={i} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
											{b}
											<button type="button" onClick={() => toggleBadge(b)} className="text-amber-300/60 hover:text-red-400 ml-0.5">✕</button>
										</span>
									))}
								</div>
							)}
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
							<Button type="button" size="sm" variant="ghost" onClick={() => setBadgeModalOpen(false)} className="text-xs text-gray-400">
								取消
							</Button>
							<Button type="button" size="sm" onClick={saveBadges} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5">
								确认保存授勋
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* 弹窗 C：全员一键大授勋 */}
			{batchModalOpen && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-amber-500/40 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Sparkles className="w-5 h-5 text-amber-400" />
								<h3 className="font-bold text-sm text-amber-300">👑 全员一键大授勋 · 普天同庆</h3>
							</div>
							<button onClick={() => setBatchModalOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<span className="text-gray-400 block mb-1.5 font-medium">1. 选择批量授予的专属荣誉勋章：</span>
								<select
									value={batchBadge}
									onChange={e => setBatchBadge(e.target.value)}
									className="w-full bg-[#0d1117] border border-[#30363d] text-white rounded p-2 text-xs outline-none focus:border-amber-500 font-bold"
								>
									{badgeList.map((b, i) => (
										<option key={i} value={b.name}>{b.name}（{b.description}）</option>
									))}
								</select>
							</div>

							<div>
								<span className="text-gray-400 block mb-1.5 font-medium">2. 授勋受众范围：</span>
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => setBatchScope('all')}
										className={`p-2.5 rounded border text-xs font-bold transition-all ${
											batchScope === 'all'
												? 'border-amber-500 bg-amber-500/20 text-amber-300'
												: 'border-[#30363d] bg-[#0d1117] text-gray-400'
										}`}
									>
										🎉 全站所有注册会员
									</button>
									<button
										type="button"
										onClick={() => setBatchScope('top100')}
										className={`p-2.5 rounded border text-xs font-bold transition-all ${
											batchScope === 'top100'
												? 'border-amber-500 bg-amber-500/20 text-amber-300'
												: 'border-[#30363d] bg-[#0d1117] text-gray-400'
										}`}
									>
										🎖️ 前 100 位创站元老
									</button>
								</div>
							</div>

							<div className="bg-[#0d1117] p-3 rounded border border-amber-500/20 text-[11px] text-gray-400 leading-relaxed">
								💡 <strong>使用场景说明：</strong><br />
								• 遇上中秋/春节/五一等重大节日，直接选对应勋章，点一下全员集体佩戴！<br />
								• 系统会自动跳过已经佩戴过的用户，绝不重复添加，高效优雅！
							</div>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
							<Button type="button" size="sm" variant="ghost" onClick={() => setBatchModalOpen(false)} className="text-xs text-gray-400">
								取消
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={batchLoading}
								onClick={handleExecuteBatchBadge}
								className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-black font-extrabold text-xs px-5 shadow-lg"
							>
								{batchLoading ? '正在全员大授勋...' : '立即一键全员佩戴'}
							</Button>
						</div>
					</div>
				</div>
			)}
		</PageShell>
	);
}
