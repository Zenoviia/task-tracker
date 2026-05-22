/**
 * @file PatternShowcase.tsx
 * @description Інтерактивна навчальна панель репрезентації патернів GoF та Async-контрактів JS.
 * Створена індивідуально для захисту курсового проєкту перед викладачем.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Terminal, 
  Play, 
  Undo, 
  RefreshCw, 
  Layers, 
  GitCommit, 
  Sparkles, 
  Clock, 
  X,
  FileCode,
  CheckCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import { Task } from '../types';
import { TaskBuilder, StudyTaskCreator, TaskPrototype, SoftPinkThemeFactory } from '../patterns/creational';
import { TaskComposite, StorageBridge, LocalStorageProvider, TaskValidationProxy, CategoryFlyweight } from '../patterns/structural';
import { CommandHistory, ToggleCompleteCommand, ProductivityMediator, RegularTaskProcessor, SortByDeadlineStrategy, SortByCategoryStrategy, StatsVisitor } from '../patterns/behavioral';
import { ThenableTaskAnalyzer, TaskListIterable, AsyncMessageStream, AssetSyncer } from '../patterns/contracts';

interface PatternShowcaseProps {
  tasks: Task[];
  userId: string;
  onRefreshTasks: () => void;
  onAddTaskDirectly: (task: Task) => Promise<void>;
  onTriggerUndoToast: (msg: string) => void;
}

export function PatternShowcase({ 
  tasks, 
  userId, 
  onRefreshTasks, 
  onAddTaskDirectly,
  onTriggerUndoToast
}: PatternShowcaseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'education' | 'sandbox' | 'logs'>('sandbox');
  const [logs, setLogs] = useState<string[]>([]);
  const [asyncStreamActive, setAsyncStreamActive] = useState(false);
  const [streamedMessages, setStreamedMessages] = useState<string[]>([]);
  
  // Tracing log helper
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    // Subscribe to productivity mediator events
    ProductivityMediator.subscribe('TASK_SAVED', (payload) => {
      addLog(`[Mediator] Повідомлення: Успішно збережено завдання "${payload.title}"`);
    });
    ProductivityMediator.subscribe('URGENT_TASK_CREATED', (payload) => {
      addLog(`[Mediator] Повідомлення: Створено термінове завдання "${payload.title}"`);
    });
    addLog("Система спостереження за патернами активована. Готова до запуску тестів.");
  }, []);

  // 1. RUN BUILDER DEMO
  const runBuilderDemo = async () => {
    try {
      addLog("Ініціалізація TaskBuilder...");
      const customTask = TaskBuilder.create(userId)
        .setTitle("Лабораторна робота з патернів")
        .setDescription("Показати викладачевіSOLID розробку")
        .setCategory("Studying")
        .setDueDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) // 2 days later
        .build();
      
      addLog(`[Builder Success] Створено об'єкт: "${customTask.title}" з категорією: "${customTask.category}"`);
      await onAddTaskDirectly(customTask);
      addLog(`[Firestore API] Завдання записано у базу даних.`);
    } catch (e: any) {
      addLog(`[Builder Error] ${e.message}`);
    }
  };

  // 2. RUN FACTORY METHOD DEMO
  const runFactoryDemo = async () => {
    try {
      addLog("Виклик StudyTaskCreator (Фабричний метод)...");
      const creator = new StudyTaskCreator();
      const factoryTask = creator.createTask("GoF Patterns Study Notebook", userId, "Автоматично створено через фабрику студентських завдань");
      
      addLog(`[Factory Success] Створено: "${factoryTask.title}" з дефолтною категорією: "${factoryTask.category}"`);
      await onAddTaskDirectly(factoryTask);
      addLog(`[Firestore API] Фабричне завдання додано!`);
    } catch (e: any) {
      addLog(`[Factory Error] ${e.message}`);
    }
  };

  // 3. RUN PROTOTYPE DEMO
  const runPrototypeDemo = async () => {
    if (tasks.length === 0) {
      addLog("[Prototype Alert] Спочатку додайте хоча б одне завдання для клонування!");
      return;
    }
    try {
      const source = tasks[0];
      addLog(`Клонування об'єкта через Prototype: "${source.title}"...`);
      const clone = TaskPrototype.clone(source);
      
      addLog(`[Prototype Success] Об'єкт успішно склоновано! Нова назва: "${clone.title}"`);
      await onAddTaskDirectly(clone);
    } catch (e: any) {
      addLog(`[Prototype Error] ${e.message}`);
    }
  };

  // 4. RUN PROXY DEMO
  const runProxyDemo = () => {
    try {
      addLog("Створення Proxy обгортки над першим завданням...");
      const baseTask = tasks[0] || TaskBuilder.create(userId).setTitle("Тимчасова Задача").build();
      
      const proxyTask = TaskValidationProxy.create(baseTask, (prop, val) => {
        addLog(`[Proxy Alert] Зафіксовано спробу зміни властивості "${prop}" на "${val}"`);
      });

      addLog("Тест 1: Валідне оновлення заголовка...");
      proxyTask.title = "Тестове завдання через Proxy";
      
      addLog("Тест 2: Спроба передати невалідний заголовок (Порожній текст)...");
      proxyTask.title = ""; // Має викинути валідаційну помилку!
    } catch (e: any) {
      addLog(`[Proxy Validation Caught] ${e.message}`);
    }
  };

  // 5. RUN STRATEGY DEMO
  const runStrategyDemo = () => {
    addLog("Запуск Тесту патерна Strategy...");
    const deadlineStrategy = new SortByDeadlineStrategy();
    const categoryStrategy = new SortByCategoryStrategy();

    addLog(`Всього завдань для сортування: ${tasks.length}`);
    addLog("Крок 1: Сортування за стратегією дедлайну (SortByDeadlineStrategy)...");
    const sorted1 = deadlineStrategy.sort(tasks);
    if (sorted1.length > 0) {
      addLog(`[Deadline Strategy Result] Перше за терміном завдання: "${sorted1[0].title}"`);
    }

    addLog("Крок 2: Сортування за категорією (SortByCategoryStrategy)...");
    const sorted2 = categoryStrategy.sort(tasks);
    if (sorted2.length > 0) {
      addLog(`[Category Strategy Result] Перше завдання в алфавітному списку категорій: "${sorted2[0].title}" (${sorted2[0].category})`);
    }
  };

  // 6. RUN COMPOSITE & VISITOR DEMO
  const runCompositeVisitorDemo = () => {
    if (tasks.length === 0) {
      addLog("[Composite Alert] Потрібно хоча б одне завдання!");
      return;
    }
    try {
      addLog("Будуємо дерево Composite з існуючих завдань та підзадач...");
      const compositorList = tasks.map(t => new TaskComposite(t));
      
      addLog(`Об'єднано композитів у дерево: ${compositorList.length}. Ініціалізуємо StatsVisitor...`);
      const visitor = new StatsVisitor();
      
      for (const comp of compositorList) {
        visitor.visitTask(comp);
      }

      addLog(`[Visitor Summary] Результати відвідувача (Visitor):`);
      addLog(`-> Разом головних завдань: ${visitor.totalTasks} (Виконано: ${visitor.completedTasks})`);
      addLog(`-> Спільна кількість підзадач: ${visitor.totalSubtasks} (Виконано: ${visitor.completedSubtasks})`);
    } catch (e: any) {
      addLog(`[Visitor Error] ${e.message}`);
    }
  };

  // 7. RUN CONTROLLER THENABLE DEMO
  const runThenableDemo = async () => {
    addLog("Розрахунок за допомогою Thenable Contract (Lazy Thenable)...");
    const analyzer = new ThenableTaskAnalyzer(tasks);
    
    addLog("Очікуємо виконання Thenable через звичайний await...");
    const result = await analyzer;
    
    addLog(`[Thenable Result] Показник вашої ефективності: ${result.efficiency}% | Прострочено задач: ${result.overdueCount}`);
  };

  // 8. RUN ASYNC STREAM GENERATOR DEMO
  const runAsyncStream = async () => {
    if (asyncStreamActive) return;
    setAsyncStreamActive(true);
    setStreamedMessages([]);
    addLog("[Async Generator] Запуск стрімінгового підключення AsyncMessageStream...");

    try {
      const stream = new AsyncMessageStream();
      for await (const msg of stream) {
        setStreamedMessages(prev => [...prev, msg]);
        addLog(`[Async Stream Received] ${msg}`);
      }
      addLog("[Async Generator] Трансляцію стріму ολοкліровано.");
    } catch (e: any) {
      addLog(`[Stream Error] ${e.message}`);
    } finally {
      setAsyncStreamActive(false);
    }
  };

  // 9. PROMISE.ALLSETTLED & WITHRESOLVERS DEMO
  const runPromiseAllDemo = async () => {
    addLog("Синхронізація резервної копії (Promise.withResolvers та allSettled)...");
    try {
      const results = await AssetSyncer.syncAllSources(tasks);
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          addLog(`[Source ${i+1} Зв'язок] Стан: Успішно - ${res.value}`);
        } else {
          addLog(`[Source ${i+1} Зв'язок] Стан: Помилка - ${res.reason}`);
        }
      });
    } catch (e: any) {
      addLog(`[Promise Sync Error] ${e.message}`);
    }
  };

  // 10. ITERABLE DEMO
  const runIterableDemo = () => {
    addLog("Створення Iterable списку (TaskListIterable)...");
    const iterableList = new TaskListIterable(tasks);
    
    addLog("Трасування ітерацій через конструкцію for...of:");
    let count = 0;
    for (const item of iterableList) {
      addLog(`   Ітерація ${++count}: ${item}`);
    }
  };

  // 11. COMMAND UNDO DEMO
  const runUndoDemo = async () => {
    const label = CommandHistory.getUndoLabel();
    if (!label) {
      addLog("[Undo Command] Стек скасувань порожній. Зробіть помітку статусу задачі спочатку.");
      return;
    }
    addLog(`Скасування останньої команди через Command Engine: [${label}]...`);
    const undone = await CommandHistory.undo();
    if (undone) {
      addLog(`[Command Status] Успішно скасовано: "${undone}"`);
      onRefreshTasks();
      onTriggerUndoToast(`Скасовано дію: ${undone}`);
    }
  };

  const runTemplateMethodDemo = async () => {
    addLog("Створення процесора життєвого циклу (Template Method)...");
    let saved = false;
    const processor = new RegularTaskProcessor(async (t) => {
      addLog(`[Template Method Callback] Збереження об'єкта в сховищі: "${t.title}"`);
      saved = true;
    });

    const mockTask = TaskBuilder.create(userId)
      .setTitle("Завдання Шаблонного Методу")
      .setDescription("Корисно для демонстрації")
      .build();

    await processor.processTask(mockTask);
    addLog(`[Template Method Result] Обробка завершилась із результатом: ${saved ? "УСПІШНО" : "ПОМИЛКА"}`);
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs"
        id="pattern-showcase-btn"
      >
        <Award size={18} className="animate-pulse" />
        <span>GoF Patterns Hub</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-artistic-dark/40 backdrop-blur-md z-[150]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="fixed inset-x-4 inset-y-8 md:inset-x-12 md:inset-y-12 lg:inset-x-24 lg:inset-y-16 m-auto bg-stone-900 border border-stone-800 text-stone-100 rounded-[40px] z-[160] shadow-2xl flex flex-col overflow-hidden max-w-6xl h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                    <Award size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-2xl font-bold tracking-tight">Навчальний Хаб Патернів (GoF & Async Contracts)</h2>
                    <p className="text-xs text-stone-400">Демонстрація технологій і шаблонів для здачі курсового проєкту</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-stone-800 rounded-full text-stone-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-stone-800 bg-stone-950/50 px-6 gap-4">
                <button
                  onClick={() => setActiveTab('sandbox')}
                  className={`py-4 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'sandbox' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-stone-400 hover:text-stone-250'}`}
                >
                  <Play size={16} /> Інтерактивна Пісочниця
                </button>
                <button
                  onClick={() => setActiveTab('education')}
                  className={`py-4 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'education' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-stone-400 hover:text-stone-250'}`}
                >
                  <BookOpen size={16} /> Карта Навчальних Тем
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`py-4 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 relative ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-stone-400 hover:text-stone-250'}`}
                >
                  <Terminal size={16} /> Лог Консоль (Tracing)
                  {logs.length > 0 && (
                    <span className="absolute top-2 right-[-6px] w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </button>
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-stone-900/40">
                <AnimatePresence mode="wait">
                  {/* TAB 1: SANDBOX */}
                  {activeTab === 'sandbox' && (
                    <motion.div
                      key="sandbox"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left"
                    >
                      {/* Control Card 1 */}
                      <div className="bg-stone-950/60 p-6 rounded-3xl border border-stone-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-3">
                            <Layers size={14} /> Creational Patterns (Породжуючі)
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Builder & Creator & Prototype</h3>
                          <p className="text-xs text-stone-400 leading-relaxed mb-6">
                            Тестування гнучкого покрокового створення завдання, фабричного інстанціювання за окремими категоріями та безпечного клонування без прямого копіювання посилань у пам'яті.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={runBuilderDemo}
                            className="px-4 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-indigo-700/50"
                          >
                            <Play size={12} /> Запустити Builder
                          </button>
                          <button 
                            onClick={runFactoryDemo}
                            className="px-4 py-2 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-700/50"
                          >
                            <Play size={12} /> Factory Method
                          </button>
                          <button 
                            onClick={runPrototypeDemo}
                            className="px-4 py-2 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2"
                          >
                            <RefreshCw size={12} /> Clone (Prototype)
                          </button>
                        </div>
                      </div>

                      {/* Control Card 2 */}
                      <div className="bg-stone-950/60 p-6 rounded-3xl border border-stone-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-3">
                            <GitCommit size={14} /> Structural & Behavioral (Структурні + Поведінкові)
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Proxy, Strategy, Composite & Visitor</h3>
                          <p className="text-xs text-stone-400 leading-relaxed mb-6">
                            Візуальний запуск відстеження стану через Proxy, перемикання стратегій сортування, та аналіз ієрархічної деревовидної структури за допомогою шаблону відвідувача.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={runProxyDemo}
                            className="px-4 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-indigo-700/50"
                          >
                            <Play size={12} /> Run ES6 Proxy
                          </button>
                          <button 
                            onClick={runStrategyDemo}
                            className="px-4 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-indigo-700/50"
                          >
                            <Play size={12} /> Test Strategy
                          </button>
                          <button 
                            onClick={runCompositeVisitorDemo}
                            className="px-4 py-2 bg-amber-600/20 text-amber-300 hover:bg-amber-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-amber-700/50"
                          >
                            <Play size={12} /> Composite + Visitor
                          </button>
                        </div>
                      </div>

                      {/* Control Card 3 */}
                      <div className="bg-stone-950/60 p-6 rounded-3xl border border-stone-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-3">
                            <Clock size={14} /> Async JavaScript Contracts
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Thenable, Async Generator & withResolvers</h3>
                          <p className="text-xs text-stone-400 leading-relaxed mb-4">
                            Робота з неочікуваними асинхронними форматами: promise-like об'єкти (Thenables), стрімінгова трансляція порад та нове API розв'язання Promise.
                          </p>
                          
                          {streamedMessages.length > 0 && (
                            <div className="bg-stone-900 border border-stone-850 p-3 rounded-2xl mb-4 text-xs font-mono text-emerald-400 flex flex-col gap-1 max-h-[85px] overflow-y-auto">
                              {streamedMessages.map((msg, i) => (
                                <div key={i} className="truncate">✓ {msg}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={runThenableDemo}
                            className="px-4 py-2 bg-pink-600/20 text-pink-300 hover:bg-pink-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-pink-700/50"
                          >
                            <Clock size={12} /> Launch Thenable (Await)
                          </button>
                          <button 
                            onClick={runAsyncStream}
                            disabled={asyncStreamActive}
                            className="px-4 py-2 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-700/50 disabled:opacity-30"
                          >
                            <RefreshCw size={12} className={asyncStreamActive ? "animate-spin" : ""} /> 
                            {asyncStreamActive ? "Streaming..." : "Async Message Stream"}
                          </button>
                          <button 
                            onClick={runPromiseAllDemo}
                            className="px-4 py-2 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white transition-all text-xs font-bold rounded-xl"
                          >
                            Sync withResolvers
                          </button>
                        </div>
                      </div>

                      {/* Control Card 4 */}
                      <div className="bg-stone-950/60 p-6 rounded-3xl border border-stone-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-3">
                            <Undo size={14} /> Command Pattern & More
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">Command (Undo/Redo), Template Method & Iterators</h3>
                          <p className="text-xs text-stone-400 leading-relaxed mb-6">
                            Втілення повноцінної системи транзакційного скасування дій за допомогою патерна Command та відстеження протоколу ітерації для лінивої обробки колекцій.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={runUndoDemo}
                            className="px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white transition-all text-xs font-bold rounded-xl flex items-center gap-2 border border-red-700/50"
                          >
                            <Undo size={12} /> Undo Last Command
                          </button>
                          <button 
                            onClick={runTemplateMethodDemo}
                            className="px-4 py-2 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white transition-all text-xs font-bold rounded-xl"
                          >
                            Template Method
                          </button>
                          <button 
                            onClick={runIterableDemo}
                            className="px-4 py-2 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white transition-all text-xs font-bold rounded-xl"
                          >
                            Test for...of Iterable
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: EDUCATION */}
                  {activeTab === 'education' && (
                    <motion.div
                      key="education"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="bg-indigo-600/10 border border-indigo-900/40 p-6 rounded-3xl flex items-center gap-4">
                        <Award size={32} className="text-indigo-400" />
                        <div>
                          <h4 className="text-lg font-bold text-indigo-400">SOLID & GOF: Як пояснити викладачу цей код</h4>
                          <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                            Цей проєкт не просто відображає список завдань, а є повною навчальною демонстрацією SOLID та GoF патернів. Всі частини коду розділені відповідно до принципу Separation of Concerns (SoC).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Box 1 */}
                        <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-3xl">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Creational (Породжуючі)
                          </h4>
                          <ul className="space-y-2 text-xs text-stone-400">
                            <li><strong>TaskBuilder:</strong> Покроково збирає об'єкт <code className="text-indigo-300">Task</code> перед збереженням в базу даних Firestore. Гарантує інваріантність даних.</li>
                            <li><strong>Factory Method / Creator:</strong> Створює індивідуальні завдання відповідно до потреб. Наприклад, <code className="text-indigo-300">StudyTaskCreator</code> автоматично підставляє потрібні прапорці для навчання.</li>
                            <li><strong>Prototype:</strong> Зручний інтерфейс копіювання завдань у клієнті для уникнення проблем з посиланнями у пам'яті React.</li>
                          </ul>
                        </div>

                        {/* Box 2 */}
                        <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-3xl">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Structural (Структурні)
                          </h4>
                          <ul className="space-y-2 text-xs text-stone-400">
                            <li><strong>Composite:</strong> Організує завдання та підзавдання в деривативне древо. Ваші підзадачі є葉(Leaf) листям, а самі завдання - Composite контейнерами.</li>
                            <li><strong>Bridge:</strong> Відділяє бізнес-логіку зберігання від джерела даних. Можна підключити LocalStorage або Cloud DB.</li>
                            <li><strong>Validation Proxy:</strong> Proxy об'єкт логує у консоль будь-які маніпуляції та валідує неприпустимі стани (наприклад, пусту назву).</li>
                          </ul>
                        </div>

                        {/* Box 3 */}
                        <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-3xl">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Behavioral (Поведінкові)
                          </h4>
                          <ul className="space-y-2 text-xs text-stone-400">
                            <li><strong>Command Engine:</strong> Створює обгортки над транзакціями. Кожна дія зберігається у стеку <code className="text-indigo-300">UndoStack</code>, підтримуючи повноцінне "Undo".</li>
                            <li><strong>ProductivityMediator:</strong> Організував Event-driven зв'язок між модулями, знімаючи прямі зв'язки.</li>
                            <li><strong>StatsVisitor:</strong> Проводить обрахунок по всьому дереву Composite, збираючи статистику.</li>
                          </ul>
                        </div>

                        {/* Box 4 */}
                        <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-3xl">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Async & JS Contracts
                          </h4>
                          <ul className="space-y-2 text-xs text-stone-400">
                            <li><strong>Thenable Awaitable:</strong> Реалізація об'єкту з власною специфікацією .then(), яку розпізнає ключове слово <code className="text-emerald-300">await</code>.</li>
                            <li><strong>Symbols & Iterators:</strong> Надання об'єкту здатності виступати ітератором розкладу в циклі <code className="text-emerald-300">for...of</code>.</li>
                            <li><strong>Async Generator Stream:</strong> Стрімінг контенту за допомогою сучасної конструкції <code className="text-emerald-300">for await...of</code>.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 3: LOGS */}
                  {activeTab === 'logs' && (
                    <motion.div
                      key="logs"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col h-full text-left"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-xs uppercase font-bold tracking-wider text-indigo-400">Консоль спостереження (Трасування операцій)</label>
                        <button
                          onClick={() => setLogs([])}
                          className="text-xs text-stone-400 hover:text-white hover:underline transition-all"
                        >
                          Очистити лог
                        </button>
                      </div>
                      <div className="flex-1 bg-stone-950 border border-stone-850 p-6 rounded-3xl font-mono text-xs text-emerald-400 space-y-2.5 max-h-[380px] overflow-y-auto min-h-[250px] no-scrollbar">
                        {logs.length === 0 ? (
                          <div className="text-stone-650 italic text-center py-10 py-12">Немає зареєстрованих логів. Спробуйте запустити пісочницю!</div>
                        ) : (
                          logs.map((log, idx) => (
                            <div key={idx} className="border-b border-stone-900 pb-1.5 last:border-0 leading-relaxed break-all">
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status footer banner */}
              <div className="p-4 bg-stone-955 text-center text-[10px] text-stone-500 font-bold border-t border-stone-850 uppercase tracking-widest bg-stone-950 flex justify-between px-8">
                <span>VITE APPLICATION SYSTEM</span>
                <span className="text-indigo-400 font-black">CRAFTED FOR ADVANCED SOFTWARE ENGINEERING</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
