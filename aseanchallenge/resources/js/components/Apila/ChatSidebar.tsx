import { PlusCircle, MessageSquare, History, Settings } from 'lucide-react';
import React from 'react';

interface ChatSidebarProps {
    onNewChat: () => void;
}

/**
 * Komponen Bilah Sisi (Sidebar) yang berisi riwayat obrolan dan tautan pengaturan.
 */
export default function ChatSidebar({ onNewChat }: ChatSidebarProps) {
    return (
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col hidden md:flex">
            {/* Tombol Aksi Utama (Header) */}
            <div className="p-4">
                <button 
                    onClick={onNewChat}
                    className="w-full h-11 flex items-center gap-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none transition-all duration-200 font-medium text-sm"
                >
                    <PlusCircle className="w-4 h-4" />
                    Baru (New Chat)
                </button>
            </div>

            {/* Daftar Riwayat Obrolan */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
                
                {/* Bagian: Hari Ini */}
                <div>
                    <h3 className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Hari Ini</h3>
                    <ul className="space-y-1">
                        <li>
                            <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                <MessageSquare className="w-4 h-4 text-slate-400" />
                                <span className="truncate">Hak Waris Anak Angkat</span>
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Bagian: Kemarin */}
                <div>
                    <h3 className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Kemarin</h3>
                    <ul className="space-y-1">
                        <li>
                            <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="truncate">Syarat Mendirikan PT</span>
                            </button>
                        </li>
                        <li>
                            <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="truncate">Hukum PHK Sepihak</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Bagian Pengaturan di Bawah */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    <Settings className="w-4 h-4" />
                    Pengaturan
                </button>
            </div>
        </aside>
    );
}
