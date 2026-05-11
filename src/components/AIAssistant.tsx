import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, X, MessageSquare, Bot, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Task } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantProps {
  tasks: Task[];
  categories: string[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, categories }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('bloom_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: "Hey. If you're feeling stuck or having trouble getting started, I can help. What's on your mind?" }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('bloom_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const taskSummary = tasks.map(t => {
        const subtaskSummary = t.subtasks?.map(s => 
          `  - [${s.completed ? 'X' : ' '}] Subtask: ${s.title}${s.dueDate ? ' (Due: ' + s.dueDate.toLocaleDateString() + ')' : ''}`
        ).join('\n') || '';
        
        return `- [${t.completed ? 'X' : ' '}] ${t.title} (${t.category}) ${t.dueDate ? 'Main Due: ' + t.dueDate.toLocaleDateString() : ''}\n${subtaskSummary}`;
      }).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `You are a productivity advisor. 
          Your goal is to help users overcome procrastination and manage their list of tasks. 
          
          Current User Tasks:
          ${taskSummary || 'No tasks currently active.'}
          
          Available Categories:
          ${categories.join(', ')}
          
          Talk like a real, supportive person. 
          Be direct, empathetic, and casual. Keep responses short. 
          If a user is struggling, give them one simple thing they can do right now from their list. 
          Avoid flower metaphors or overly formal language.
          Use Markdown for formatting (bold, lists, etc) to make your advice readable.`,
          temperature: 0.7,
        }
      });

      const aiText = response.text || "I'm sorry, I'm having trouble thinking right now. Let's try again in a moment.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again soon." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleClearChat = () => {
    const initialMessage: Message[] = [
      { role: 'assistant', content: "Hey. If you're feeling stuck or having trouble getting started, I can help. What's on your mind?" }
    ];
    setMessages(initialMessage);
    localStorage.removeItem('bloom_chat_history');
    setIsConfirmingClear(false);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-80 sm:w-96 bg-white rounded-[32px] shadow-2xl border border-artistic-border flex flex-col overflow-hidden h-[500px]"
          >
            <div className="p-6 bg-artistic-dark text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-artistic-pink rounded-xl flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-lg leading-none">Assistant</h3>
                  <p className="text-[10px] uppercase tracking-widest opacity-60 mt-1">Productivity Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsConfirmingClear(true)}
                  className="text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity px-2 py-1"
                >
                  Clear Chat
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isConfirmingClear && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[100] bg-artistic-dark/40 backdrop-blur-sm flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-[24px] p-6 shadow-2xl w-full max-w-[280px] text-center"
                  >
                    <div className="w-12 h-12 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={24} />
                    </div>
                    <h4 className="font-sans font-bold text-lg text-artistic-dark mb-2">Clear History?</h4>
                    <p className="text-xs text-artistic-taupe mb-6 leading-relaxed">
                      This will delete all messages in this conversation. This action cannot be undone.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={handleClearChat}
                        className="w-full py-3 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors"
                      >
                        Yes, Clear Everything
                      </button>
                      <button 
                        onClick={() => setIsConfirmingClear(false)}
                        className="w-full py-3 bg-artistic-soft/50 text-artistic-taupe rounded-xl text-xs font-bold hover:bg-artistic-soft transition-colors"
                      >
                        Keep Conversation
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-artistic-soft/30"
            >
              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "flex",
                  m.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-artistic-pink text-white rounded-tr-none" 
                      : "bg-white border border-artistic-border text-artistic-dark rounded-tl-none markdown-body"
                  )}>
                    {m.role === 'assistant' ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-artistic-border p-4 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-artistic-pink rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-artistic-pink rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-artistic-pink rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-artistic-border">
              <div className="flex items-end gap-2 bg-artistic-soft/50 border border-artistic-border rounded-2xl px-4 py-2 focus-within:ring-2 ring-artistic-pink/20 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                    }
                  }}
                  placeholder="Need a little nudge?"
                  rows={1}
                  className="flex-1 bg-transparent border-none text-sm outline-none transition-all text-artistic-dark resize-none py-1 overflow-y-auto"
                  style={{ height: 'auto', minHeight: '1.5rem' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="w-10 h-10 bg-artistic-pink text-white rounded-full flex items-center justify-center shadow-lg shadow-pink-100 disabled:opacity-50 active:scale-95 transition-all flex-shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white transition-all",
          isOpen ? "bg-artistic-dark" : "bg-artistic-pink"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </motion.button>
    </div>
  );
};
