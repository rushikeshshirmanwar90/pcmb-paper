import type { Href } from 'expo-router';

export const studentHref = (id: string, page?: 'edit' | 'batch'): Href =>
  `/student/${encodeURIComponent(id)}${page ? `/${page}` : ''}` as Href;

export const teacherHref = (id: string, page?: 'edit'): Href =>
  `/teacher/${encodeURIComponent(id)}${page ? `/${page}` : ''}` as Href;
