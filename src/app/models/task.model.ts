export type TaskStatus = 'ToDo' | 'InProgress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskDto {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  taskTypeId?: string | null;
  taskTypeName?: string | null;
  taskTypeColor?: string | null;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  createdByUserId: string;
  createdByUserName: string;
  parentTaskId?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  totalLoggedMinutes: number;
  isOverdue: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  children: TaskDto[];
}

export interface TaskWriteBody {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  taskTypeId?: string | null;
  assignedToUserId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
}

export interface TaskTypeDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface TaskTypeWriteBody {
  name: string;
  color: string;
  isActive?: boolean;
}

export interface TimeEntryDto {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  notes?: string | null;
  loggedAt: string;
}

export interface TimeEntryWriteBody {
  minutes: number;
  notes?: string | null;
}
