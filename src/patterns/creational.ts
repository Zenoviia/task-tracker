/**
 * @file creational.ts
 * @description Реалізація породжуючих патернів проєктування (Creational Design Patterns)
 * ТЕМИ: Builder, Factory, Factory Method, Abstract Factory, Prototype, Object Pool, SOLID
 */

import { Task, TaskCategory, RecurringConfig, Subtask } from '../types';

/**
 * 1. PATTERN: Builder (Будівельник)
 * Дозволяє покроково створювати складні об'єкти (Task) з підтримкою fluent API.
 * Сприяє дотриманню SOLID (Single Responsibility Principle).
 */
export class TaskBuilder {
  private task: Partial<Task> = {
    title: '',
    description: '',
    category: TaskCategory.PERSONAL,
    dueDate: null,
    completed: false,
    userId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    recurring: { type: 'none', frequency: 1 },
    reminders: [],
    subtasks: []
  };

  public static create(userId: string): TaskBuilder {
    const builder = new TaskBuilder();
    builder.task.userId = userId;
    return builder;
  }

  public setTitle(title: string): this {
    this.task.title = title;
    return this;
  }

  public setDescription(description: string): this {
    this.task.description = description;
    return this;
  }

  public setCategory(category: TaskCategory | string): this {
    this.task.category = category;
    return this;
  }

  public setDueDate(date: Date | null): this {
    this.task.dueDate = date;
    return this;
  }

  public setRecurring(type: 'none' | 'daily' | 'weekly' | 'monthly', frequency = 1): this {
    this.task.recurring = { type, frequency };
    return this;
  }

  public addSubtask(subtask: Subtask): this {
    if (!this.task.subtasks) {
      this.task.subtasks = [];
    }
    this.task.subtasks.push(subtask);
    return this;
  }

  public setSubtasks(subtasks: Subtask[]): this {
    this.task.subtasks = subtasks;
    return this;
  }

  public build(): Task {
    if (!this.task.title) {
      throw new Error("Task title is required");
    }
    return {
      title: this.task.title,
      description: this.task.description ?? '',
      category: this.task.category ?? TaskCategory.PERSONAL,
      dueDate: this.task.dueDate ?? null,
      completed: this.task.completed ?? false,
      userId: this.task.userId ?? '',
      createdAt: this.task.createdAt ?? new Date(),
      updatedAt: this.task.updatedAt ?? new Date(),
      recurring: this.task.recurring ?? { type: 'none', frequency: 1 },
      reminders: this.task.reminders ?? [],
      subtasks: this.task.subtasks ?? [],
      completedAt: this.task.completedAt ?? null,
      archivedAt: this.task.archivedAt ?? null,
      id: this.task.id
    };
  }
}

/**
 * 2. PATTERN: Factory Method & Creator (Фабричний метод та Творець)
 * Абстрактний клас Творця та його конкретні реалізації для генерації завдань за категоріями.
 */
export abstract class TaskCreator {
  public abstract createTask(title: string, userId: string, description?: string): Task;

  // Організація додаткової бізнес-логіки після створення
  public scheduleTask(title: string, userId: string, daysAhead = 1): Task {
    const task = this.createTask(title, userId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAhead);
    task.dueDate = dueDate;
    return task;
  }
}

export class StudyTaskCreator extends TaskCreator {
  public createTask(title: string, userId: string, description = ''): Task {
    return TaskBuilder.create(userId)
      .setTitle(title)
      .setDescription(description || 'Studying Course Assignment')
      .setCategory(TaskCategory.STUDYING)
      .build();
  }
}

export class WorkTaskCreator extends TaskCreator {
  public createTask(title: string, userId: string, description = ''): Task {
    return TaskBuilder.create(userId)
      .setTitle(title)
      .setDescription(description || 'Professional Work Item')
      .setCategory(TaskCategory.WORK)
      .build();
  }
}

export class PersonalTaskCreator extends TaskCreator {
  public createTask(title: string, userId: string, description = ''): Task {
    return TaskBuilder.create(userId)
      .setTitle(title)
      .setDescription(description || 'Mindful Private Matter')
      .setCategory(TaskCategory.PERSONAL)
      .build();
  }
}

/**
 * 3. PATTERN: Abstract Factory (Абстрактна фабрика)
 * Створює сімейство взаємопов'язаних об'єктів без зазначення конкретних класів.
 * Використовуватиметься для стилізації UI елементів та фабрикування віджетів тем.
 */
export interface UIComponentTheme {
  getBadgeStyle(): string;
  getCardBorder(): string;
  getAccentColor(): string;
}

export class SoftPinkThemeFactory {
  public static getTheme(): UIComponentTheme {
    return {
      getBadgeStyle: () => 'bg-artistic-soft text-artistic-rose border border-artistic-pink/20',
      getCardBorder: () => 'border-artistic-border hover:border-artistic-pink/40',
      getAccentColor: () => '#F472B6' // Soft Pink
    };
  }
}

export class ClassicGreyThemeFactory {
  public static getTheme(): UIComponentTheme {
    return {
      getBadgeStyle: () => 'bg-stone-100 text-stone-600 border border-stone-200',
      getCardBorder: () => 'border-stone-200 hover:border-stone-400',
      getAccentColor: () => '#78716C' // Warm Gray Accent
    };
  }
}

/**
 * 4. PATTERN: Prototype (Прототип)
 * Дозволяє копіювати існуючі об'єкти без залучення зовнішніх залежностей.
 */
export class TaskPrototype {
  public static clone(task: Task): Task {
    return {
      ...task,
      id: undefined, // Щоб створити нове завдання в базі
      title: `${task.title} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      completed: false,
      completedAt: null,
      subtasks: task.subtasks?.map(sub => ({
        ...sub,
        id: crypto.randomUUID(),
        completed: false
      })) || []
    };
  }
}

/**
 * 5. PATTERN: Object Pool (Пул об'єктів)
 * Оптимізує завантаження пам'яті за рахунок повторного використання об'єктів (наприклад, для логів або підзадач).
 */
export class SubtaskPool {
  private static pool: Subtask[] = [];
  private static MAX_SIZE = 10;

  public static acquire(title: string, description = ''): Subtask {
    const cached = this.pool.pop();
    if (cached) {
      cached.id = crypto.randomUUID();
      cached.title = title;
      cached.description = description;
      cached.completed = false;
      cached.dueDate = null;
      return cached;
    }
    return {
      id: crypto.randomUUID(),
      title,
      description,
      completed: false,
      dueDate: null
    };
  }

  public static release(subtask: Subtask): void {
    if (this.pool.length < this.MAX_SIZE) {
      this.pool.push(subtask);
    }
  }
}
