/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Tag, 
  LogOut, 
  Search, 
  MoreVertical,
  Trash2,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  LayoutGrid,
  X,
  Pencil,
  Archive,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  isWithinInterval, 
  startOfWeek, 
  endOfWeek,
  isSameWeek,
  isSameDay,
  set,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  subDays
} from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { auth, db, googleProvider, handleFirestoreError, googleSignIn } from './lib/firebase';
import { Task, TaskCategory, RecurringType, OperationType, UserProfile, Subtask } from './types';
import { cn } from './lib/utils';

import { AIAssistant } from './components/AIAssistant';
import { PatternShowcase } from './components/PatternShowcase';
import { CommandHistory, ToggleCompleteCommand } from './patterns/behavioral';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customCategories, setCustomCategories] = useState<string[]>(Object.values(TaskCategory));
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  // New task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [deadlineDate, setDeadlineDate] = useState<string>('');
  const [deadlineTime, setDeadlineTime] = useState<string>('');
  const [recurringType, setRecurringType] = useState<RecurringType>('none');
  const [subtasks, setSubtasks] = useState<{title: string, description?: string, dueDate: string, completed: boolean, id: string}[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [editingSubtaskIndex, setEditingSubtaskIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate ? data.dueDate.toDate() : null,
          completedAt: data.completedAt ? data.completedAt.toDate() : null,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
          subtasks: data.subtasks ? data.subtasks.map((s: any) => ({
            ...s,
            dueDate: s.dueDate ? s.dueDate.toDate() : null
          })) : []
        } as Task;
      });
      setTasks(taskData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [user]);

  // Clean up old archived tasks (> 30 days)
  useEffect(() => {
    if (!user || tasks.length === 0) return;

    const cleanupOldTasks = async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const oldTasks = tasks.filter(t => t.completed && t.completedAt && isBefore(t.completedAt, thirtyDaysAgo));
      
      for (const task of oldTasks) {
        if (task.id) {
          try {
            await deleteDoc(doc(db, 'tasks', task.id));
          } catch (e) {
            console.error("Cleanup error:", e);
          }
        }
      }
    };

    cleanupOldTasks();
  }, [user, tasks]);

  // Handle User Profile / Categories
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (data.categories && data.categories.length > 0) {
          setCustomCategories(data.categories);
        }
      } else {
        // Initialize profile
        setDoc(profileRef, {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          categories: Object.values(TaskCategory),
          settings: { softPinkTheme: true, motivationalQuotes: false }
        }, { merge: true }).catch(() => {
          // Handled by rules
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    const updatedCategories = [...customCategories, newCategoryName.trim()];
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        categories: updatedCategories
      });
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleDeleteCategory = async () => {
    if (!user || !categoryToDelete) return;
    const updatedCategories = customCategories.filter(cat => cat !== categoryToDelete);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        categories: updatedCategories
      });
      if (selectedCategory === categoryToDelete) {
        setSelectedCategory('All');
      }
      setCategoryToDelete(null);
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const handleOpenAddTask = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openSubtaskAddModal = () => {
    setNewSubtaskTitle('');
    setNewSubtaskDescription('');
    setNewSubtaskDueDate('');
    setEditingSubtaskIndex(null);
    setIsSubtaskModalOpen(true);
  };

  const openEditSubtaskModal = (index: number) => {
    const st = subtasks[index];
    setNewSubtaskTitle(st.title);
    setNewSubtaskDescription(st.description || '');
    setNewSubtaskDueDate(st.dueDate || '');
    setEditingSubtaskIndex(index);
    setIsSubtaskModalOpen(true);
  };

  const handleLogin = async () => {
    try {
      await googleSignIn();
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    let taskCategory = category;
    if (!taskCategory) {
      taskCategory = selectedCategory !== 'All' ? selectedCategory : (customCategories[0] || 'Tasks');
      setCategory(taskCategory);
    }

    let finalDueDate: Timestamp | null = null;
    if (deadlineDate) {
      const dateParts = deadlineDate.split('-');
      const timeParts = deadlineTime ? deadlineTime.split(':') : ['23', '59'];
      const dateObj = set(new Date(), {
        year: parseInt(dateParts[0]),
        month: parseInt(dateParts[1]) - 1,
        date: parseInt(dateParts[2]),
        hours: parseInt(timeParts[0]),
        minutes: parseInt(timeParts[1]),
        seconds: 0
      });
      finalDueDate = Timestamp.fromDate(dateObj);
    }

    const allSubtasksDone = subtasks.every(s => s.completed);
    
    const commonData: any = {
      title,
      description: description || null,
      category: taskCategory,
      dueDate: finalDueDate,
      completed: allSubtasksDone ? (editingTask ? editingTask.completed : false) : false,
      userId: user.uid,
      updatedAt: serverTimestamp(),
      recurring: { type: recurringType, frequency: 1 },
      reminders: [],
      subtasks: subtasks.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description || null,
        completed: s.completed,
        dueDate: (s.dueDate && !isNaN(new Date(s.dueDate).getTime())) ? Timestamp.fromDate(new Date(s.dueDate)) : null
      }))
    };

    try {
      if (editingTask?.id) {
        await updateDoc(doc(db, 'tasks', editingTask.id), commonData);
      } else {
        const newTaskData = {
          ...commonData,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'tasks'), newTaskData);
      }

      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Task Submission Error:', error);
    }
  };

  const handleAddTaskDirectly = async (task: Task) => {
    if (!user) return;
    try {
      const parsedTask = {
        title: task.title,
        description: task.description || null,
        category: task.category,
        dueDate: task.dueDate ? Timestamp.fromDate(task.dueDate) : null,
        completed: task.completed,
        completedAt: task.completedAt ? Timestamp.fromDate(task.completedAt) : null,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        recurring: task.recurring,
        reminders: task.reminders || [],
        subtasks: task.subtasks?.map(st => ({
          ...st,
          dueDate: st.dueDate ? Timestamp.fromDate(st.dueDate) : null
        })) || []
      };
      await addDoc(collection(db, 'tasks'), parsedTask);
    } catch (e) {
      console.error("Direct add task error in app: ", e);
    }
  };

  const toggleComplete = async (task: Task) => {
    if (!task.id) return;
    
    // Constraint: All subtasks must be done to allow main task to be marked as done
    const allSubtasksDone = !task.subtasks || task.subtasks.length === 0 || task.subtasks.every(st => st.completed);
    
    if (!task.completed && !allSubtasksDone) {
      // Prevent marking as done if subtasks are pending
      return;
    }

    const isCompleting = !task.completed;
    const path = `tasks/${task.id}`;

    // Створенная колбек обгортка для інтеграції патерну Command
    const updateFn = async (id: string, fields: Partial<Task>) => {
      await updateDoc(doc(db, 'tasks', id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    };

    const cmd = new ToggleCompleteCommand(task, updateFn);
    CommandHistory.push(cmd);
    
    try {
      await cmd.execute();
      
      // If recurring and completing, handle creating next instance
      if (isCompleting && task.recurring.type !== 'none' && task.dueDate) {
        let nextDate = new Date(task.dueDate);
        if (task.recurring.type === 'daily') nextDate = addDays(nextDate, 1 * (task.recurring.frequency || 1));
        if (task.recurring.type === 'weekly') nextDate = addWeeks(nextDate, 1 * (task.recurring.frequency || 1));
        if (task.recurring.type === 'monthly') nextDate = addMonths(nextDate, 1 * (task.recurring.frequency || 1));

        const nextTaskData = {
          title: task.title,
          description: task.description || null,
          category: task.category,
          dueDate: Timestamp.fromDate(nextDate),
          completed: false,
          userId: task.userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          recurring: task.recurring,
          reminders: task.reminders || [],
          subtasks: task.subtasks?.map(st => ({
            ...st,
            completed: false,
            dueDate: st.dueDate ? Timestamp.fromDate(addDays(st.dueDate, task.recurring.type === 'daily' ? 1 : task.recurring.type === 'weekly' ? 7 : 30)) : null
          })) || []
        };
        await addDoc(collection(db, 'tasks'), nextTaskData);
      }

      setUndoToast(`Змінено статус: "${task.title}".`);
      setTimeout(() => setUndoToast(null), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete || !taskToDelete.id) return;
    const path = `tasks/${taskToDelete.id}`;
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete.id));
      setTaskToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    if (!taskId) return;
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateAIDivision = async () => {
    if (!title.trim()) {
      setAiError("Please provide a title for your task.");
      return;
    }
    
    if (!description.trim()) {
      setAiError("Please provide a description so the AI can understand the context.");
      // Scroll to description
      descriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      descriptionRef.current?.focus();
      return;
    }
    
    setAiError(null);
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Task Title: ${title}
Task Description: ${description}

As a productivity expert, analyze the task above.
If the description or title provides insufficient context to break down the task meaningfully into subtasks, respond with a JSON object: {"error": "I don't have enough context to break this task down. Could you add more details about what needs to be done?"}

Otherwise, divide it into 3-5 clear, actionable subtasks. Each subtask should have a title and a very brief description (max 1 sentence). 
Return ONLY a JSON array of objects with 'title' and 'description' keys. 
Example success: [{"title": "Action Item", "description": "Quick detail."}]`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const jsonStr = response.text;
      const result = JSON.parse(jsonStr || '[]');
      
      if (result.error) {
        setAiError(result.error);
        descriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        descriptionRef.current?.focus();
        return;
      }

      if (Array.isArray(result)) {
        const newSubs = result.map(s => ({
          id: crypto.randomUUID(),
          title: s.title,
          description: s.description || '',
          dueDate: '',
          completed: false
        }));
        setSubtasks(prev => [...prev, ...newSubs]);
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiError("Failed to divide task. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSubtaskComplete = async (task: Task, subtaskId: string) => {
    if (!task.id || !task.subtasks) return;
    
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const allSubtasksDone = updatedSubtasks.every(st => st.completed);
    
    // If any subtask is marked as not done, the main task must also be not done
    // If all subtasks are done, we still respect the main task's current status (but it can now be marked done manually)
    const shouldKeepTaskDone = task.completed && allSubtasksDone;

    const path = `tasks/${task.id}`;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        subtasks: updatedSubtasks.map(st => ({
          ...st,
          dueDate: st.dueDate ? Timestamp.fromDate(st.dueDate) : null
        })),
        completed: shouldKeepTaskDone,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAiError(null);
    // Default to current category if not 'All'
    setCategory(selectedCategory !== 'All' ? selectedCategory : '');
    setDeadlineDate('');
    setDeadlineTime('');
    setRecurringType('none');
    setEditingTask(null);
    setSubtasks([]);
    setNewSubtaskTitle('');
    setNewSubtaskDescription('');
    setNewSubtaskDueDate('');
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    if (task.dueDate) {
      setDeadlineDate(format(task.dueDate, 'yyyy-MM-dd'));
      setDeadlineTime(format(task.dueDate, 'HH:mm'));
    } else {
      setDeadlineDate('');
      setDeadlineTime('');
    }
    setRecurringType(task.recurring.type);
    setSubtasks(task.subtasks?.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description || '',
      completed: s.completed,
      dueDate: s.dueDate ? format(s.dueDate, "yyyy-MM-dd'T'HH:mm") : ''
    })) || []);
    setIsModalOpen(true);
  };

  const confirmAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    
    const newSubData = {
      id: editingSubtaskIndex !== null ? subtasks[editingSubtaskIndex].id : crypto.randomUUID(),
      title: newSubtaskTitle.trim(),
      description: newSubtaskDescription,
      dueDate: newSubtaskDueDate,
      completed: editingSubtaskIndex !== null ? subtasks[editingSubtaskIndex].completed : false
    };

    if (editingSubtaskIndex !== null) {
      const updated = [...subtasks];
      updated[editingSubtaskIndex] = newSubData;
      setSubtasks(updated);
    } else {
      setSubtasks([...subtasks, newSubData]);
    }

    setNewSubtaskTitle('');
    setNewSubtaskDescription('');
    setNewSubtaskDueDate('');
    setEditingSubtaskIndex(null);
    setIsSubtaskModalOpen(false);
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const filteredTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => {
        const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
        
        let matchesArchive = false;
        const isCompletedToday = t.completed && t.completedAt && isSameDay(t.completedAt, now);
        
        if (showArchive) {
          // Archive shows tasks completed BEFORE today
          matchesArchive = t.completed && !isCompletedToday;
        } else {
          // Active view shows uncompleted tasks OR tasks completed TODAY
          matchesArchive = !t.completed || isCompletedToday;
        }
        
        return matchesCategory && matchesArchive;
      })
      .sort((a, b) => {
        // First sort: Completed tasks go to the bottom
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        
        // Second sort: Due logic
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
  }, [tasks, selectedCategory, showArchive]);

  const stats = useMemo(() => {
    const now = new Date();
    // Include all non-completed tasks (active) + tasks completed this week
    const relevantTasks = tasks.filter(t => {
      if (!t.completed) return true;
      if (t.completedAt && isSameWeek(t.completedAt, now)) return true;
      return false;
    });
    const totalCount = relevantTasks.length;

    const calculateTaskProgress = (task: Task) => {
      if (task.completed) return 1;
      if (task.subtasks && task.subtasks.length > 0) {
        const completedSub = task.subtasks.filter(s => s.completed).length;
        return completedSub / task.subtasks.length;
      }
      return 0;
    };

    const totalProgress = relevantTasks.reduce((acc, t) => acc + calculateTaskProgress(t), 0);
    const percentage = totalCount > 0 ? Math.round((totalProgress / totalCount) * 100) : 0;

    const categoryBreakdown = customCategories.map(cat => {
      const catTasks = relevantTasks.filter(t => t.category === cat);
      const catTotal = catTasks.length;
      if (catTotal === 0) return { name: cat, total: 0, completed: 0, percentage: 0 };
      
      const catProgress = catTasks.reduce((acc, t) => acc + calculateTaskProgress(t), 0);
      const catPercentage = Math.round((catProgress / catTotal) * 100);
      
      return { 
        name: cat, 
        total: catTotal, 
        completed: Math.round(catProgress * 10) / 10, 
        percentage: catPercentage 
      };
    });

    return { 
      total: totalCount, 
      completed: Math.round(totalProgress * 10) / 10, 
      percentage, 
      categoryBreakdown 
    };
  }, [tasks, customCategories]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-artistic-soft relative overflow-hidden">
        {/* Background purely decorative elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-artistic-pink/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-artistic-rose/5 rounded-full blur-[100px]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center soft-shadow mb-8 relative">
            <Sparkles className="text-artistic-rose w-12 h-12" />
            <motion.div 
              className="absolute inset-0 rounded-[40px] border-2 border-artistic-pink/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <h1 className="text-4xl font-sans font-bold text-artistic-rose mb-2 uppercase tracking-tighter">Bloom.</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-artistic-taupe font-bold">Mindful Productivity</p>
          
          <div className="mt-12 flex space-x-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-artistic-pink/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-artistic-soft p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass p-10 rounded-[40px] soft-shadow text-center"
        >
          <div className="w-20 h-20 bg-artistic-border rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="text-artistic-rose w-10 h-10" />
          </div>
          <h1 className="text-4xl font-sans font-bold text-artistic-rose mb-4 uppercase tracking-tighter">Bloom.</h1>
          <p className="text-artistic-taupe mb-10 leading-relaxed text-sm uppercase tracking-widest text-center">
            Mindful Task Management & <br/> 
            Personal Growth
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center bg-white border border-[#dadce0] rounded-full py-3 px-4 hover:bg-[#f8f9fa] shadow-sm transition-all group"
          >
            <div className="mr-3">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="text-stone-700 font-medium tracking-tight">Sign in with Google</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-artistic-soft">
      {/* Sidebar */}
      <aside className="w-72 hidden lg:flex flex-col border-r border-artistic-border bg-white/50 backdrop-blur-sm p-8 sticky top-0 h-screen">
        <div className="mb-12 px-2">
          <h1 className="text-3xl font-sans font-bold text-artistic-rose leading-tight">Bloom.</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-artistic-taupe mt-2">Mindful Productivity</p>
        </div>

        <nav className="space-y-8 flex-grow overflow-y-auto no-scrollbar">
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-[11px] uppercase tracking-widest text-artistic-rose font-bold">Categories</h3>
              <button 
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="text-artistic-rose hover:text-artistic-dark transition-colors"
                title="Add Category"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {isAddingCategory && (
              <div className="px-2 mb-4">
                <input 
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category..."
                  className="w-full bg-artistic-soft border border-artistic-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-artistic-pink"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  autoFocus
                />
              </div>
            )}

            <ul className="space-y-2">
              {['All', ...customCategories].map((cat) => (
                <li key={cat} className="group relative">
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium",
                      selectedCategory === cat 
                        ? "text-artistic-pink" 
                        : "text-artistic-dark opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      selectedCategory === cat ? "bg-artistic-pink" : "bg-stone-300"
                    )} />
                    {cat === 'All' ? 'All Tasks' : cat}
                  </button>
                  {cat !== 'All' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryToDelete(cat);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-artistic-taupe hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete category"
                    >
                      <X size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </nav>

        <div className="mt-auto space-y-6">


          <div className="pt-6 border-t border-artistic-border">
            <div className="flex items-center gap-3 px-2 mb-6">
              <img 
                src={user.photoURL || undefined} 
                className="w-10 h-10 rounded-2xl shadow-sm" 
                alt="Avatar" 
              />
              <div className="overflow-hidden">
                <p className="font-semibold truncate text-sm text-artistic-dark">{user.displayName}</p>
                <button 
                  onClick={handleLogout}
                  className="text-xs text-artistic-taupe hover:text-artistic-pink transition-colors flex items-center gap-1"
                >
                  <LogOut size={12} /> Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 lg:p-12 flex flex-col max-w-6xl mx-auto w-full overflow-x-hidden">
        <header className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
          <div className="flex flex-col w-full md:w-auto">
            <div className="flex items-center justify-between lg:hidden mb-4">
               <h1 className="text-2xl font-sans font-bold text-artistic-rose">Bloom.</h1>
               <div className="flex gap-2">
                 <button 
                  onClick={() => setIsCategoryMenuOpen(true)}
                  className="p-2 bg-white rounded-xl border border-artistic-border text-artistic-rose shadow-sm flex items-center gap-2"
                 >
                   <LayoutGrid size={18} />
                 </button>
               </div>
            </div>
            <h2 className="text-3xl sm:text-5xl font-sans font-bold text-artistic-dark">{format(new Date(), 'EEEE')}</h2>
            <p className="text-base sm:text-lg text-artistic-rose font-sans font-medium">{format(new Date(), 'MMMM do, yyyy')}</p>
          </div>
          <div className="hidden md:flex text-right w-full md:w-auto flex flex-row md:flex-col justify-between items-end md:items-end">
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-artistic-taupe mb-1 md:mb-2 font-bold text-right">Weekly Progress</p>
              <div className="flex items-baseline justify-end space-x-2">
                <span className="text-3xl sm:text-5xl font-sans font-bold text-artistic-dark">{stats.percentage}%</span>
                <span className="text-artistic-pink font-bold text-xs sm:text-base">{stats.percentage > 0 ? `+${stats.percentage}%` : '0%'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header Bottom - Category Badge (Cleaned up) */}
        <div className="lg:hidden mb-6 flex items-center justify-between transition-all">
          <div className="flex flex-col">
            <p className="text-[10px] uppercase font-bold tracking-widest text-artistic-taupe mb-1">Focusing On</p>
            <h3 className="text-lg font-sans font-bold text-artistic-rose tracking-tight">
              {selectedCategory === 'All' ? 'All Tasks' : selectedCategory.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
            </h3>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-6 lg:gap-10">
          {/* Tasks Section */}
          <div className="col-span-12 lg:col-span-8 flex flex-col order-1">
            <div className="flex justify-between items-center mb-10 w-full">
               <div className="hidden lg:block">
                 {/* Journal label removed as requested */}
                 <h3 className="text-xl font-sans font-bold text-artistic-rose">
                   {showArchive ? 'Archive History' : (selectedCategory === 'All' ? 'All Tasks' : selectedCategory)}
                 </h3>
               </div>
                <div className="flex gap-2 sm:gap-3 items-center ml-auto">
                  <button
                    onClick={() => setShowArchive(!showArchive)}
                    className={cn(
                      "flex px-3 py-2 lg:px-6 lg:py-3.5 rounded-[24px] text-[10px] lg:text-xs font-bold transition-all items-center gap-2 border shadow-sm",
                      showArchive ? "bg-artistic-pink text-white border-artistic-pink shadow-pink-100" : "bg-white border-artistic-border text-artistic-taupe hover:border-artistic-pink/30"
                    )}
                  >
                    {showArchive ? (
                     <>
                       <CheckCircle2 size={16} />
                       <span className="hidden lg:inline text-[10px] lg:text-xs">Active Tasks</span>
                       <span className="lg:hidden text-[10px]">Active</span>
                     </>
                   ) : (
                     <>
                       <Archive size={16} />
                       <span className="hidden lg:inline text-[10px] lg:text-xs">Archive History</span>
                       <span className="lg:hidden text-[10px]">Archive</span>
                     </>
                   )}
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleOpenAddTask}
                    className="flex px-4 py-2 lg:px-8 lg:py-3.5 bg-artistic-pink text-white rounded-[24px] text-[10px] lg:text-xs font-bold shadow-xl shadow-pink-100 items-center gap-2 transition-all hover:bg-artistic-rose"
                  >
                    <Plus size={18} /> 
                    <span className="hidden lg:inline">Add Task</span>
                    <span className="lg:hidden">Add</span>
                  </motion.button>
                </div>
            </div>

            <div className="space-y-6">
              <AnimatePresence initial={false}>
                  {filteredTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-32 text-center flex flex-col items-center gap-6 bg-white/30 backdrop-blur-md rounded-[56px] border border-artistic-border soft-shadow"
                    >
                      <div className="w-20 h-20 bg-artistic-soft flex items-center justify-center rounded-[32px] rotate-12">
                        <CheckCircle2 size={32} className="text-artistic-taupe opacity-30" />
                      </div>
                      <div>
                        <p className="font-sans font-bold text-2xl text-artistic-dark">No tasks found.</p>
                        <p className="text-sm text-artistic-taupe font-medium mt-2">Add a task to your day.</p>
                      </div>
                    </motion.div>
                  ) : (
                    filteredTasks.map((task) => {
                      const isOverdue = !task.completed && task.dueDate && isBefore(task.dueDate, new Date());
                      
                      return (
                        <motion.div
                          key={task.id}
                          layout="position"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0, x: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ 
                            layout: { 
                              type: "spring", 
                              stiffness: 300, 
                              damping: 35, 
                              mass: 0.8 
                            },
                            opacity: { duration: 0.2 }
                          }}
                          className={cn(
                            "group bg-white rounded-[32px] border p-6 transition-all hover:soft-shadow relative overflow-hidden w-full",
                            task.completed ? "opacity-60 bg-stone-50 border-artistic-border" : "border-artistic-border",
                            isOverdue && "border-red-500 bg-red-50/50 shadow-lg shadow-red-100/50 scale-[1.02] border-2"
                          )}
                          onClick={() => openEditModal(task)}
                        >
                          {isOverdue && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                          )}
                          <div className="flex items-center justify-between w-full cursor-pointer">
                            <div className="flex items-center space-x-5 flex-1 min-w-0">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComplete(task);
                                }}
                                className={cn(
                                  "w-7 h-7 rounded-2xl border-2 flex items-center justify-center transition-all flex-shrink-0",
                                  task.completed 
                                    ? "bg-artistic-pink border-artistic-pink" 
                                    : isOverdue 
                                      ? "border-red-400 bg-white"
                                      : "border-artistic-border group-hover:border-artistic-pink"
                                )}
                              >
                                <AnimatePresence mode="wait">
                                  {task.completed ? (
                                    <motion.div
                                      key="check"
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    >
                                      <CheckCircle2 size={16} className="text-white" />
                                    </motion.div>
                                  ) : isOverdue && (
                                    <motion.div
                                      initial={{ rotate: -10 }}
                                      animate={{ rotate: 10 }}
                                      transition={{ repeat: Infinity, duration: 1, repeatType: "mirror" }}
                                    >
                                      <Clock size={14} className="text-red-500" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={cn(
                                    "text-lg font-sans font-bold text-artistic-dark truncate transition-all",
                                    task.completed && "line-through opacity-50",
                                    isOverdue && "text-red-700"
                                  )}>
                                    {task.title}
                                  </p>
                                  {isOverdue && (
                                    <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter animate-pulse">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className={cn(
                                    "text-[9px] px-2.5 py-1 rounded-full uppercase font-bold tracking-widest border",
                                    isOverdue 
                                      ? "bg-red-100 text-red-600 border-red-200" 
                                      : "bg-artistic-soft text-artistic-rose border-artistic-border"
                                  )}>
                                    {task.category}
                                  </span>
                                  {task.recurring && task.recurring.type !== 'none' && (
                                    <span className="text-[9px] px-2.5 py-1 rounded-full uppercase font-bold tracking-widest bg-indigo-50 text-indigo-500 border border-indigo-100 flex items-center gap-1">
                                      <History size={10} className="animate-spin-slow" />
                                      {task.recurring.type === 'daily' && 'Repeats Daily'}
                                      {task.recurring.type === 'weekly' && 'Repeats Weekly'}
                                      {task.recurring.type === 'monthly' && 'Repeats Monthly'}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className={cn(
                                      "text-[9px] font-bold flex items-center gap-1",
                                      isOverdue ? "text-red-600" : "text-artistic-taupe"
                                    )}>
                                      <Clock size={10} /> {format(task.dueDate, 'MMM d, h:mm a')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 hover:bg-artistic-soft rounded-xl"><Pencil size={18} /></button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTaskToDelete(task);
                                }}
                                className="p-2 hover:bg-red-50 text-red-400 rounded-xl"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>

              {/* Progress Section */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className="bg-artistic-border p-6 rounded-[32px] flex items-center shadow-lg gap-6">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="transparent" stroke="white" strokeWidth="8" className="opacity-50" />
                      <motion.circle
                        cx="64" cy="64" r="56" fill="transparent" stroke="#F472B6" strokeWidth="8"
                        strokeDasharray={351.85}
                        initial={{ strokeDashoffset: 351.85 }}
                        animate={{ strokeDashoffset: 351.85 - (351.85 * stats.percentage) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <span className="text-lg font-sans font-bold text-artistic-dark">{stats.completed}/{stats.total}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <h5 className="font-sans font-bold text-lg text-artistic-dark">Summary</h5>
                    <p className="text-[10px] text-artistic-taupe font-medium">
                      {stats.completed} tasks completed.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-artistic-border soft-shadow">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-artistic-pink" />
                    <h6 className="text-[10px] uppercase font-bold tracking-widest text-artistic-dark">Task Statistics</h6>
                  </div>
                  <div className="space-y-4">
                    {stats.categoryBreakdown.filter(c => c.total > 0).map(cat => (
                      <div key={cat.name}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-artistic-rose">{cat.name}</span>
                          <span className="text-[10px] font-medium text-artistic-taupe">{cat.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-artistic-soft rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.percentage}%` }}
                            className="h-full bg-artistic-pink"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

      {/* Task Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-artistic-dark/10 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 m-auto h-fit max-w-[calc(100%-2rem)] sm:max-w-lg w-full bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] z-50 soft-shadow border border-artistic-border overflow-y-auto max-h-[90vh]"
            >
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-sans font-bold text-artistic-dark">
                    {editingTask ? 'Edit Task' : 'Add Task'}
                  </h2>
                  <button 
                    type="button"
                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                    className="p-2 hover:bg-artistic-soft rounded-full text-artistic-taupe transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddTask} className="space-y-5 relative">
                {/* AI Error Notification Popup */}
                <AnimatePresence>
                  {aiError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-0 left-0 right-0 z-[60] p-4 bg-white border-2 border-artistic-pink rounded-2xl shadow-xl flex items-start gap-3"
                    >
                      <div className="p-2 bg-pink-50 rounded-lg text-artistic-pink">
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-artistic-dark mb-1">AI Division Needed</p>
                        <p className="text-[11px] text-artistic-taupe leading-relaxed">
                          {aiError}
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAiError(null)}
                        className="p-1 hover:bg-artistic-soft rounded-full text-artistic-taupe"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-2 px-1 text-left">Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task name"
                    className="w-full bg-artistic-soft/50 border border-artistic-border rounded-2xl px-5 py-3 ml-0 outline-none focus:ring-2 ring-artistic-pink/20 transition-all font-medium text-artistic-dark"
                    required
                  />
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-2 px-1 text-left">Description</label>
                   <textarea 
                    ref={descriptionRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Details..."
                    className="w-full bg-artistic-soft/50 border border-artistic-border rounded-2xl px-5 py-3 ml-0 outline-none focus:ring-2 ring-artistic-pink/20 transition-all font-medium resize-none h-24 text-artistic-dark"
                   />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest px-1 text-left flex items-center justify-between">
                      Category
                      {!category && <span className="text-red-400 text-[8px] animate-pulse">Required *</span>}
                    </label>
                    <div className="flex flex-wrap gap-2 p-1">
                      {customCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all border",
                            category === cat 
                              ? "bg-artistic-pink text-white border-artistic-pink shadow-md" 
                              : "bg-white text-artistic-taupe border-artistic-border hover:border-artistic-pink/30 hover:bg-artistic-soft"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest px-1 text-left">Recurring</label>
                    <div className="flex flex-wrap gap-2 p-1">
                      {(['none', 'daily', 'weekly', 'monthly'] as RecurringType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRecurringType(type)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] uppercase font-bold tracking-wider transition-all border",
                            recurringType === type 
                              ? "bg-artistic-rose text-white border-artistic-rose shadow-md scale-105" 
                              : "bg-white text-artistic-taupe border-artistic-border hover:border-artistic-rose/50 hover:bg-artistic-soft"
                          )}
                        >
                          {type === 'none' ? 'Once' : type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest">Deadline</label>
                    {(deadlineDate || deadlineTime) && (
                      <button 
                        type="button" 
                        onClick={() => { setDeadlineDate(''); setDeadlineTime(''); }}
                        className="text-[9px] text-red-400 font-bold hover:underline"
                      >
                        Clear Deadline
                      </button>
                    )}
                  </div>
                  <div className="bg-artistic-soft/30 border border-artistic-border rounded-[32px] p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] uppercase font-bold text-artistic-taupe/70 tracking-wider flex items-center gap-2 ml-1">
                          <Calendar size={12} className="text-artistic-pink" /> Date
                        </label>
                        <input 
                          type="date" 
                          value={deadlineDate}
                          onChange={(e) => setDeadlineDate(e.target.value)}
                          className="w-full bg-white border border-artistic-border rounded-2xl px-5 py-3 outline-none focus:ring-2 ring-artistic-pink/20 transition-all text-sm font-medium text-artistic-dark shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] uppercase font-bold text-artistic-taupe/70 tracking-wider flex items-center gap-2 ml-1">
                          <Clock size={12} className="text-artistic-pink" /> Time
                        </label>
                        <input 
                          type="time" 
                          value={deadlineTime}
                          onChange={(e) => setDeadlineTime(e.target.value)}
                          className="w-full bg-white border border-artistic-border rounded-2xl px-5 py-3 outline-none focus:ring-2 ring-artistic-pink/20 transition-all text-sm font-medium text-artistic-dark shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {deadlineDate && (
                  <div className="space-y-3">
                    {/* Empty for now, or could show something else */}
                  </div>
                )}

                <div className="pt-4 border-t border-artistic-border">
                  <label className="block text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-3 px-1 text-left">Subtasks</label>
                  
                  <div className="space-y-3 mb-4">
                    {subtasks.map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-2 bg-artistic-soft/30 p-3 rounded-xl border border-artistic-border group">
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-artistic-dark truncate">{st.title}</p>
                          {st.dueDate && (
                            <p className="text-[10px] text-artistic-taupe font-medium">
                              Due: {format(new Date(st.dueDate), 'MMM d, h:mm a')}
                            </p>
                          )}
                          {st.description && (
                            <p className="text-[10px] text-artistic-taupe line-clamp-1">{st.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => openEditSubtaskModal(idx)}
                            className="p-1.5 hover:bg-white rounded-full text-artistic-taupe hover:text-artistic-pink transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeSubtask(st.id)}
                            className="p-1.5 hover:bg-white rounded-full text-artistic-taupe hover:text-red-500 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-artistic-soft p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] uppercase font-bold text-artistic-taupe tracking-widest">Tasks</span>
                      <button 
                        type="button"
                        onClick={generateAIDivision}
                        disabled={isGenerating || !description.trim()}
                        className="text-[9px] text-artistic-pink font-bold flex items-center gap-1 hover:underline disabled:opacity-30 disabled:no-underline"
                      >
                        <Sparkles size={10} /> {isGenerating ? 'Processing...' : 'Ask AI to divide'}
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={openSubtaskAddModal}
                      className="px-4 py-2 bg-artistic-pink text-white rounded-xl text-[10px] font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Plus size={14} /> Add Subtask
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                    className="flex-1 py-3.5 rounded-full font-bold bg-artistic-soft text-artistic-taupe hover:bg-artistic-border transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 py-3.5 rounded-full font-bold bg-artistic-pink text-white hover:bg-artistic-rose transition-all shadow-lg shadow-pink-100"
                  >
                    {editingTask ? 'Save Changes' : 'Add Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* Mobile Category Menu */}
      <AnimatePresence>
        {isCategoryMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryMenuOpen(false)}
              className="fixed inset-0 bg-artistic-dark/40 backdrop-blur-md z-[60] lg:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[85%] max-w-[280px] bg-white z-[70] p-6 lg:hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-sans font-bold text-artistic-rose">Categories</h2>
                <button onClick={() => setIsCategoryMenuOpen(false)} className="p-1.5 hover:bg-artistic-soft rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5">
                <button 
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-artistic-soft text-artistic-pink font-bold border border-artistic-pink/10 mb-3"
                >
                  <span className="text-[10px] uppercase tracking-widest">New Category</span>
                  <Plus size={14} />
                </button>

                {isAddingCategory && (
                  <div className="px-2 mb-4">
                    <input 
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name..."
                      className="w-full bg-white border border-artistic-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-artistic-pink/20"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      autoFocus
                    />
                  </div>
                )}

                {['All', ...customCategories].map((cat) => (
                  <div key={cat} className="relative mb-1">
                    <button
                      onClick={() => {
                        setSelectedCategory(cat);
                        setIsCategoryMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-sm font-medium border",
                        selectedCategory === cat 
                          ? "bg-artistic-pink text-white border-artistic-pink shadow-md shadow-pink-100" 
                          : "bg-white text-artistic-dark border-artistic-border"
                      )}
                    >
                      <span className="truncate pr-4">{cat === 'All' ? 'All Tasks' : cat}</span>
                      {selectedCategory === cat && <CheckCircle2 size={14} />}
                    </button>
                    {cat !== 'All' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryToDelete(cat);
                        }}
                        className="absolute -right-1 -top-1 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white z-10"
                        title="Delete space"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-8 border-t border-artistic-border">
                <div className="flex items-center gap-4">
                  <img src={user.photoURL || undefined} className="w-12 h-12 rounded-2xl" alt="" />
                  <div>
                    <p className="font-bold text-artistic-dark">{user.displayName}</p>
                    <button onClick={handleLogout} className="text-xs text-artistic-taupe">Sign Out</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Category Deletion Confirmation Modal */}
      <AnimatePresence>
        {categoryToDelete && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCategoryToDelete(null)}
              className="fixed inset-0 bg-artistic-dark/20 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              className="fixed left-1/2 top-1/2 m-auto max-w-[calc(100%-3rem)] sm:max-w-sm w-full bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] z-[110] shadow-2xl text-center border border-artistic-border"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl sm:text-2xl font-sans font-bold text-artistic-dark mb-2">Delete Category?</h3>
              <p className="text-xs sm:text-sm text-artistic-taupe mb-6 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-artistic-dark">"{categoryToDelete}"</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-3.5 rounded-full font-bold bg-artistic-soft text-artistic-taupe text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteCategory}
                  className="flex-1 py-3.5 rounded-full font-bold bg-red-500 text-white shadow-lg shadow-red-100 text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {taskToDelete && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTaskToDelete(null)}
              className="fixed inset-0 bg-artistic-dark/20 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              className="fixed left-1/2 top-1/2 m-auto max-w-[calc(100%-3rem)] sm:max-w-sm w-full bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] z-[110] shadow-2xl text-center border border-artistic-border"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl sm:text-2xl font-sans font-bold text-artistic-dark mb-2">Delete Task?</h3>
              <p className="text-xs sm:text-sm text-artistic-taupe mb-6 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-artistic-dark">"{taskToDelete.title}"</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 py-3.5 rounded-full font-bold bg-artistic-soft text-artistic-taupe text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteTask}
                  className="flex-1 py-3.5 rounded-full font-bold bg-red-500 text-white shadow-lg shadow-red-100 text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSubtaskModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubtaskModalOpen(false)}
              className="fixed inset-0 bg-artistic-dark/10 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
              className="fixed left-1/2 top-1/2 m-auto max-w-sm w-[90%] bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] z-[70] soft-shadow border border-artistic-border"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-sans font-bold text-artistic-dark mb-4">
                  {editingSubtaskIndex !== null ? 'Edit Subtask' : 'New Subtask'}
                </h3>
                <button 
                  onClick={() => setIsSubtaskModalOpen(false)}
                  className="p-1 px-2 hover:bg-artistic-soft rounded-full text-artistic-taupe mb-4"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">Title</label>
                  <input 
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask title..."
                    className="w-full bg-artistic-soft border border-artistic-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 ring-artistic-pink"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">Details</label>
                  <textarea 
                    value={newSubtaskDescription}
                    onChange={(e) => setNewSubtaskDescription(e.target.value)}
                    placeholder="Details for this subtask..."
                    className="w-full bg-artistic-soft border border-artistic-border rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 ring-artistic-pink h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-artistic-taupe tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">Deadline (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={newSubtaskDueDate}
                    onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                    className="w-full bg-artistic-soft border border-artistic-border rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 ring-artistic-pink"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsSubtaskModalOpen(false)}
                  className="flex-1 py-3.5 rounded-full font-bold bg-artistic-soft text-artistic-taupe text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAddSubtask}
                  className="flex-1 py-3.5 rounded-full font-bold bg-artistic-pink text-white shadow-lg shadow-pink-100 text-sm"
                >
                  {editingSubtaskIndex !== null ? 'Save' : 'Add'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AIAssistant tasks={tasks} categories={customCategories} />
      <PatternShowcase 
        tasks={tasks}
        userId={user?.uid || ''}
        onRefreshTasks={() => {}} 
        onAddTaskDirectly={handleAddTaskDirectly}
        onTriggerUndoToast={(msg) => {
          setUndoToast(msg);
          setTimeout(() => setUndoToast(null), 4000);
        }}
      />

      {/* Floating Undo Toast Notification */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 z-[200] bg-stone-900 border border-stone-800 text-stone-100 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 text-xs font-bold font-sans"
          >
            <span>{undoToast}</span>
            <button
              onClick={async () => {
                const label = await CommandHistory.undo();
                if (label) {
                  setUndoToast(`Скасовано дію: ${label}`);
                  setTimeout(() => setUndoToast(null), 3000);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl transition-all"
            >
              Скасувати (Undo)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
