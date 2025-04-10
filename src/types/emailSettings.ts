
export interface EmailSettings {
  id: string;
  email: string;
  auto_send_enabled: boolean;
  auto_send_time: string;
  last_sent_date: string | null;
}
