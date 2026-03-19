import { Head } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import ChatWindow from '@/components/Apila/ChatWindow';

export interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    sources?: Array<{ title: string; snippet: string }>;
}

interface ChatHistory {
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: string;
}

/**
 * APILA - AI Hukum Indonesia
 * Responsive ChatGPT-like interface
 */
export default function Index() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [language, setLanguage] = useState<'id' | 'en'>('id');

    // Load settings from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('apila_theme') as 'dark' | 'light' | null;
        const savedVoice = localStorage.getItem('apila_voice');
        const savedLang = localStorage.getItem('apila_language');

        if (savedTheme) {
setTheme(savedTheme);
}

        if (savedVoice !== null) {
setVoiceEnabled(savedVoice === 'true');
}

        if (savedLang) {
setLanguage(savedLang as 'id' | 'en');
}
    }, []);

    // Save settings
    const saveSettings = (newTheme: 'dark' | 'light', newVoice: boolean, newLang: 'id' | 'en') => {
        setTheme(newTheme);
        setVoiceEnabled(newVoice);
        setLanguage(newLang);
        localStorage.setItem('apila_theme', newTheme);
        localStorage.setItem('apila_voice', String(newVoice));
        localStorage.setItem('apila_language', newLang);
    };

    /**
     * Handle sending message to AI
     */
    const handleSendMessage = async (content: string, file?: File | null) => {
        if (!content && !file) {
            return;
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: content || (file ? `[Dokumen Diunggah: ${file.name}]` : ""),
        };

        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('message', content);

            if (file) {
                formData.append('file', file);
            }

            const res = await fetch('/apila/chat', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: formData,
            });

            if (res.ok) {
                const json = await res.json();

                if (json.status === 'success') {
                    const aiMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'ai',
                        content: json.data.content,
                        sources: json.data.sources
                    };
                    setMessages((prev) => [...prev, aiMsg]);
                }
            } else {
                throw new Error('Gagal mendapatkan respon dari AI');
            }
        } catch (error) {
            console.error("Error:", error);
            setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: "Maaf, terjadi kesalahan saat menghubungi server HukumAI. Silakan coba beberapa saat lagi."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Start new chat
     */
    const handleNewChat = () => {
        if (messages.length > 0) {
            const newChat: ChatHistory = {
                id: Date.now().toString(),
                title: messages[0]?.content.slice(0, 30) + '...',
                messages: [...messages],
                created_at: new Date().toISOString()
            };
            setChatHistory(prev => [newChat, ...prev].slice(0, 10)); // Keep last 10 chats
        }

        setMessages([]);
    };

    /**
     * Load previous chat
     */
    const loadChat = (chat: ChatHistory) => {
        setMessages(chat.messages);
        setShowSidebar(false);
    };

    return (
        <>
            <Head title="APILA - AI Asisten Hukum Indonesia" />

            <div className={`flex h-screen w-full ${theme === 'dark' ? 'bg-[#0d0d0d]' : 'bg-gray-100'} text-white overflow-hidden font-sans`}>
                {/* Sidebar - Mobile */}
                {showSidebar && (
                    <div
                        className="fixed inset-0 z-40 lg:hidden"
                        onClick={() => setShowSidebar(false)}
                    >
                        <div className="absolute inset-0 bg-black/50" />
                    </div>
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed lg:static inset-y-0 left-0 z-50 
                    w-64 ${theme === 'dark' ? 'bg-[#171717]' : 'bg-white'}
                    border-r ${theme === 'dark' ? 'border-[#2d2d2d]' : 'border-gray-200'}
                    transform transition-transform duration-200 ease-in-out
                    ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    flex flex-col
                `}>
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-[#2d2d2d]">
                        <button
                            onClick={handleNewChat}
                            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-colors
                                ${theme === 'dark'
                                    ? 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white'
                                    : 'bg-gray-800 hover:bg-gray-900 text-white'
                                }`}
                        >
                            + Chat Baru
                        </button>
                    </div>

                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <p className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                            Riwayat Chat
                        </p>
                        {chatHistory.length === 0 ? (
                            <p className={`px-3 py-2 text-sm ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                                Belum ada chat
                            </p>
                        ) : (
                            chatHistory.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => loadChat(chat)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors
                                        ${theme === 'dark'
                                            ? 'text-gray-400 hover:bg-[#2d2d2d] hover:text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {chat.title}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    <div className={`p-4 border-t ${theme === 'dark' ? 'border-[#2d2d2d]' : 'border-gray-200'}`}>
                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors
                                ${theme === 'dark'
                                    ? 'text-gray-400 hover:bg-[#2d2d2d]'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Pengaturan
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className={`
                        h-14 flex items-center justify-between px-4 shrink-0 
                        ${theme === 'dark' ? 'bg-[#0d0d0d] border-[#2d2d2d]' : 'bg-white border-gray-200'}
                        border-b
                    `}>
                        <div className="flex items-center gap-3">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="lg:hidden p-2"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>

                            {/* Logo */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                    </svg>
                                </div>
                                <div className="hidden sm:block">
                                    <h1 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        APILA
                                    </h1>
                                    <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                        AI Asisten Hukum Indonesia
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Settings Button */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`p-2 rounded-lg transition-colors
                                ${theme === 'dark'
                                    ? 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </header>

                    {/* Chat Window */}
                    <ChatWindow
                        messages={messages}
                        isLoading={isLoading}
                        onSendMessage={handleSendMessage}
                        onClearChat={handleNewChat}
                    />
                </main>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/50"
                            onClick={() => setShowSettings(false)}
                        />
                        <div className={`
                            relative w-full max-w-md p-6 rounded-2xl shadow-xl
                            ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}
                        `}>
                            <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                Pengaturan
                            </h2>

                            {/* Theme */}
                            <div className="mb-6">
                                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Tema
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => saveSettings('dark', voiceEnabled, language)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors
                                            ${theme === 'dark'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}
                                    >
                                        🌙 Gelap
                                    </button>
                                    <button
                                        onClick={() => saveSettings('light', voiceEnabled, language)}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors
                                            ${theme === 'light'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}
                                    >
                                        ☀️ Terang
                                    </button>
                                </div>
                            </div>

                            {/* Voice */}
                            <div className="mb-6">
                                <label className={`flex items-center justify-between cursor-pointer`}>
                                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Suara (Text-to-Speech)
                                    </span>
                                    <button
                                        onClick={() => saveSettings(theme, !voiceEnabled, language)}
                                        className={`relative w-12 h-6 rounded-full transition-colors
                                            ${voiceEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                                            ${voiceEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </label>
                            </div>

                            {/* Language */}
                            <div className="mb-6">
                                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Bahasa
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => saveSettings(theme, voiceEnabled, 'id')}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors
                                            ${language === 'id'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}
                                    >
                                        🇮🇩 Indonesia
                                    </button>
                                    <button
                                        onClick={() => saveSettings(theme, voiceEnabled, 'en')}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors
                                            ${language === 'en'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}
                                    >
                                        🇬🇧 English
                                    </button>
                                </div>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
