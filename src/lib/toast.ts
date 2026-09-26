import { toast as showToast } from '@/hooks/use-toast';

type MessageOptions = {
  description?: string;
  duration?: number;
};

const notify = (title: string, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

notify.success = (title: string, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration, variant: 'success' });

notify.error = (title: string, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration, variant: 'destructive' });

notify.warning = (title: string, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

notify.info = (title: string, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

export { notify as toast };
