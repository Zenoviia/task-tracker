export enum TaskCategory {
  HOUSEWORK = 'Housework',
  STUDYING = 'Studying',
  WORK = 'Work',
  HEALTH = 'Health',
  PERSONAL = 'Personal'
}

export type RecurringType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RecurringConfig {
  type: RecurringType;
  frequency: number;
}

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate: Date | null;
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  category: TaskCategory | string;
  dueDate: Date | null;
  completed: boolean;
  completedAt?: Date | null;
  archivedAt?: Date | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  recurring: RecurringConfig;
  reminders: Date[];
  subtasks?: Subtask[];
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  categories: string[];
  settings: {
    softPinkTheme: boolean;
    motivationalQuotes: boolean;
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}
