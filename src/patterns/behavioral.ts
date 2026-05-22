/**
 * @file behavioral.ts
 * @description Реалізація поведінкових патернів проєктування (Behavioral Design Patterns)
 * ТЕМИ: Command (Частина 1 та 2), Mediator, Strategy, Visitor, Template Method
 */

import { Task } from '../types';
import { IProductivityItem, TaskComposite, SubtaskLeaf } from './structural';

/**
 * 1. PATTERN: Strategy (Стратегія)
 * Задає сімейство взаємозамінних алгоритмів для сортування завдань у списку.
 */
export interface ISortingStrategy {
  sort(tasks: Task[]): Task[];
}

export class SortByDeadlineStrategy implements ISortingStrategy {
  public sort(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }
}

export class SortByCompletionStrategy implements ISortingStrategy {
  public sort(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1; // Виконані опускаються вниз
    });
  }
}

export class SortByCategoryStrategy implements ISortingStrategy {
  public sort(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => a.category.localeCompare(b.category));
  }
}

/**
 * 2. PATTERN: Visitor (Відвідувач)
 * Надає можливість додавати нові операції до ієрархічної структури Composite без її зміни.
 */
export interface ITaskVisitor {
  visitSubtask(subtask: SubtaskLeaf): void;
  visitTask(task: TaskComposite): void;
}

export class StatsVisitor implements ITaskVisitor {
  public totalTasks = 0;
  public completedTasks = 0;
  public totalSubtasks = 0;
  public completedSubtasks = 0;

  public visitSubtask(subtask: SubtaskLeaf): void {
    this.totalSubtasks++;
    if (subtask.isComplete()) {
      this.completedSubtasks++;
    }
  }

  public visitTask(task: TaskComposite): void {
    this.totalTasks++;
    if (task.isComplete()) {
      this.completedTasks++;
    }
    // Відвідуємо всі діти
    for (const child of task.getChildren()) {
      if (child instanceof SubtaskLeaf) {
        this.visitSubtask(child);
      }
    }
  }
}

/**
 * 3. PATTERN: Command & Undo/Redo Engine (Команда)
 * Імплементує підтримку скасування (Undo/Redo) операцій над завданнями.
 */
export interface ICommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
  label: string;
}

export class CommandHistory {
  private static undoStack: ICommand[] = [];
  private static redoStack: ICommand[] = [];

  public static push(command: ICommand): void {
    this.undoStack.push(command);
    this.redoStack = []; // Скидаємо редо після нової команди
  }

  public static getUndoLabel(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].label;
  }

  public static async undo(): Promise<string | null> {
    const cmd = this.undoStack.pop();
    if (cmd) {
      await cmd.undo();
      this.redoStack.push(cmd);
      return cmd.label;
    }
    return null;
  }

  public static async redo(): Promise<string | null> {
    const cmd = this.redoStack.pop();
    if (cmd) {
      await cmd.execute();
      this.undoStack.push(cmd);
      return cmd.label;
    }
    return null;
  }

  public static clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// Конкретна команда 1: Перемикання статусу завершення
export class ToggleCompleteCommand implements ICommand {
  public label = 'Toggle Completed Task';

  constructor(
    private task: Task,
    private updateFn: (taskId: string, fields: Partial<Task>) => Promise<void>
  ) {}

  public async execute(): Promise<void> {
    if (!this.task.id) return;
    await this.updateFn(this.task.id, {
      completed: !this.task.completed,
      completedAt: !this.task.completed ? new Date() : null
    });
  }

  public async undo(): Promise<void> {
    if (!this.task.id) return;
    await this.updateFn(this.task.id, {
      completed: this.task.completed,
      completedAt: this.task.completed ? new Date() : null
    });
  }
}

/**
 * 4. PATTERN: Mediator (Посередник)
 * Координує взаємодію між розрізненими компонентами додатку 
 * (TaskList, Audio, AI Assistant, Analytics, Notification Engine).
 */
export interface IMediatorEvent {
  type: string;
  payload: any;
}

export class ProductivityMediator {
  private static handlers: Record<string, ((payload: any) => void)[]> = {};

  public static subscribe(eventType: string, handler: (payload: any) => void): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(handler);
  }

  public static notify(event: IMediatorEvent): void {
    const list = this.handlers[event.type];
    if (list) {
      list.forEach(handler => {
        try {
          handler(event.payload);
        } catch (e) {
          console.error(`[Mediator Error] Event ${event.type} handler failed:`, e);
        }
      });
    }
  }
}

/**
 * 5. PATTERN: Template Method (Шаблонний метод)
 * Конструює жорстку послідовність кроків (алгоритму) у базовому класі, 
 * дозволяючи підкласам змінювати деталі реалізації окремих кроків.
 */
export abstract class TaskProcessor {
  // Керуючий шаблонний метод для створення або оновлення завдання
  public async processTask(task: Task): Promise<boolean> {
    this.logStep('Початок обробки завдання');
    
    if (!this.validate(task)) {
      this.logStep('Помилка валідації! Процес зупинено.');
      return false;
    }

    const modified = this.transform(task);
    
    this.logStep('Завдання успішно трансформовано. Зберігаємо...');
    await this.save(modified);
    
    this.logStep('Завдання збережено. Викликаємо фінальний хук.');
    this.afterSave(modified);
    
    return true;
  }

  protected logStep(msg: string): void {
    console.log(`[Lifecycle Template Method] ${msg}`);
  }

  // За замовчуванням валідація
  protected validate(task: Task): boolean {
    return task.title.trim().length > 0;
  }

  // Крок для перевизначення: трансформація перед збереженням
  protected abstract transform(task: Task): Task;

  // Крок для перевизначення: безпосереднє збереження
  protected abstract save(task: Task): Promise<void>;

  // Опціональний хук: дія після завершення
  protected afterSave(task: Task): void {
    // Гачок за замовчуванням
  }
}

export class RegularTaskProcessor extends TaskProcessor {
  constructor(private saveCallback: (task: Task) => Promise<void>) {
    super();
  }

  protected transform(task: Task): Task {
    // Встановлюємо дату оновлення
    return {
      ...task,
      updatedAt: new Date()
    };
  }

  protected async save(task: Task): Promise<void> {
    await this.saveCallback(task);
  }

  protected afterSave(task: Task): void {
    ProductivityMediator.notify({
      type: 'TASK_SAVED',
      payload: { id: task.id, title: task.title }
    });
  }
}
export class UrgentTaskProcessor extends TaskProcessor {
  constructor(private saveCallback: (task: Task) => Promise<void>) {
    super();
  }

  protected transform(task: Task): Task {
    return {
      ...task,
      title: `⚡ URGENT: ${task.title}`,
      updatedAt: new Date()
    };
  }

  protected async save(task: Task): Promise<void> {
    await this.saveCallback(task);
  }

  protected afterSave(task: Task): void {
    ProductivityMediator.notify({
      type: 'URGENT_TASK_CREATED',
      payload: { title: task.title }
    });
  }
}
