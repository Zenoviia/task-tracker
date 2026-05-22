/**
 * @file contracts.ts
 * @description Реалізація асинхронних контрактів та просунутих контрактів JavaScript
 * ТЕМИ: Thenable (promise-like), Generators, Iterators, Async Generators, Promises (allSettled, withResolvers)
 */

import { Task } from '../types';

/**
 * 1. THEME: Thenable Contract (Везебельний / Promise-like об'єкт)
 * Будь-який об'єкт, який реалізує метод .then(). Його можна напряму викликати через авейт: await thenable;
 */
export class ThenableTaskAnalyzer {
  constructor(private tasks: Task[]) {}

  public then(
    resolve: (value: { efficiency: number; overdueCount: number }) => void,
    reject?: (reason: any) => void
  ): void {
    try {
      setTimeout(() => {
        const total = this.tasks.length;
        if (total === 0) {
          resolve({ efficiency: 100, overdueCount: 0 });
          return;
        }

        const now = new Date();
        const completedCount = this.tasks.filter(t => t.completed).length;
        const overdueCount = this.tasks.filter(t => !t.completed && t.dueDate && t.dueDate < now).length;
        
        const efficiency = Math.round((completedCount / total) * 100);
        
        resolve({ efficiency, overdueCount });
      }, 500); // Симуляція короткого асинхронного розрахунку
    } catch (e) {
      if (reject) reject(e);
    }
  }
}

/**
 * 2. THEME: JavaScript Contracts - Generator & Iterator
 * Вбудований ітератор, який вміє ітерувати по списку некомплічених завдань, розбавляючи це мотиваційними фразами.
 */
export class TaskListIterable implements Iterable<string> {
  constructor(private tasks: Task[]) {}

  // Реалізація Iteration Protocol
  public [Symbol.iterator](): Iterator<string> {
    let index = 0;
    const activeTasks = this.tasks.filter(t => !t.completed);
    
    return {
      next(): IteratorResult<string> {
        if (index < activeTasks.length) {
          const task = activeTasks[index++];
          return {
            value: `📝 ${task.title} (Category: ${task.category})`,
            done: false
          };
        } else {
          return {
            value: "✨ All done for this iterator session!",
            done: true
          };
        }
      }
    };
  }
}

/**
 * Генератор для отримання порційного списку підзадач (Chunk Generator)
 */
export function* taskChunkGenerator(tasks: Task[], chunkSize = 3): Generator<Task[]> {
  for (let i = 0; i < tasks.length; i += chunkSize) {
    yield tasks.slice(i, i + chunkSize);
  }
}

/**
 * 3. THEME: Async Iterator & Async Generator
 * Симулює асинхронне стрімінгове підключення для оновлення статистичних коментарів або віддалених новин.
 */
export class AsyncMessageStream implements AsyncIterable<string> {
  private messages = [
    "🌟 Mindful tip: Take a deep breath before typing your task.",
    "💧 Stay hydrated! Your cognitive efficiency depends on it.",
    "🌱 Focus flow state unlocked. One subtask at a time.",
    "🏆 Great job planning! Teachers appreciate clean GoF architecture."
  ];

  public async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    for (const msg of this.messages) {
      await new Promise(res => setTimeout(res, 3000)); // Кожні 3 секунди новий стрім-поінт
      yield msg;
    }
  }
}

/**
 * 4. THEME: Promise, AllSettled, withResolvers, Try
 * Демонструє паралельну синхронізацію кількох джерел з обробкою через Promise.withResolvers()
 */
export class AssetSyncer {
  /**
   * Promise.withResolvers() (Новинка ES2024 / TS 5.4+)
   * Дозволяє створювати проміс разом із його методами розв'язання, доступними ззовні.
   */
  public static fetchBackupStatus(tasks: Task[]): Promise<string> {
    // Якщо тайпскрипт підтримує withResolvers, ми використовуємо його
    // або робимо надійну сумісну polyfill-імплементацію у стилі Thenable/Promise
    if (typeof (Promise as any).withResolvers === 'function') {
      const { promise, resolve, reject } = (Promise as any).withResolvers();
      setTimeout(() => {
        resolve(`[Promise.withResolvers] Synced ${tasks.length} tasks and stored backup safely!`);
      }, 800);
      return promise;
    } else {
      let resolveFn!: (value: string) => void;
      let rejectFn!: (reason?: any) => void;
      const promise = new Promise<string>((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });
      setTimeout(() => {
        resolveFn(`[Polyfill Resolvers] Synced ${tasks.length} tasks safely!`);
      }, 800);
      return promise;
    }
  }

  /**
   * Спільна синхронізація через Promise.allSettled
   * На відміну від Promise.all, вона не переривається на першій помилці.
   */
  public static async syncAllSources(tasks: Task[]): Promise<any[]> {
    const backupCloud = AssetSyncer.fetchBackupStatus(tasks);
    const mockDbCheck = new Promise<string>((res) => setTimeout(() => res("[Local Backup Sync] OK"), 300));
    const faultyPing = new Promise<string>((_, rej) => setTimeout(() => rej("[Ping Service] Unreachable"), 200));

    const results = await Promise.allSettled([backupCloud, mockDbCheck, faultyPing]);
    return results;
  }
}
