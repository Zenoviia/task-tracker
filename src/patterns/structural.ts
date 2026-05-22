/**
 * @file structural.ts
 * @description Реалізація структурних патернів проєктування (Structural Design Patterns)
 * ТЕМИ: Composite, Bridge, Proxy, Flyweight, SOLID: Separation of Concerns (SoC)
 */

import { Task, Subtask } from '../types';

/**
 * 1. PATTERN: Composite (Композит / Деревоподібна структура)
 * Об'єднує Leaf (деталі/підзадачі) та Composite (контейнери/завдання) під спільним інтерфейсом.
 */
export interface IProductivityItem {
  getId(): string;
  getTitle(): string;
  isComplete(): boolean;
  getProgress(): number; // Повертає значення від 0 до 1
  getLeafCount(): number;
}

/**
 * Leaf (Листок) в ієрархії Composite: Підзадача (Subtask)
 */
export class SubtaskLeaf implements IProductivityItem {
  constructor(private subtask: Subtask) {}

  public getId(): string {
    return this.subtask.id;
  }

  public getTitle(): string {
    return this.subtask.title;
  }

  public isComplete(): boolean {
    return this.subtask.completed;
  }

  public getProgress(): number {
    return this.subtask.completed ? 1 : 0;
  }

  public getLeafCount(): number {
    return 1;
  }
}

/**
 * Composite (Композит) в ієрархії: Головне завдання (Task) з підзадачами
 */
export class TaskComposite implements IProductivityItem {
  private children: IProductivityItem[] = [];

  constructor(private task: Task) {
    if (task.subtasks) {
      this.children = task.subtasks.map(sub => new SubtaskLeaf(sub));
    }
  }

  public getId(): string {
    return this.task.id || '';
  }

  public getTitle(): string {
    return this.task.title;
  }

  public isComplete(): boolean {
    if (this.children.length === 0) {
      return this.task.completed;
    }
    return this.children.every(child => child.isComplete());
  }

  public getProgress(): number {
    if (this.children.length === 0) {
      return this.task.completed ? 1 : 0;
    }
    const sum = this.children.reduce((acc, child) => acc + child.getProgress(), 0);
    return sum / this.children.length;
  }

  public getLeafCount(): number {
    return this.children.length;
  }

  public getChildren(): IProductivityItem[] {
    return this.children;
  }
}

/**
 * 2. PATTERN: Bridge (Міст)
 * Розділяє абстракцію керування даними від конкретної інфраструктури (Firebase vs LocalStorage).
 */
export interface IDataStorage {
  save(key: string, data: any): Promise<void>;
  load<T>(key: string): Promise<T | null>;
}

// Конкретний виробник 1: LocalStorage
export class LocalStorageProvider implements IDataStorage {
  public async save(key: string, data: any): Promise<void> {
    localStorage.setItem(key, JSON.stringify(data));
  }

  public async load<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
}

// Конкретний виробник 2 (Заглушка з логуванням для демонстрації SOLID / SoC)
export class CloudStorageMockProvider implements IDataStorage {
  private store: Record<string, string> = {};

  public async save(key: string, data: any): Promise<void> {
    console.log(`[Cloud Bridge Sync] Saving data to persistent cloud: ${key}`);
    this.store[key] = JSON.stringify(data);
  }

  public async load<T>(key: string): Promise<T | null> {
    console.log(`[Cloud Bridge Sync] Reading data from persistent cloud: ${key}`);
    const val = this.store[key];
    return val ? JSON.parse(val) : null;
  }
}

// Абстракція Мосту
export class StorageBridge {
  constructor(protected provider: IDataStorage) {}

  public async backupTasks(userId: string, tasks: Task[]): Promise<void> {
    await this.provider.save(`backup_tasks_${userId}`, tasks);
  }

  public async restoreTasks(userId: string): Promise<Task[] | null> {
    return await this.provider.load<Task[]>(`backup_tasks_${userId}`);
  }
}

/**
 * 3. PATTERN: Proxy (Проксі / Замісник)
 * Використовує ES6 Proxy або вбудовані обгортки для валідації, додаткового контролю, 
 * кешування та вимірювання швидкодії (Performance Tracking).
 */
export class TaskValidationProxy {
  public static create(task: Task, onStateChange?: (prop: string, val: any) => void): Task {
    return new Proxy(task, {
      set(target: Task, prop: string, value: any): boolean {
        // Додатковий контроль для SOLID цілісності даних
        if (prop === 'title') {
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            throw new Error('[Proxy Validation] Назва завдання не може бути порожньою!');
          }
        }
        
        if (prop === 'dueDate' && value instanceof Date) {
          const threeYearsAgo = new Date();
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          if (value < threeYearsAgo) {
            throw new Error('[Proxy Validation] Термін виконання є занадто застарілим!');
          }
        }

        // Логування змін для ТЕМИ: Tracing & Context
        console.log(`[Proxy Interceptor] Властивість "${prop}" змінена на:`, value);
        
        // Виклик додаткового колбека
        if (onStateChange) {
          onStateChange(prop, value);
        }

        // Записуємо оригінальне значення
        (target as any)[prop] = value;
        return true;
      }
    });
  }
}

/**
 * 4. PATTERN: Flyweight (Легковаговик)
 * Зберігає спільний стиль категорій, уникаючи засмічення пам'яті дублюванням 
 * однакових кольорових хедлайнів та налаштувань у кожному завданні.
 */
export interface CategoryStyle {
  getBgClass(): string;
  getTextClass(): string;
  getBorderClass(): string;
}

export class CategoryFlyweight {
  private static colors: Record<string, CategoryStyle> = {
    'studying': {
      getBgClass: () => 'bg-emerald-50 text-emerald-600',
      getTextClass: () => 'text-emerald-700',
      getBorderClass: () => 'border-emerald-100'
    },
    'work': {
      getBgClass: () => 'bg-indigo-50 text-indigo-600',
      getTextClass: () => 'text-indigo-700',
      getBorderClass: () => 'border-indigo-100'
    },
    'health': {
      getBgClass: () => 'bg-red-50 text-red-600',
      getTextClass: () => 'text-red-700',
      getBorderClass: () => 'border-red-100'
    },
    'default': {
      getBgClass: () => 'bg-artistic-soft text-artistic-rose',
      getTextClass: () => 'text-artistic-dark',
      getBorderClass: () => 'border-artistic-border'
    }
  };

  public static getStyle(category: string): CategoryStyle {
    const key = category.toLowerCase().trim();
    return this.colors[key] || this.colors['default'];
  }
}
