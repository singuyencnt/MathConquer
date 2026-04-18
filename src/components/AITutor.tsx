import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, User, Bot, Loader2, X, MessageSquare, BookOpen, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { UserProfile, ChatMessage } from '../types';
import { chatWithTutor } from '../services/aiService';

interface AITutorProps {
  user: UserProfile;
  onBack: () => void;
}

export default function AITutor({ user, onBack }: AITutorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Chào ${user.fullName}! Mình là Gia sư ảo AI. Mình rất vui được đồng hành cùng bạn trong quá trình ôn luyện môn Toán lớp 12. 
      Bạn đang gặp khó khăn ở bài tập nào? Hãy nhập đề bài hoặc gửi ảnh chụp để mình hướng dẫn phương pháp giải nhé!`,
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: selectedImage ? 'image' : 'text',
      imageUrl: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // Send message history + new message to AI
      const aiResponseContent = await chatWithTutor([...messages, userMessage], user);
      
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponseContent,
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "Mình xin lỗi, hệ thống đang gặp chút sự cố. Bạn hãy thử lại sau nhé!",
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-5xl mx-auto space-y-4">
      {/* Header Info */}
      <div className="bg-white border border-border-main rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-black text-text-main uppercase tracking-tight text-sm">Gia sư ảo AI</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
              <span className="text-[0.65rem] font-bold text-text-sub uppercase tracking-widest">Đang trực tuyến</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-stage-bg px-4 py-2 rounded-xl">
          <Info className="w-4 h-4 text-primary" />
          <p className="text-[0.65rem] font-medium text-text-sub uppercase tracking-wide">AI hướng dẫn phương pháp, không giải nhanh thay bạn</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white border border-border-main rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-primary text-white' : 'bg-stage-bg text-primary border border-primary/10'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-slate-50 border border-border-main text-text-main rounded-tl-none'
                  }`}>
                    {msg.imageUrl && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                        <img src={msg.imageUrl} alt="Uploaded exercise" className="max-w-full h-auto max-h-64 object-contain" />
                      </div>
                    )}
                    <div className="markdown-body prose prose-sm max-w-none">
                      <Markdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                  </div>
                  <span className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 bg-stage-bg rounded-lg flex items-center justify-center text-primary border border-primary/10">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-50 border border-border-main p-4 rounded-2xl flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs font-bold text-text-sub uppercase tracking-widest animate-pulse">Gia sư đang suy nghĩ...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected Image Preview */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 py-3 bg-slate-50 border-t border-border-main flex items-center gap-4"
            >
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border-main bg-white">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs font-bold text-text-sub uppercase tracking-wider">Ảnh bài tập đã chọn. Hãy nhập thêm câu hỏi nếu cần.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-border-main">
          <div className="flex items-end gap-3 bg-bg-main p-3 rounded-2xl border border-border-main transition-all focus-within:ring-2 focus-within:ring-primary focus-within:bg-white">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white border border-border-main rounded-xl text-text-sub hover:text-primary hover:border-primary transition-all shadow-sm"
              title="Gửi ảnh bài tập"
            >
              <Upload className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Bạn muốn hỏi gì về bài tập này?"
              className="flex-1 bg-transparent border-none outline-none text-sm p-3 min-h-[50px] max-h-[150px] resize-none"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className={`p-3 rounded-xl transition-all shadow-lg ${
                (!input.trim() && !selectedImage) || isLoading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-3 text-[0.6rem] text-center text-text-sub font-bold uppercase tracking-[0.15em] opacity-50">
            Giáo viên thông thái - Bạn đồng hành môn Toán 12
          </p>
        </div>
      </div>
    </div>
  );
}
