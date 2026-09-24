import * as React from 'react';
import { Button } from '@/components/ui/button';
import { getUser, logout, type User } from '@/lib/auth';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';
import { Moon, Settings, Shield, Sun, LogIn, UserPlus, LogOut, Search, PlusCircle } from 'lucide-react';

export function SiteHeader({
	currentUser,
	onLogout
}: {
	currentUser: User | null;
	onLogout?: () => void;
}) {
	const user = currentUser ?? getUser();
	const [theme, setTheme] = React.useState<Theme>(() => getTheme());

	React.useEffect(() => {
		function onThemeChange(e: Event) {
			const next = (e as CustomEvent).detail;
			if (next === 'light' || next === 'dark') setTheme(next);
		}
		window.addEventListener('theme-change', onThemeChange as any);
		setTheme(getTheme());
		return () => window.removeEventListener('theme-change', onThemeChange as any);
	}, []);

	return (
		<header className="w-full border-b border-[#22272e] bg-[#0d1117] text-white sticky top-0 z-50">
			{/* 第一行：主LOGO、快捷板块导航、全局搜索、用户状态 */}
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
				{/* LOGO 与 网站名 */}
				<div className="flex items-center gap-6">
					<a href="/" className="flex items-center gap-2 group">
						<div className="w-8 h-8 rounded-lg bg-[#003580] flex items-center justify-center p-1 shadow-sm">
							<svg viewBox="0 0 100 100" className="w-6 h-6 fill-white">
								<path d="M50 42 C40 22 28 16 12 18 C20 32 30 40 45 46 Z"/>
								<path d="M50 42 C60 22 72 16 88 18 C80 32 70 40 55 46 Z"/>
								<path d="M30 44 C20 44 20 62 38 72 C42 74 44 78 44 82 C46 78 52 74 60 70 C78 60 80 44 68 44 C64 44 62 48 60 52 C56 50 44 50 40 52 C38 48 36 44 30 44 Z"/>
								<circle cx="50" cy="58" r="6"/>
							</svg>
						</div>
						<div className="flex flex-col">
							<span className="text-lg font-black tracking-wider text-white group-hover:text-blue-400 transition-colors">自由论坛</span>
						</div>
					</a>

					{/* 仿 lao1 顶栏快捷横向链接 */}
					<nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-gray-300">
						<a href="/?cat=all" className="hover:text-white transition-colors">全部</a>
						<a href="/?cat=ai" className="hover:text-white transition-colors">AI聊聊</a>
						<a href="/?cat=chat" className="hover:text-white transition-colors">茶水间</a>
						<a href="/?cat=qa" className="hover:text-white transition-colors">问与答</a>
						<a href="/?cat=tech" className="hover:text-white transition-colors">技术贴</a>
						<a href="/?cat=side" className="hover:text-white transition-colors">副业来了</a>
						<a href="/?cat=domain" className="hover:text-white transition-colors">域名交流</a>
						<a href="/?cat=welfare" className="hover:text-white transition-colors">福利发放</a>
						<a href="/?cat=webmaster" className="hover:text-white transition-colors">站长交流</a>
					</nav>
				</div>

				{/* 右侧搜索与用户区域 */}
				<div className="flex items-center gap-3">
					<Button type="button" variant="ghost" size="sm" onClick={toggleTheme} className="text-gray-400 hover:text-white">
						{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
					</Button>

					{user ? (
						<div className="flex items-center gap-3">
							{user.role === 'admin' && (
								<Button asChild variant="outline" size="sm" className="border-blue-600 text-blue-400 hover:bg-blue-600/20 h-7 text-xs">
									<a href="/admin">
										<Shield className="h-3.5 w-3.5 mr-1" />
										管理后台
									</a>
								</Button>
							)}
							<div className="flex items-center gap-2 bg-[#161b22] px-2.5 py-1 rounded-full border border-gray-700">
								<span className="text-xs font-semibold text-gray-200">{user.username}</span>
							</div>
							<Button asChild variant="ghost" size="sm" className="text-gray-400 hover:text-white p-1">
								<a href="/settings"><Settings className="h-4 w-4" /></a>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="text-gray-400 hover:text-red-400 p-1"
								onClick={() => {
									logout();
									onLogout?.();
									window.location.href = '/';
								}}
							>
								<LogOut className="h-4 w-4" />
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Button asChild variant="ghost" size="sm" className="text-gray-300 hover:text-white">
								<a href="/login"><LogIn className="h-4 w-4 mr-1" /> 登录</a>
							</Button>
							<Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
								<a href="/register"><UserPlus className="h-4 w-4 mr-1" /> 注册</a>
							</Button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
