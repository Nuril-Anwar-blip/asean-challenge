import { Send, Paperclip, FileText, Loader2, Bot, User, X, Camera, Image, Mic, MicOff, Volume2, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/pages/Apila/Index';

// Function to strip markdown asterisks, hashtags and emojis
function sanitizeText(text: string): string {
    if (!text) return '';
    // Strip markdown formatting like **, *, #
    let clean = text.replace(/[*#]/g, '');
    // Strip emojis using RegExp constructor to avoid TS static analysis errors on unicode escapes
    const emojiRegex = new RegExp('[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{1F700}-\\u{1F77F}\\u{1F780}-\\u{1F7FF}\\u{1F800}-\\u{1F8FF}\\u{1F900}-\\u{1F9FF}\\u{1FA00}-\\u{1FA6F}\\u{1FA70}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]', 'gu');
    clean = clean.replace(emojiRegex, '');
    return clean;
}

// Structured content parser for terminal-like display
function FormattedChatContent({ content }: { content: string }) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    // Parse content into sections
    const sections = parseContent(content);

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (sections.length === 0 || (sections.length === 1 && sections[0].title === 'Jawaban')) {
        // Render as beautiful paragraphs, split by double newline to keep lists intact
        const singleContent = sections.length === 1 ? sections[0].content : content;
        const paragraphs = singleContent.split(/\n\s*\n/).filter(p => p.trim() !== '');
        
        return (
            <div className="text-sm leading-relaxed text-gray-200 space-y-4">
                {paragraphs.map((paragraph, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                        {paragraph}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sections.map((section, idx) => {
                const sectionKey = `${idx}-${section.title}`;
                const isExpanded = expandedSections[sectionKey] !== false;

                // Clean up title - remove dashes
                const cleanTitle = section.title.replace(/^-+|-+$/g, '').trim();
                const displayTitle = cleanTitle.replace(/^PENJELASAN$/i, 'PENJELASAN')
                    .replace(/^DASAR HUKUM$/i, 'DASAR HUKUM')
                    .replace(/^ARTI BAGI SITUASI ANDA$/i, 'ARTI BAGI SITUASI ANDA')
                    .replace(/^SUDUT PANDANG ASISTEN$/i, 'SUDUT PANDANG ASISTEN')
                    .replace(/^SARAN PRAKTIS$/i, 'SARAN PRAKTIS')
                    .replace(/^DISCLAIMER$/i, 'DISCLAIMER');

                // Style based on section type
                const getSectionStyle = (title: string): string => {
                    const t = title.toUpperCase();

                    if (t.includes('PENJELASAN')) {

                        return 'border-l-blue-500 bg-blue-500/5';
                    }

                    if (t.includes('DASAR HUKUM')) {

                        return 'border-l-green-500 bg-green-500/5';
                    }

                    if (t.includes('ARTI BAGI')) {

                        return 'border-l-purple-500 bg-purple-500/5';
                    }

                    if (t.includes('SUDUT PANDANG')) {

                        return 'border-l-orange-500 bg-orange-500/5';
                    }

                    if (t.includes('SARAN')) {

                        return 'border-l-indigo-500 bg-indigo-500/5';
                    }

                    if (t.includes('DISCLAIMER')) {

                        return 'border-l-red-500 bg-red-500/5';
                    }


                    return 'border-l-gray-500 bg-gray-500/5';
                };

                return (
                    <div key={idx} className={`border-l-4 rounded-r-lg overflow-hidden mb-4 ${getSectionStyle(displayTitle)}`}>
                        <button
                            onClick={() => toggleSection(sectionKey)}
                            className="flex items-center justify-between w-full text-left px-4 py-3 bg-[#151515]/80 hover:bg-[#1a1a1a]/80 transition-colors"
                        >
                            <span className="font-bold text-white text-sm tracking-wide">
                                {displayTitle}
                            </span>
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                        </button>

                        {isExpanded && (
                            <div className="px-4 py-4 text-gray-200 whitespace-pre-wrap text-sm leading-relaxed bg-[#0a0a0a]/60">
                                {section.content.split(/\n\s*\n/).filter(p => p.trim() !== '').map((para, i) => (
                                    <div key={i} className="mb-3 last:mb-0 whitespace-pre-wrap">{para}</div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function parseContent(content: string): { title: string; content: string }[] {
    const sections: { title: string; content: string }[] = [];

    // Split by common section markers
    const lines = content.split('\n');
    let currentTitle = 'Jawaban';
    let currentContent: string[] = [];

    const sectionKeywords = [
        'Penjelasan singkat',
        'Dasar hukum',
        'Artinya bagi situasi Anda',
        'Saran praktis',
        'Disclaimer'
    ];

    for (const line of lines) {
        const trimmedLine = line.trim();
        const isSectionHeader = sectionKeywords.some(kw =>
            trimmedLine.toLowerCase().includes(kw.toLowerCase())
        ) && trimmedLine.endsWith(':');

        if (isSectionHeader && currentContent.length > 0) {
            sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
            currentTitle = trimmedLine.replace(/:\s*$/, '').trim();
            currentContent = [];
        } else if (isSectionHeader) {
            currentTitle = trimmedLine.replace(/:\s*$/, '').trim();
        } else {
            currentContent.push(trimmedLine);
        }
    }

    if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
    }

    // If no clear sections found, return as single section
    if (sections.length === 0 || (sections.length === 1 && sections[0].title === 'Jawaban')) {
        return [{ title: 'Jawaban', content: sanitizeText(content) }];
    }

    // Sanitize sections content
    return sections.map(sec => ({
        title: sanitizeText(sec.title),
        content: sanitizeText(sec.content)
    }));
}

interface ChatWindowProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (msg: string, file: File | null) => void;
    onClearChat?: () => void;
}

/**
 * Enhanced ChatGPT-like Chat Window with Camera, File Upload, and Voice
 */
export default function ChatWindow({ messages, isLoading, onSendMessage, onClearChat }: ChatWindowProps) {
    const [input, setInput] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    // Text-to-Speech for AI responses
    const speakResponse = (text: string) => {
        if (!text || text.trim() === '') {
            return;
        }

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 1;
            utterance.pitch = 1;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        }
    };

    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        setIsSpeaking(false);
    };

    // Voice Recognition (Speech-to-Text)
    const startVoiceRecognition = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            recognition.lang = 'id-ID';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setIsRecording(true);
            recognition.onend = () => setIsRecording(false);
            recognition.onerror = () => setIsRecording(false);

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev + (prev ? ' ' : '') + transcript);
            };

            recognition.start();
        } else {
            alert('Voice recognition tidak didukung di browser ini');
        }
    };

    // Camera functions
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            if (cameraVideoRef.current) {
                cameraVideoRef.current.srcObject = stream;
                setShowCamera(true);
            }
        } catch (err) {
            console.error('Gagal mengakses kamera:', err);
            alert('Tidak dapat mengakses kamera');
        }
    };

    const stopCamera = () => {
        if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
            const stream = cameraVideoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            setShowCamera(false);
        }
    };

    const capturePhoto = () => {
        if (cameraVideoRef.current && canvasRef.current) {
            const video = cameraVideoRef.current;
            const canvas = canvasRef.current;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setSelectedFile(file);
                    stopCamera();
                }
            }, 'image/jpeg');
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _handleClearChat = () => {
        if (onClearChat) {
            onClearChat();
        }
    };

    // Handle speak button click - toggle speaking
    const handleSpeakClick = (text: string) => {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            speakResponse(text);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!input.trim() && !selectedFile) {
            return;
        }

        onSendMessage(input, selectedFile);
        setInput("");
        setSelectedFile(null);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            if (input.trim() || selectedFile) {
                handleSubmit(e);
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Camera View */}
            {showCamera && (
                <div className="absolute inset-0 z-50 bg-black flex flex-col">
                    <video
                        ref={cameraVideoRef}
                        autoPlay
                        playsInline
                        className="flex-1 object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-4">
                        <button
                            onClick={capturePhoto}
                            className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-800" />
                        </button>
                    </div>
                    <button
                        onClick={stopCamera}
                        className="absolute top-4 right-4 p-2 bg-gray-800/50 rounded-full text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/25">
                            <Bot className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-2">
                            Bagaimana saya bisa membantu?
                        </h2>
                        <p className="text-gray-500 max-w-md text-sm">
                            Tanyakan tentang hukum Indonesia, upload dokumen kontrak (PDF/Word), atau foto dokumen untuk analisis ML.
                        </p>

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                            <button
                                onClick={() => setInput("Bagaimana prosedur pembagian harta gono-gini saat bercerai?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Prosedur perceraian & gono-gini</p>
                            </button>
                            <button
                                onClick={() => setInput("Apa perlindungan hukum dan kemudahan izin untuk pelaku UMKM?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Perlindungan hukum UMKM</p>
                            </button>
                            <button
                                onClick={() => setInput("Bagaimana cara mengecek keaslian sertifikat SHM tanah?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Pengecekan sertifikat tanah</p>
                            </button>
                            <button
                                onClick={() => setInput("Apa bukti yang harus disiapkan untuk melaporkan kasus penipuan pidana?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Laporan pidana penipuan</p>
                            </button>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'ai'
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                : 'bg-[#2d2d2d]'
                                }`}>
                                {msg.role === 'ai' ? (
                                    <Bot className="w-5 h-5 text-white" />
                                ) : (
                                    <User className="w-5 h-5 text-gray-400" />
                                )}
                            </div>

                            <div className={`space-y-2 ${msg.role === 'user' ? 'max-w-[80%]' : 'max-w-full'}`}>
                                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-[#1a1a1a] text-white rounded-tr-sm border border-[#2d2d2d]'
                                    : 'text-gray-100 bg-[#0d0d0d] border border-[#2d2d2d]'
                                    }`}>
                                    {msg.role === 'ai' ? (
                                        <FormattedChatContent content={sanitizeText(msg.content)} />
                                    ) : (
                                        msg.content
                                    )}
                                </div>

                                {/* Action buttons for AI messages */}
                                {msg.role === 'ai' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSpeakClick(msg.content)}
                                            className={`p-1.5 rounded-lg transition-colors ${isSpeaking ? 'text-red-500' : 'text-gray-500 hover:text-white hover:bg-[#2d2d2d]'}`}
                                            title={isSpeaking ? 'Berhenti' : 'Baca jawaban'}
                                        >
                                            <Volume2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(msg.content)}
                                            className="p-1.5 text-gray-500 hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-colors"
                                            title="Salin"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                )}

                                {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-4 p-4 rounded-xl border border-[#2ea44f]/30 bg-[#2ea44f]/5 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#2ea44f]"></div>
                                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                            <div className="bg-[#2ea44f]/20 p-1 rounded">
                                                <FileText className="w-4 h-4 text-[#2ea44f]" />
                                            </div>
                                            Sumber Hukum Valid
                                        </h4>
                                        <div className="space-y-3">
                                            {msg.sources.map((src, idx) => (
                                                <div key={idx} className="text-sm p-3 rounded-lg bg-[#111111] border border-[#333333] hover:border-[#2ea44f]/50 transition-colors">
                                                    <span className="font-semibold text-[#2ea44f] block mb-1 text-[15px]">{sanitizeText(src.title)}</span>
                                                    <span className="text-gray-300 leading-relaxed block">{sanitizeText(src.snippet)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {isLoading && (
                    <div className="flex gap-4 max-w-3xl mx-auto">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                        <div className="p-4">
                            <div className="flex space-x-2 items-center h-5">
                                <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" />
                                <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce delay-100" />
                                <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 pb-6">
                <div className="max-w-3xl mx-auto">
                    {selectedFile && (
                        <div className="mb-3 flex items-center gap-2 bg-[#1a1a1a] text-gray-300 text-sm px-3 py-2 rounded-xl border border-[#2d2d2d]">
                            {selectedFile.type.startsWith('image/') ? (
                                <img
                                    src={URL.createObjectURL(selectedFile)}
                                    alt="Preview"
                                    className="w-10 h-10 object-cover rounded"
                                />
                            ) : (
                                <FileText className="w-4 h-4 text-indigo-400" />
                            )}
                            <span className="max-w-[200px] truncate flex-1">{selectedFile.name}</span>
                            <span className="text-xs text-gray-500">
                                ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                className="ml-1 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="relative flex items-end gap-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-2xl p-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all"
                    >
                        {/* Tools Menu */}
                        <div className="relative group">
                            <button
                                type="button"
                                className="p-2.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-2 shadow-xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-colors"
                                    title="Pilih Foto"
                                >
                                    <Image className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-colors"
                                    title="Ambil Foto"
                                >
                                    <Camera className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-colors"
                                    title="Pilih Dokumen"
                                >
                                    <FileText className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Hidden Inputs */}
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            ref={imageInputRef}
                            onChange={handleImageChange}
                        />

                        {/* Voice Input */}
                        <button
                            type="button"
                            onClick={isRecording ? () => { } : startVoiceRecognition}
                            className={`p-2.5 transition-colors shrink-0 ${isRecording ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}
                            title={isRecording ? 'Sedang Merekam...' : 'Rekam Suara'}
                        >
                            {isRecording ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                        </button>

                        {/* Text Input */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ketik pertanyaan hukum atau upload dokumen..."
                            className="flex-1 max-h-48 min-h-[48px] bg-transparent border-none resize-none focus:ring-0 text-sm text-white placeholder-gray-500 py-3 scrollbar-hide"
                            rows={1}
                        />

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={isLoading || (!input.trim() && !selectedFile)}
                            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shrink-0"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-600 mt-3">
                        HukumAI tidak memberikan saran perwakilan hukum resmi. <span className="text-indigo-400">Baca Disclaimer.</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
