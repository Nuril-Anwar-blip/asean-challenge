import { Send, Paperclip, FileText, Loader2, Bot, User, X, Camera, Image, Mic, MicOff, Volume2 } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/pages/Apila/Index';

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

    const handleClearChat = () => {
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
                                onClick={() => setInput("Apa itu perjanjian kontrak kerja?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Apa itu perjanjian kontrak kerja?</p>
                            </button>
                            <button
                                onClick={() => setInput("Bagaimana cara membuat surat izin usaha?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Cara membuat surat izin usaha</p>
                            </button>
                            <button
                                onClick={() => setInput("Apa hak pekerja menurut UU Ketenagakerjaan?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Hak pekerja menurut UU</p>
                            </button>
                            <button
                                onClick={() => setInput("Bagaimana prosedur mengajukan gugatan perdata?")}
                                className="p-3 text-left bg-[#1a1a1a] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl transition-colors group"
                            >
                                <p className="text-sm text-gray-300 group-hover:text-white">Prosedur gugatan perdata</p>
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
                                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-[#1a1a1a] text-white rounded-tr-sm'
                                    : 'text-gray-100'
                                    }`}>
                                    {msg.content}
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
                                    <div className="mt-3 p-3 rounded-xl border border-[#2d2d2d] bg-[#0d0d0d]">
                                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" />
                                            Referensi Hukum
                                        </h4>
                                        <div className="space-y-2">
                                            {msg.sources.map((src, idx) => (
                                                <div key={idx} className="text-xs p-2 rounded-md bg-[#1a1a1a] border border-[#2d2d2d]">
                                                    <span className="font-medium text-indigo-400 block mb-1">{src.title}</span>
                                                    <span className="text-gray-400">{src.snippet}</span>
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
