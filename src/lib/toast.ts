import { toast as showToast } from '@/hooks/use-toast';

type MessageOptions = {
  description?: React.ReactNode;
  duration?: number;
};

const notify = (title: React.ReactNode, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

notify.success = (title: React.ReactNode, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration, variant: 'success' });

notify.error = (title: React.ReactNode, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration, variant: 'destructive' });

notify.warning = (title: React.ReactNode, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

notify.info = (title: React.ReactNode, options?: MessageOptions) =>
  showToast({ title, description: options?.description, duration: options?.duration });

export { notify as toast };
